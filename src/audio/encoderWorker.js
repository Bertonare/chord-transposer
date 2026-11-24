import lamejs from 'lamejs';
import MPEGMode from 'lamejs/src/js/MPEGMode.js';
import Lame from 'lamejs/src/js/Lame.js';
import BitStream from 'lamejs/src/js/BitStream.js';

// Polyfill globals expected by legacy CommonJS lamejs inside a Web Worker
globalThis.MPEGMode = MPEGMode;
globalThis.Lame = Lame;
globalThis.BitStream = BitStream;

function encodeWAVBuffer(channelBuffers, sampleRate, length) {
  const numChannels = channelBuffers.length;
  const byteLength = length * numChannels * 2 + 44;
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  let pos = 0;

  const setUint32 = (data) => { view.setUint32(pos, data, true); pos += 4; };
  const setUint16 = (data) => { view.setUint16(pos, data, true); pos += 2; };
  const writeString = (str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(pos++, str.charCodeAt(i));
  };

  writeString('RIFF');
  setUint32(byteLength - 8);
  writeString('WAVE');
  writeString('fmt ');
  setUint32(16);
  setUint16(1); // PCM
  setUint16(numChannels);
  setUint32(sampleRate);
  setUint32(sampleRate * numChannels * 2);
  setUint16(numChannels * 2);
  setUint16(16);
  writeString('data');
  setUint32(byteLength - pos - 4);

  const reportInterval = Math.max(1, Math.floor(length / 20));
  for (let offset = 0; offset < length; offset++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = Math.max(-1, Math.min(1, channelBuffers[c][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    if (offset % reportInterval === 0) {
      self.postMessage({ type: 'progress', data: offset / length });
    }
  }

  return buffer;
}

function encodeMP3Buffer(channelBuffers, sampleRate, length) {
  const channels = channelBuffers.length;
  const kbps = 192;
  const Encoder = lamejs.Mp3Encoder || (lamejs.default && lamejs.default.Mp3Encoder);
  if (!Encoder) throw new Error('Mp3Encoder not found in lamejs module');

  const mp3encoder = new Encoder(channels, sampleRate, kbps);
  const int16Channels = channelBuffers.map((chData) => {
    const int16Data = new Int16Array(chData.length);
    for (let j = 0; j < chData.length; j++) {
      let sample = chData[j];
      sample = sample < 0 ? sample * 32768 : sample * 32767;
      int16Data[j] = Math.max(-32768, Math.min(32767, sample));
    }
    return int16Data;
  });

  const mp3Chunks = [];
  let totalBytes = 0;
  const sampleBlockSize = 1152;
  const reportEvery = sampleBlockSize * 80;

  for (let i = 0; i < length; i += sampleBlockSize) {
    const leftChunk = int16Channels[0].subarray(i, i + sampleBlockSize);
    const rightChunk = channels >= 2 ? int16Channels[1].subarray(i, i + sampleBlockSize) : leftChunk;

    const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) {
      const copy = new Uint8Array(mp3buf.buffer, mp3buf.byteOffset, mp3buf.byteLength).slice();
      mp3Chunks.push(copy);
      totalBytes += copy.byteLength;
    }

    if (i % reportEvery === 0) {
      self.postMessage({ type: 'progress', data: (i / length) * 0.9 });
    }
  }

  const flushBuf = mp3encoder.flush();
  if (flushBuf.length > 0) {
    const copy = new Uint8Array(flushBuf.buffer, flushBuf.byteOffset, flushBuf.byteLength).slice();
    mp3Chunks.push(copy);
    totalBytes += copy.byteLength;
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of mp3Chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined.buffer;
}

self.onmessage = (e) => {
  const { format, channelBuffers, sampleRate, length } = e.data;
  try {
    const outBuffer =
      format === 'mp3'
        ? encodeMP3Buffer(channelBuffers, sampleRate, length)
        : encodeWAVBuffer(channelBuffers, sampleRate, length);

    self.postMessage({ type: 'progress', data: 1.0 });
    self.postMessage({ type: 'success', data: outBuffer }, [outBuffer]);
  } catch (err) {
    self.postMessage({ type: 'error', data: err?.message || String(err) });
  }
};

