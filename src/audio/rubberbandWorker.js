import { RubberBandInterface } from 'rubberband-wasm';

let rbApi = null;

async function init(wasmUrl) {
  if (rbApi) return;
  const wasmResponse = await fetch(wasmUrl);
  const wasmBuffer = await wasmResponse.arrayBuffer();
  const wasmModule = await WebAssembly.compile(wasmBuffer);
  rbApi = await RubberBandInterface.initialize(wasmModule);
  self.postMessage({ type: 'ready' });
}

self.onmessage = async (e) => {
  const { type, data } = e.data;

  if (type === 'init') {
    await init(data.wasmUrl);
    return;
  }

  if (type === 'process') {
    const { channelBuffers, sampleRate, pitch, options } = data;
    
    // Options: 0 is default
    // We want: ProcessOffline (0) | PitchHighQuality (33554432) | EngineFiner (536870912)
    const rbOptions = 0 | 33554432 | 536870912;
    const rbState = rbApi.rubberband_new(sampleRate, channelBuffers.length, rbOptions, 1.0, pitch);
    
    const samplesRequired = rbApi.rubberband_get_samples_required(rbState);
    const channelCount = channelBuffers.length;
    const inputLength = channelBuffers[0].length;
    
    // Allocate memory for pointers to channel data
    const channelArrayPtr = rbApi.malloc(channelCount * 4);
    const channelDataPtr = [];
    for (let c = 0; c < channelCount; c++) {
      const bufferPtr = rbApi.malloc(samplesRequired * 4);
      channelDataPtr.push(bufferPtr);
      rbApi.memWritePtr(channelArrayPtr + c * 4, bufferPtr);
    }

    rbApi.rubberband_set_expected_input_duration(rbState, inputLength);

    // 1. Study phase
    let read = 0;
    while (read < inputLength) {
      const remaining = Math.min(samplesRequired, inputLength - read);
      for (let c = 0; c < channelCount; c++) {
        rbApi.memWrite(channelDataPtr[c], channelBuffers[c].subarray(read, read + remaining));
      }
      read += remaining;
      const isFinal = (read >= inputLength);
      rbApi.rubberband_study(rbState, channelArrayPtr, remaining, isFinal ? 1 : 0);
      
      if (read % (samplesRequired * 10) === 0) {
         self.postMessage({ type: 'progress', data: (read / inputLength) * 0.1 });
      }
    }

    // 2. Process phase
    const outputBuffers = channelBuffers.map(() => new Float32Array(inputLength));
    read = 0;
    let write = 0;

    const tryRetrieve = (isFinal = false) => {
      while (true) {
        const available = rbApi.rubberband_available(rbState);
        if (available < 1 || (!isFinal && available < samplesRequired)) break;
        
        const recv = rbApi.rubberband_retrieve(rbState, channelArrayPtr, Math.min(samplesRequired, available));
        for (let c = 0; c < channelCount; c++) {
          const outData = rbApi.memReadF32(channelDataPtr[c], recv);
          if (write + recv <= outputBuffers[c].length) {
            outputBuffers[c].set(outData, write);
          }
        }
        write += recv;
      }
    };

    while (read < inputLength) {
      const remaining = Math.min(samplesRequired, inputLength - read);
      for (let c = 0; c < channelCount; c++) {
        rbApi.memWrite(channelDataPtr[c], channelBuffers[c].subarray(read, read + remaining));
      }
      read += remaining;
      const isFinal = (read >= inputLength);
      rbApi.rubberband_process(rbState, channelArrayPtr, remaining, isFinal ? 1 : 0);
      tryRetrieve(isFinal);
      
      if (read % (samplesRequired * 10) === 0) {
         self.postMessage({ type: 'progress', data: 0.1 + (read / inputLength) * 0.9 });
      }
    }

    // Cleanup
    channelDataPtr.forEach(ptr => rbApi.free(ptr));
    rbApi.free(channelArrayPtr);
    rbApi.rubberband_delete(rbState);

    self.postMessage({ 
      type: 'success', 
      data: { channelBuffers: outputBuffers } 
    });
  }
};
