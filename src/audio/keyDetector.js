// Krumhansl-Schmuckler key profiles
const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Detects the musical key of an AudioBuffer using the Web Audio API
 * to extract a chromagram, and the Krumhansl-Schmuckler algorithm to find the key.
 */
export async function detectAudioKey(audioBuffer, onProgress) {
  return new Promise((resolve) => {
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;
    // We only need to analyze a portion of the song if it's very long, 
    // but analyzing the whole thing gives better results.
    // To avoid freezing, we'll use an OfflineAudioContext with a ScriptProcessor.

    const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, audioBuffer.length, sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    const analyser = offlineCtx.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.2;

    // Use a ScriptProcessor to capture frames as the offline context renders
    const processor = offlineCtx.createScriptProcessor(8192, 1, 1);
    
    source.connect(analyser);
    analyser.connect(processor);
    processor.connect(offlineCtx.destination);
    
    const chromagram = new Float32Array(12);
    let framesCount = 0;

    processor.onaudioprocess = (e) => {
      // Calculate progress
      if (onProgress) {
        onProgress(e.playbackTime / duration);
      }

      const freqData = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(freqData);

      // Map FFT bins to Chroma
      for (let i = 1; i < freqData.length; i++) {
        // freq = i * sampleRate / fftSize
        const freq = i * sampleRate / analyser.fftSize;
        if (freq < 20 || freq > 5000) continue; // Ignore sub-bass and very high frequencies

        // Calculate midi note: 69 is A4 (440Hz)
        const midiNote = Math.round(12 * Math.log2(freq / 440) + 69);
        const pitchClass = midiNote % 12;
        if (pitchClass >= 0 && pitchClass < 12) {
          // Convert from dB to linear amplitude
          // FloatFrequencyData is in dB (-100 to 0 typical)
          const db = freqData[i];
          if (db > -80) { // arbitrary noise floor threshold
             const linearAmps = Math.pow(10, db / 20);
             chromagram[pitchClass] += linearAmps;
          }
        }
      }
      framesCount++;
    };

    source.start(0);
    
    offlineCtx.startRendering().then(() => {
      if (onProgress) onProgress(1.0);
      
      // Normalizing the chromagram
      let maxVal = 0;
      for (let i = 0; i < 12; i++) {
        if (chromagram[i] > maxVal) maxVal = chromagram[i];
      }
      if (maxVal > 0) {
        for (let i = 0; i < 12; i++) chromagram[i] /= maxVal;
      }

      const result = correlateProfiles(chromagram);
      resolve(result);
    }).catch((err) => {
      console.error("Offline rendering error:", err);
      // Fallback if offline context fails
      resolve(null);
    });
  });
}

function pearsonCorrelation(x, y) {
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  const n = x.length;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }
  const numerator = (n * sumXY) - (sumX * sumY);
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function correlateProfiles(chromagram) {
  let bestKey = null;
  let bestMode = null;
  let maxCorrelation = -1;

  for (let shift = 0; shift < 12; shift++) {
    // shift the chromagram by 'shift' halftones
    const shiftedChroma = [];
    for (let i = 0; i < 12; i++) {
      shiftedChroma[i] = chromagram[(i + shift) % 12];
    }

    // Compare with C major (because we shifted the chroma, comparing with C major effectively compares the unshifted chroma with the shifted key)
    const corrMajor = pearsonCorrelation(shiftedChroma, majorProfile);
    if (corrMajor > maxCorrelation) {
      maxCorrelation = corrMajor;
      bestKey = KEYS[(12 - shift) % 12];
      bestMode = 'major';
    }

    // Compare with C minor
    const corrMinor = pearsonCorrelation(shiftedChroma, minorProfile);
    if (corrMinor > maxCorrelation) {
      maxCorrelation = corrMinor;
      bestKey = KEYS[(12 - shift) % 12];
      bestMode = 'minor';
    }
  }

  // Convert correlation [-1, 1] to a pseudo confidence percentage [0, 100]
  const confidence = Math.max(0, Math.min(100, Math.round((maxCorrelation + 1) / 2 * 100)));

  // If signal was total noise or silence
  if (maxCorrelation < 0.1) {
    return { key: 'C', mode: 'major', confidence: 0, text: 'Unknown' };
  }

  return {
    key: bestKey,
    mode: bestMode,
    confidence: confidence,
    text: `${bestKey} ${bestMode === 'major' ? 'Major' : 'Minor'}`,
    tonic: bestKey
  };
}
