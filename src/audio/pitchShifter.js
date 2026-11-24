/**
 * Resample an AudioBuffer to `targetSampleRate` using OfflineAudioContext.
 */
async function resampleAudioBuffer(audioBuffer, targetSampleRate) {
  if (!targetSampleRate || targetSampleRate === audioBuffer.sampleRate) {
    return audioBuffer;
  }
  const targetLength = Math.max(
    1,
    Math.round((audioBuffer.length * targetSampleRate) / audioBuffer.sampleRate)
  );
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const offlineCtx = new OfflineCtx(audioBuffer.numberOfChannels, targetLength, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  return offlineCtx.startRendering();
}

/**
 * Pitch shifts an AudioBuffer by a given number of semitones
 * using Rubber Band (WASM) in a Web Worker, optionally resampling afterwards.
 *
 * @param {AudioBuffer} audioBuffer
 * @param {number} semitones
 * @param {Function} onProgress
 * @param {number} [targetSampleRate]
 * @returns {Promise<AudioBuffer>}
 */
export async function pitchShiftAudio(audioBuffer, semitones, onProgress, targetSampleRate) {
  const finalSampleRate = targetSampleRate || audioBuffer.sampleRate;

  if (semitones === 0) {
    if (onProgress) onProgress(1.0);
    return resampleAudioBuffer(audioBuffer, finalSampleRate);
  }

  const pitchScale = Math.pow(2, semitones / 12);
  const channelCount = audioBuffer.numberOfChannels;
  const channelBuffers = [];
  for (let c = 0; c < channelCount; c++) {
    channelBuffers.push(new Float32Array(audioBuffer.getChannelData(c)));
  }

  const shiftedBuffer = await new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./rubberbandWorker.js', import.meta.url), {
      type: 'module'
    });

    worker.onmessage = (e) => {
      const { type, data } = e.data;

      if (type === 'ready') {
        const transferList = channelBuffers.map((b) => b.buffer);
        worker.postMessage(
          {
            type: 'process',
            data: {
              channelBuffers,
              sampleRate: audioBuffer.sampleRate,
              pitch: pitchScale,
            }
          },
          transferList
        );
      } else if (type === 'progress') {
        if (onProgress) onProgress(data);
      } else if (type === 'success') {
        const resultBuffers = data.channelBuffers;
        const newBuffer = new AudioBuffer({
          length: resultBuffers[0].length,
          numberOfChannels: channelCount,
          sampleRate: audioBuffer.sampleRate
        });

        for (let c = 0; c < channelCount; c++) {
          newBuffer.copyToChannel(resultBuffers[c], c);
        }

        worker.terminate();
        resolve(newBuffer);
      } else if (type === 'error') {
        worker.terminate();
        reject(new Error(data));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err instanceof Error ? err : new Error(err?.message || 'Worker error'));
    };

    const wasmUrl = new URL(`${import.meta.env.BASE_URL}rubberband.wasm`, window.location.href).href;
    worker.postMessage({
      type: 'init',
      data: { wasmUrl }
    });
  });

  return resampleAudioBuffer(shiftedBuffer, finalSampleRate);
}
