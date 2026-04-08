import { Key } from 'tonal';
import { ALL_KEYS } from './theory.js';

/**
 * For a given target key + capo fret, return what chord shapes to play.
 * Logic: playing shapes in key X with capo on fret N sounds in key (X + N semitones).
 * So: shapeKey = targetKeyIndex - capoFret (mod 12).
 */
function getShapeKey(targetTonic, capoFret, mode = 'major') {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const flatMap = { 'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B' };
  const normalized = flatMap[targetTonic] || targetTonic;
  const idx = notes.indexOf(normalized);
  if (idx === -1) return null;
  const shapeIdx = ((idx - capoFret) % 12 + 12) % 12;
  return notes[shapeIdx];
}

/**
 * Get guitar-friendly open chord shapes for common keys.
 */
function getOpenChords(shapeKey, mode = 'major') {
  try {
    if (mode === 'major') {
      const k = Key.majorKey(shapeKey);
      return k.triads ? k.triads.slice(0, 4).join('  ') : shapeKey;
    } else {
      const k = Key.minorKey(shapeKey);
      return k.natural?.triads ? k.natural.triads.slice(0, 4).join('  ') : `${shapeKey}m`;
    }
  } catch {
    return shapeKey;
  }
}

/**
 * Calculate capo positions for a target key.
 * Returns capo positions 0-7 with the chord shapes to play.
 */
export function calcCapo(targetKey, mode = 'major') {
  if (!targetKey) return [];
  const results = [];
  // Guitar-friendly capo range: 0-7
  for (let capo = 0; capo <= 7; capo++) {
    const shapeKey = getShapeKey(targetKey, capo, mode);
    if (!shapeKey) continue;
    const chords = getOpenChords(shapeKey, mode);
    results.push({
      capo,
      shapeKey,
      shapeMode: mode,
      chords,
      label: capo === 0 ? 'No Capo' : `Capo ${capo}`,
    });
  }
  return results;
}
