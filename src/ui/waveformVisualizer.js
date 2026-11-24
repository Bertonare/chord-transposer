/**
 * Draws a high-DPI waveform representation of an AudioBuffer onto a canvas,
 * optionally highlighting played progress [0..1] and a playhead cursor.
 */
export function drawWaveform(canvas, audioBuffer, progress = 0, strokeColor = '#8b5cf6') {
  if (!canvas || !audioBuffer) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const data = audioBuffer.getChannelData(0);
  const step = Math.max(1, Math.ceil(data.length / width));
  const amp = height / 2;
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const progressX = Math.round(clampedProgress * width);

  for (let i = 0; i < width; i++) {
    let min = 1.0;
    let max = -1.0;
    const base = i * step;

    for (let j = 0; j < step; j++) {
      const idx = base + j;
      if (idx < data.length) {
        const datum = data[idx];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
    }

    if (min > max) {
      min = 0;
      max = 0;
    }

    const y1 = amp + min * amp;
    const y2 = amp + max * amp;
    const h = Math.max(1.5, y2 - y1);

    ctx.fillStyle = i <= progressX && clampedProgress > 0 ? '#f59e0b' : strokeColor;
    ctx.fillRect(i, y1, 1.5, h);
  }

  if (clampedProgress > 0 && clampedProgress < 1) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(progressX, 0, Math.max(2, dpr * 1.5), height);
  }
}

/**
 * Attaches click-to-seek and resize redraw behavior to a waveform canvas.
 */
export function attachWaveformHandlers(canvas, getAudioBuffer, getProgress, onSeek) {
  if (!canvas) return () => {};

  const handleClick = (e) => {
    const buf = getAudioBuffer();
    if (!buf) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio);
  };

  canvas.addEventListener('click', handleClick);

  let resizeObserver = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      const buf = getAudioBuffer();
      if (buf) drawWaveform(canvas, buf, getProgress());
    });
    resizeObserver.observe(canvas);
  }

  return () => {
    canvas.removeEventListener('click', handleClick);
    if (resizeObserver) resizeObserver.disconnect();
  };
}
