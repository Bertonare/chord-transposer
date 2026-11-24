import { RubberBandInterface, RubberBandOption } from 'rubberband-wasm';

let rbApi = null;

async function init(wasmUrl) {
  if (rbApi) {
    self.postMessage({ type: 'ready' });
    return;
  }
  const wasmResponse = await fetch(wasmUrl);
  if (!wasmResponse.ok) {
    throw new Error(`Failed to fetch Rubber Band WASM (${wasmResponse.status})`);
  }
  const wasmBuffer = await wasmResponse.arrayBuffer();
  const wasmModule = await WebAssembly.compile(wasmBuffer);
  rbApi = await RubberBandInterface.initialize(wasmModule);
  self.postMessage({ type: 'ready' });
}

self.onmessage = async (e) => {
  const { type, data } = e.data;

  if (type === 'init') {
    try {
      await init(data.wasmUrl);
    } catch (err) {
      self.postMessage({ type: 'error', data: err?.message || String(err) });
    }
    return;
  }

  if (type === 'process') {
    const { channelBuffers, sampleRate, pitch, options } = data;
    const channelCount = channelBuffers.length;
    const inputLength = channelBuffers[0].length;

    const defaultOptions =
      RubberBandOption.RubberBandOptionProcessOffline |
      RubberBandOption.RubberBandOptionPitchHighQuality |
      RubberBandOption.RubberBandOptionEngineFiner |
      RubberBandOption.RubberBandOptionChannelsTogether;

    const rbOptions = options || defaultOptions;

    let rbState = 0;
    let channelArrayPtr = 0;
    const channelDataPtr = [];

    try {
      rbState = rbApi.rubberband_new(sampleRate, channelCount, rbOptions, 1.0, pitch);
      const samplesRequired = rbApi.rubberband_get_samples_required(rbState);
      const startPad = rbApi.rubberband_get_preferred_start_pad(rbState);
      const startDelay = rbApi.rubberband_get_start_delay(rbState);

      channelArrayPtr = rbApi.malloc(channelCount * 4);
      for (let c = 0; c < channelCount; c++) {
        const bufferPtr = rbApi.malloc(samplesRequired * 4);
        channelDataPtr.push(bufferPtr);
        rbApi.memWritePtr(channelArrayPtr + c * 4, bufferPtr);
      }

      rbApi.rubberband_set_expected_input_duration(rbState, inputLength);

      const zeroChunk = new Float32Array(samplesRequired);
      const feedSilence = (fn, totalSamples) => {
        let fed = 0;
        while (fed < totalSamples) {
          const count = Math.min(samplesRequired, totalSamples - fed);
          const slice = count === samplesRequired ? zeroChunk : zeroChunk.subarray(0, count);
          for (let c = 0; c < channelCount; c++) {
            rbApi.memWrite(channelDataPtr[c], slice);
          }
          fn(rbState, channelArrayPtr, count, 0);
          fed += count;
        }
      };

      // 1. Study phase
      if (startPad > 0) {
        feedSilence((s, ptr, n, f) => rbApi.rubberband_study(s, ptr, n, f), startPad);
      }

      let read = 0;
      let nextProgress = samplesRequired * 10;
      while (read < inputLength) {
        const remaining = Math.min(samplesRequired, inputLength - read);
        for (let c = 0; c < channelCount; c++) {
          rbApi.memWrite(channelDataPtr[c], channelBuffers[c].subarray(read, read + remaining));
        }
        read += remaining;
        const isFinal = read >= inputLength ? 1 : 0;
        rbApi.rubberband_study(rbState, channelArrayPtr, remaining, isFinal);

        if (read >= nextProgress) {
          self.postMessage({ type: 'progress', data: (read / inputLength) * 0.1 });
          nextProgress += samplesRequired * 10;
        }
      }

      // 2. Process phase
      const outputBuffers = Array.from({ length: channelCount }, () => new Float32Array(inputLength));
      let skipped = 0;
      let write = 0;

      const tryRetrieve = (isFinal = false) => {
        while (true) {
          const available = rbApi.rubberband_available(rbState);
          if (available <= 0) break;
          if (!isFinal && available < samplesRequired) break;

          const toRead = Math.min(samplesRequired, available);
          const recv = rbApi.rubberband_retrieve(rbState, channelArrayPtr, toRead);
          if (recv <= 0) break;

          let offsetInChunk = 0;
          if (skipped < startDelay) {
            const skipNow = Math.min(recv, startDelay - skipped);
            skipped += skipNow;
            offsetInChunk = skipNow;
          }

          const usable = recv - offsetInChunk;
          if (usable > 0 && write < inputLength) {
            const copyLen = Math.min(usable, inputLength - write);
            for (let c = 0; c < channelCount; c++) {
              const outData = rbApi.memReadF32(channelDataPtr[c], recv);
              outputBuffers[c].set(outData.subarray(offsetInChunk, offsetInChunk + copyLen), write);
            }
            write += copyLen;
          }
        }
      };

      if (startPad > 0) {
        let fed = 0;
        while (fed < startPad) {
          const count = Math.min(samplesRequired, startPad - fed);
          const slice = count === samplesRequired ? zeroChunk : zeroChunk.subarray(0, count);
          for (let c = 0; c < channelCount; c++) {
            rbApi.memWrite(channelDataPtr[c], slice);
          }
          rbApi.rubberband_process(rbState, channelArrayPtr, count, 0);
          tryRetrieve(false);
          fed += count;
        }
      }

      read = 0;
      nextProgress = samplesRequired * 10;
      while (read < inputLength) {
        const remaining = Math.min(samplesRequired, inputLength - read);
        for (let c = 0; c < channelCount; c++) {
          rbApi.memWrite(channelDataPtr[c], channelBuffers[c].subarray(read, read + remaining));
        }
        read += remaining;
        const isFinal = read >= inputLength ? 1 : 0;
        rbApi.rubberband_process(rbState, channelArrayPtr, remaining, isFinal);
        tryRetrieve(Boolean(isFinal));

        if (read >= nextProgress) {
          self.postMessage({ type: 'progress', data: 0.1 + (read / inputLength) * 0.9 });
          nextProgress += samplesRequired * 10;
        }
      }

      const transferList = outputBuffers.map((b) => b.buffer);
      self.postMessage(
        { type: 'success', data: { channelBuffers: outputBuffers } },
        transferList
      );
    } catch (err) {
      self.postMessage({ type: 'error', data: err?.message || String(err) });
    } finally {
      channelDataPtr.forEach((ptr) => rbApi.free(ptr));
      if (channelArrayPtr) rbApi.free(channelArrayPtr);
      if (rbState) rbApi.rubberband_delete(rbState);
    }
  }
};
