const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const FFT_SIZE = 8192;

// Precompute Hann window and bit-reversal / twiddle tables for FFT_SIZE
const hannWindow = new Float32Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i++) {
  hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
}

function fftReal(re, im) {
  const n = re.length;
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      let tmp = re[i]; re[i] = re[j]; re[j] = tmp;
      tmp = im[i]; im[i] = im[j]; im[j] = tmp;
    }
  }

  // Cooley-Tukey butterfly
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepRe = Math.cos(angle);
    const wStepIm = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let j = 0; j < half; j++) {
        const uIdx = i + j;
        const vIdx = uIdx + half;
        const tRe = re[vIdx] * wRe - im[vIdx] * wIm;
        const tIm = re[vIdx] * wIm + im[vIdx] * wRe;
        re[vIdx] = re[uIdx] - tRe;
        im[vIdx] = im[uIdx] - tIm;
        re[uIdx] += tRe;
        im[uIdx] += tIm;

        const nextWRe = wRe * wStepRe - wIm * wStepIm;
        wIm = wRe * wStepIm + wIm * wStepRe;
        wRe = nextWRe;
      }
    }
  }
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
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function correlateProfiles(chromagram) {
  let bestKey = null;
  let bestMode = null;
  let maxCorrelation = -1;

  for (let shift = 0; shift < 12; shift++) {
    const shiftedChroma = new Array(12);
    for (let i = 0; i < 12; i++) {
      shiftedChroma[i] = chromagram[(i + shift) % 12];
    }

    const corrMajor = pearsonCorrelation(shiftedChroma, MAJOR_PROFILE);
    if (corrMajor > maxCorrelation) {
      maxCorrelation = corrMajor;
      bestKey = KEYS[(12 - shift) % 12];
      bestMode = 'major';
    }

    const corrMinor = pearsonCorrelation(shiftedChroma, MINOR_PROFILE);
    if (corrMinor > maxCorrelation) {
      maxCorrelation = corrMinor;
      bestKey = KEYS[(12 - shift) % 12];
      bestMode = 'minor';
    }
  }

  const confidence = Math.max(0, Math.min(100, Math.round(((maxCorrelation + 1) / 2) * 100)));

  if (maxCorrelation < 0.1 || !bestKey) {
    return { key: null, mode: 'major', confidence: 0, tonic: null };
  }

  return {
    key: bestKey,
    mode: bestMode,
    confidence,
    tonic: bestKey,
  };
}

self.onmessage = (e) => {
  try {
    const { monoSamples, sampleRate } = e.data;
    const totalSamples = monoSamples.length;

    if (totalSamples < FFT_SIZE) {
      self.postMessage({
        type: 'success',
        data: { key: null, mode: 'major', confidence: 0, tonic: null },
      });
      return;
    }

    // Cap total analyzed frames to ~200 evenly spaced windows so long songs finish in <150ms
    const totalPossibleWindows = Math.floor((totalSamples - FFT_SIZE) / FFT_SIZE) + 1;
    const maxWindows = 200;
    const windowStride = Math.max(1, Math.floor(totalPossibleWindows / maxWindows));
    const stepSamples = FFT_SIZE * windowStride;

    const minBin = Math.max(1, Math.floor((55 * FFT_SIZE) / sampleRate));
    const maxBin = Math.min(FFT_SIZE / 2 - 1, Math.ceil((2000 * FFT_SIZE) / sampleRate));

    // Precompute pitch class for each relevant FFT bin
    const binPitchClass = new Int8Array(maxBin + 1);
    for (let bin = minBin; bin <= maxBin; bin++) {
      const freq = (bin * sampleRate) / FFT_SIZE;
      const midi = Math.round(12 * Math.log2(freq / 440) + 69);
      binPitchClass[bin] = ((midi % 12) + 12) % 12;
    }

    const chromagram = new Float64Array(12);
    const re = new Float32Array(FFT_SIZE);
    const im = new Float32Array(FFT_SIZE);

    let processed = 0;
    const expectedSteps = Math.ceil((totalSamples - FFT_SIZE + 1) / stepSamples);

    for (let pos = 0; pos + FFT_SIZE <= totalSamples; pos += stepSamples) {
      for (let i = 0; i < FFT_SIZE; i++) {
        re[i] = monoSamples[pos + i] * hannWindow[i];
        im[i] = 0;
      }

      fftReal(re, im);

      for (let bin = minBin; bin <= maxBin; bin++) {
        const mag = Math.hypot(re[bin], im[bin]) / FFT_SIZE;
        if (mag > 0.0001) {
          chromagram[binPitchClass[bin]] += mag;
        }
      }

      processed++;
      if (processed % 15 === 0) {
        self.postMessage({ type: 'progress', data: Math.min(0.95, processed / expectedSteps) });
      }
    }

    let maxVal = 0;
    for (let i = 0; i < 12; i++) {
      if (chromagram[i] > maxVal) maxVal = chromagram[i];
    }
    const normalized = new Float32Array(12);
    if (maxVal > 0) {
      for (let i = 0; i < 12; i++) normalized[i] = chromagram[i] / maxVal;
    }

    const result = correlateProfiles(normalized);
    self.postMessage({ type: 'progress', data: 1.0 });
    self.postMessage({ type: 'success', data: result });
  } catch (err) {
    self.postMessage({ type: 'error', data: err?.message || String(err) });
  }
};

