/**
 * Draws a static waveform representation of an AudioBuffer onto a canvas.
 */
export function drawWaveform(canvas, audioBuffer, strokeColor = '#8b5cf6') {
  if (!canvas || !audioBuffer) return;

  const ctx = canvas.getContext('2d');
  // Handle high-DPI displays
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  // Set actual size in memory (scaled)
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  const width = canvas.width;
  const height = canvas.height;
  
  ctx.clearRect(0, 0, width, height);

  const data = audioBuffer.getChannelData(0); // Only draw left channel for performance
  const step = Math.ceil(data.length / width);
  const amp = height / 2;

  ctx.fillStyle = strokeColor;
  ctx.beginPath();
  
  // Draw top half
  for (let i = 0; i < width; i++) {
    let min = 1.0;
    let max = -1.0;
    
    // Find min/max in the current chunk
    for (let j = 0; j < step; j++) {
      const idx = (i * step) + j;
      if (idx < data.length) {
        const datum = data[idx];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
    }
    
    const yCen = height / 2;
    const y1 = yCen + (min * amp);
    const y2 = yCen + (max * amp);
    const h = Math.max(1, y2 - y1);
    
    // Slight gap between bars makes it look more premium
    // if we wanted a bar visualizer. For smooth waveform, fillRect per pixel width is fine.
    ctx.fillRect(i, y1, 1.5, h);
  }
}
