import { Key, Chord } from 'tonal';
import { SHARP_NOTES, keyPrefersFlats, transposeChord } from './theory.js';

const OPEN_FRIENDLY_ROOTS = new Set(['C', 'A', 'G', 'E', 'D']);

function getShapeKey(targetTonic, capoFret) {
  const flatMap = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B' };
  const normalized = flatMap[targetTonic] || targetTonic;
  const idx = SHARP_NOTES.indexOf(normalized);
  if (idx === -1) return null;
  const shapeIdx = ((idx - capoFret) % 12 + 12) % 12;
  return SHARP_NOTES[shapeIdx];
}

function getOpenChords(shapeKey, mode = 'major') {
  try {
    if (mode === 'major') {
      const k = Key.majorKey(shapeKey);
      return k.triads ? k.triads.slice(0, 4).join('  ') : shapeKey;
    }
    const k = Key.minorKey(shapeKey);
    return k.natural?.triads ? k.natural.triads.slice(0, 4).join('  ') : `${shapeKey}m`;
  } catch {
    return shapeKey;
  }
}

function scoreChordPlayability(chords) {
  if (!chords.length) return 0;
  let score = 0;
  for (const sym of chords) {
    const c = Chord.get(sym);
    const root = c.tonic || '';
    if (!root.includes('#') && !root.includes('b') && OPEN_FRIENDLY_ROOTS.has(root)) {
      score += 2;
    } else if (!root.includes('#') && !root.includes('b')) {
      score += 1;
    }
  }
  return score;
}

/**
 * Calculate capo positions (0-7) for a target key.
 * If `songChords` (in the target key) are supplied, shows the actual transposed shapes
 * and flags the easiest open-chord position as `recommended`.
 */
export function calcCapo(targetKey, mode = 'major', songChords = []) {
  if (!targetKey) return [];
  const results = [];

  for (let capo = 0; capo <= 7; capo++) {
    const shapeKey = getShapeKey(targetKey, capo);
    if (!shapeKey) continue;

    const accidental = keyPrefersFlats(shapeKey) ? 'b' : '#';
    const mappedSongChords = songChords.length > 0
      ? [...new Set(songChords.map((c) => transposeChord(c, -capo, accidental)))]
      : [];

    const chords = mappedSongChords.length > 0
      ? mappedSongChords.slice(0, 6).join('  ')
      : getOpenChords(shapeKey, mode);

    const score = scoreChordPlayability(
      mappedSongChords.length > 0 ? mappedSongChords : chords.split(/\s+/)
    ) - capo * 0.1;

    results.push({
      capo,
      shapeKey,
      shapeMode: mode,
      chords,
      score,
      recommended: false,
    });
  }

  if (results.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < results.length; i++) {
      if (results[i].score > results[bestIdx].score) bestIdx = i;
    }
    results[bestIdx].recommended = true;
  }

  return results;
}
