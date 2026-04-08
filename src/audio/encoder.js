import lamejs from 'lamejs';

/**
 * Encodes an AudioBuffer to a WAV Blob.
 */
export async function encodeWAV(audioBuffer, onProgress) {
  return new Promise((resolve) => {
    if (onProgress) onProgress(0);
    
    setTimeout(() => {
      const length = audioBuffer.length * audioBuffer.numberOfChannels * 2 + 44;
      const buffer = new ArrayBuffer(length);
      const view = new DataView(buffer);
      const channels = [], sampleRate = audioBuffer.sampleRate;
      let offset = 0, pos = 0;

      // write WAV header
      const setUint32 = (data) => { view.setUint32(pos, data, true); pos += 4; };
      const setUint16 = (data) => { view.setUint16(pos, data, true); pos += 2; };
      const writeString = (name) => { for (let i = 0; i < name.length; i++) { view.setUint8(pos++, name.charCodeAt(i)); } };

      writeString('RIFF');
      setUint32(length - 8);
      writeString('WAVE');
      writeString('fmt ');
      setUint32(16);
      setUint16(1); // PCM
      setUint16(audioBuffer.numberOfChannels);
      setUint32(sampleRate);
      setUint32(sampleRate * audioBuffer.numberOfChannels * 2);
      setUint16(audioBuffer.numberOfChannels * 2);
      setUint16(16);
      writeString('data');
      setUint32(length - pos - 4);

      // write interleaved data
      for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        channels.push(audioBuffer.getChannelData(i));
      }

      while (offset < audioBuffer.length) {
        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
          let sample = Math.max(-1, Math.min(1, channels[i][offset]));
          sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          view.setInt16(pos, sample, true);
          pos += 2;
        }
        offset++;
      }

      const blob = new Blob([buffer], { type: 'audio/wav' });
      if (onProgress) onProgress(1.0);
      resolve(blob);
    }, 10);
  });
}

/**
 * Encodes an AudioBuffer to an MP3 Blob using lamejs.
 */
export async function encodeMP3(audioBuffer, onProgress) {
  return new Promise((resolve, reject) => {
    if (onProgress) onProgress(0);

    // We use setTimeout to avoid blocking the UI thread entirely 
    // for small buffers, though ideally this is Web Worker territory.
    setTimeout(() => {
      try {
        const channels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const kbps = 192; // default high quality
        const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
        const mp3Data = [];

        const samplesContext = [];
        for (let i = 0; i < channels; i++) {
          const channelData = audioBuffer.getChannelData(i);
          // Convert Float32 [-1.0, 1.0] to Int16 [-32768, 32767]
          const int16Data = new Int16Array(channelData.length);
          for (let j = 0; j < channelData.length; j++) {
            let sample = channelData[j];
            sample = sample < 0 ? sample * 32768 : sample * 32767;
            int16Data[j] = Math.max(-32768, Math.min(32767, sample));
          }
          samplesContext.push(int16Data);
        }

        const sampleBlockSize = 1152; // multiple of 576
        const numBlocks = Math.ceil(samplesContext[0].length / sampleBlockSize);

        for (let i = 0; i < samplesContext[0].length; i += sampleBlockSize) {
          const leftChunk = samplesContext[0].subarray(i, i + sampleBlockSize);
          let rightChunk = null;
          
          if (channels === 2) {
            rightChunk = samplesContext[1].subarray(i, i + sampleBlockSize);
          }

          const mp3buf = channels === 2
            ? mp3encoder.encodeBuffer(leftChunk, rightChunk)
            : mp3encoder.encodeBuffer(leftChunk);

          if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
          }

          // Very rough progress approximation
          if (onProgress && i % (sampleBlockSize * 100) === 0) {
            const progress = i / samplesContext[0].length;
             onProgress(progress * 0.9); // reserve 10% for flush
          }
        }

        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }

        const blob = new Blob(mp3Data, { type: 'audio/mp3' });
        if (onProgress) onProgress(1.0);
        resolve(blob);

      } catch (e) {
        console.error("MP3 Encoding error:", e);
        reject(e);
      }
    }, 10);
  });
}

/**
 * Utility to trigger download of a generated Blob.
 */
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
