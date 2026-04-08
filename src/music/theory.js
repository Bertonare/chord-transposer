import { Chord, Key, Interval, Note } from 'tonal';

// All 12 chromatic note names (sharps + flats)
export const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_NOTES  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const SHARP_KEYS  = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
export const FLAT_KEYS   = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];

// 24 keys for UI (12 major, shown with preferred notation)
export const ALL_KEYS = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'
];

export function keyPrefersSharps(key) {
  return SHARP_KEYS.includes(key);
}

/**
 * Transpose a single chord symbol by `semitones` steps.
 * Handles enharmonics based on target key preference.
 */
export function transposeChord(chordSymbol, semitones, useFlats = false) {
  if (!chordSymbol || semitones === 0) return chordSymbol;
  const interval = Interval.fromSemitones(semitones);
  const result = Chord.transpose(chordSymbol, interval);
  if (!result) return chordSymbol;
  if (useFlats) return toFlatSpelling(result);
  return result;
}

/**
 * Convert a chord/note to use flat notation (e.g., C# → Db).
 */
export function toFlatSpelling(chordSymbol) {
  const chord = Chord.get(chordSymbol);
  if (!chord.tonic) return chordSymbol;
  const flatNote = Note.enharmonic(chord.tonic) || chord.tonic;
  const isFlatNote = flatNote?.includes('b') || !flatNote?.includes('#');
  // Prefer the flat enharmonic if it looks like a flat
  const root = FLAT_NOTES.includes(chord.tonic) ? chord.tonic
    : (FLAT_NOTES.includes(Note.enharmonic(chord.tonic)) ? Note.enharmonic(chord.tonic) : chord.tonic);
  return root + (chord.aliases[0] || chord.type || '');
}

/**
 * Detect the most likely key from a list of chord symbols using frequency matching.
 */
export function detectKeyFromChords(chordSymbols) {
  if (!chordSymbols || chordSymbols.length === 0) return null;

  // Get unique roots from the chords
  const roots = chordSymbols.map(c => {
    const ch = Chord.get(c);
    return ch.tonic;
  }).filter(Boolean);

  if (roots.length === 0) return null;

  let bestKey = null;
  let bestScore = -1;

  // Test all 12 major and 12 minor keys
  for (const tonic of ALL_KEYS) {
    const majorKey = Key.majorKey(tonic);
    const minorKey = Key.minorKey(tonic);

    const majorRoots = majorKey.scale || [];
    const minorRoots = minorKey.natural?.scale || [];

    let majorScore = roots.filter(r => majorRoots.some(s => Note.enharmonic(r) === s || r === s)).length;
    let minorScore = roots.filter(r => minorRoots.some(s => Note.enharmonic(r) === s || r === s)).length;

    if (majorScore > bestScore) { bestScore = majorScore; bestKey = { tonic, mode: 'major' }; }
    if (minorScore > bestScore) { bestScore = minorScore; bestKey = { tonic, mode: 'minor' }; }
  }

  if (!bestKey) return null;
  return {
    ...bestKey,
    display: bestKey.mode === 'major' ? bestKey.tonic : `${bestKey.tonic}m`,
    fullDisplay: `${bestKey.tonic} ${bestKey.mode === 'major' ? 'Major' : 'Minor'}`,
  };
}

/**
 * Extract chord tokens from free-form text using Tonal validation.
 */
export function extractChordsFromText(text) {
  const chords = [];
  // Match potential chord tokens: capital A-G, optionally #/b, then chord suffix
  const tokens = text.match(/(?<=^|\s|\[|<|\/|\()([A-G][b#]?(?:m(?:aj)?|M|aug(?:5)?|dim(?:7)?|sus[24]?|add)?(?:(?:maj|M)?(?:2|4|5|6|7|9|11|13))?(?:[b#]\d+)*(?:\/[A-G][b#]?)?)(?=$|\s|\]|>|\/|\)|,|\.|!|\?)/g) || [];
  for (const token of tokens) {
    const chord = Chord.get(token);
    if (chord.tonic && !chords.includes(token)) {
      chords.push(token);
    }
  }
  return chords;
}

/**
 * Calculate semitone distance between two keys.
 */
export function getSemitoneDelta(fromKey, toKey) {
  const fromIdx = SHARP_NOTES.indexOf(fromKey) !== -1
    ? SHARP_NOTES.indexOf(fromKey)
    : FLAT_NOTES.indexOf(fromKey);
  const toIdx = SHARP_NOTES.indexOf(toKey) !== -1
    ? SHARP_NOTES.indexOf(toKey)
    : FLAT_NOTES.indexOf(toKey);
  if (fromIdx === -1 || toIdx === -1) return 0;
  let delta = toIdx - fromIdx;
  if (delta > 6) delta -= 12;
  if (delta < -6) delta += 12;
  return delta;
}
