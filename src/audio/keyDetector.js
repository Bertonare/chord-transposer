/**
 * Detects the musical key of an AudioBuffer inside a Web Worker
 * using a Hann-windowed FFT chromagram and Krumhansl-Schmuckler profile matching.
 */
export async function detectAudioKey(audioBuffer, onProgress) {
  const length = audioBuffer.length;
  const channels = audioBuffer.numberOfChannels;
  const monoSamples = new Float32Array(length);

  // Mix down to mono
  for (let c = 0; c < channels; c++) {
    const chData = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      monoSamples[i] += chData[i] / channels;
    }
  }

  return new Promise((resolve) => {
    const worker = new Worker(new URL('./keyDetectorWorker.js', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (e) => {
      const { type, data } = e.data;
      if (type === 'progress') {
        if (onProgress) onProgress(data);
      } else if (type === 'success') {
        worker.terminate();
        resolve(data);
      } else if (type === 'error') {
        console.error('Key detection worker error:', data);
        worker.terminate();
        resolve(null);
      }
    };

    worker.onerror = (err) => {
      console.error('Key detection error:', err);
      worker.terminate();
      resolve(null);
    };

    worker.postMessage(
      { monoSamples, sampleRate: audioBuffer.sampleRate },
      [monoSamples.buffer]
    );
  });
}
