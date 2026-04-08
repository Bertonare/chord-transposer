import * as Tone from 'tone';

/**
 * Pitch shifts an AudioBuffer by a given number of semitones
 * using Tone.js Offline rendering.
 * 
 * @param {AudioBuffer} audioBuffer - The original audio buffer
 * @param {number} semitones - Number of semitones to shift (negative for down)
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<AudioBuffer>} - Transposed AudioBuffer
 */
export async function pitchShiftAudio(audioBuffer, semitones, onProgress) {
  if (semitones === 0) return audioBuffer;

  const duration = audioBuffer.duration;
  
  if (onProgress) onProgress(0.1);

  try {
    // Render offline buffer using Tone.js
    const renderedToneBuffer = await Tone.Offline(({ transport }) => {
      // Create a native player that connects to pitch shift
      const player = new Tone.Player(audioBuffer);
      
      const pitchShift = new Tone.PitchShift({
        pitch: semitones,
        windowSize: 0.1,
        delayTime: 0,
        feedback: 0
      });

      player.connect(pitchShift);
      pitchShift.toDestination();
      
      // Explicitly schedule start
      player.start(0);

      // Simulate progress somewhat
      if (onProgress) {
        setTimeout(() => onProgress(0.5), 100); 
      }
    }, duration, audioBuffer.numberOfChannels, audioBuffer.sampleRate);

    if (onProgress) onProgress(1.0);

    // .get() returns the underlying native Web Audio API AudioBuffer
    return renderedToneBuffer.get();
  } catch (err) {
    console.error("Pitch shift failed:", err);
    throw err;
  }
}
