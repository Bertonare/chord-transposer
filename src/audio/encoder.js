function runEncoderWorker(format, audioBuffer, onProgress) {
  const channelBuffers = [];
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    channelBuffers.push(new Float32Array(audioBuffer.getChannelData(c)));
  }

  const mimeType = format === 'mp3' ? 'audio/mpeg' : 'audio/wav';

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./encoderWorker.js', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (e) => {
      const { type, data } = e.data;
      if (type === 'progress') {
        if (onProgress) onProgress(data);
      } else if (type === 'success') {
        worker.terminate();
        resolve(new Blob([data], { type: mimeType }));
      } else if (type === 'error') {
        worker.terminate();
        reject(new Error(data));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err instanceof Error ? err : new Error(err?.message || 'Encoder worker error'));
    };

    const transferList = channelBuffers.map((b) => b.buffer);
    worker.postMessage(
      {
        format,
        channelBuffers,
        sampleRate: audioBuffer.sampleRate,
        length: audioBuffer.length,
      },
      transferList
    );
  });
}

export function encodeWAV(audioBuffer, onProgress) {
  return runEncoderWorker('wav', audioBuffer, onProgress);
}

export function encodeMP3(audioBuffer, onProgress) {
  return runEncoderWorker('mp3', audioBuffer, onProgress);
}

export function triggerDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}
