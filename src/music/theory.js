import { Chord, Interval, Note } from 'tonal';

export const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_NOTES  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const SHARP_KEYS  = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
export const FLAT_KEYS   = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];

export const ALL_KEYS = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'
];

export const CHORD_TOKEN_PATTERN =
  '(?<=^|\\s|\\[|<|\\/|\\()([A-G][b#]?(?:m(?:aj)?|M|aug(?:5)?|dim(?:7)?|sus[24]?|add)?(?:(?:maj|M)?(?:2|4|5|6|7|9|11|13))?(?:[b#]\\d+)*(?:\\/[A-G][b#]?)?)(?=$|\\s|\\]|>|\\/|\\)|,|\\.|!|\\?)';

export function createChordTokenRegex() {
  return new RegExp(CHORD_TOKEN_PATTERN, 'g');
}

export function keyPrefersSharps(key) {
  return SHARP_KEYS.includes(key);
}

export function keyPrefersFlats(key) {
  return FLAT_KEYS.includes(key);
}

function noteToAccidental(note, preferFlats) {
  if (!note) return note;
  const targetList = preferFlats ? FLAT_NOTES : SHARP_NOTES;
  if (targetList.includes(note)) return note;
  const enh = Note.enharmonic(note);
  if (enh && targetList.includes(enh)) return enh;
  const chroma = Note.chroma(note);
  return chroma !== null && chroma !== undefined ? targetList[chroma] : note;
}

/**
 * Convert a chord symbol (including slash bass) to flat or sharp notation.
 */
export function applyAccidentalSpelling(chordSymbol, preferFlats) {
  if (!chordSymbol) return chordSymbol;
  const [main, bass] = chordSymbol.split('/');
  const match = main.match(/^([A-G][b#]?)(.*)$/);
  if (!match) return chordSymbol;
  const spelledRoot = noteToAccidental(match[1], preferFlats);
  const spelledBass = bass ? `/${noteToAccidental(bass, preferFlats)}` : '';
  return `${spelledRoot}${match[2]}${spelledBass}`;
}

export function toFlatSpelling(chordSymbol) {
  return applyAccidentalSpelling(chordSymbol, true);
}

export function toSharpSpelling(chordSymbol) {
  return applyAccidentalSpelling(chordSymbol, false);
}

/**
 * Transpose a single chord symbol by `semitones` steps.
 * `accidental`: 'b' | '#' | null
 */
export function transposeChord(chordSymbol, semitones, accidental = null) {
  if (!chordSymbol) return chordSymbol;
  let result = chordSymbol;
  if (semitones !== 0) {
    const interval = Interval.fromSemitones(semitones);
    result = Chord.transpose(chordSymbol, interval) || chordSymbol;
  }
  if (accidental === 'b' || accidental === true) return toFlatSpelling(result);
  if (accidental === '#') return toSharpSpelling(result);
  return result;
}

const MAJOR_DEGREES = new Map([
  [0, ['Major']],
  [2, ['Minor']],
  [4, ['Minor']],
  [5, ['Major']],
  [7, ['Major']],
  [9, ['Minor']],
  [11, ['Diminished']],
]);

const MINOR_DEGREES = new Map([
  [0, ['Minor']],
  [2, ['Diminished']],
  [3, ['Major']],
  [5, ['Minor']],
  [7, ['Minor', 'Major']], // natural v or harmonic V
  [8, ['Major']],
  [10, ['Major']],
  [11, ['Diminished']],
]);

function getChordQualityCategory(chord) {
  if (chord.quality === 'Minor') return 'Minor';
  if (chord.quality === 'Diminished') return 'Diminished';
  return 'Major';
}

/**
 * Detect the most likely key from chord occurrences (preserving order and frequency).
 */
export function detectKeyFromChords(chordSymbols) {
  if (!chordSymbols || chordSymbols.length === 0) return null;

  const parsed = chordSymbols
    .map((sym) => {
      const ch = Chord.get(sym);
      const chroma = ch.tonic ? Note.chroma(ch.tonic) : null;
      if (chroma === null || chroma === undefined) return null;
      return {
        chroma,
        quality: getChordQualityCategory(ch),
      };
    })
    .filter(Boolean);

  if (parsed.length === 0) return null;

  let bestKey = null;
  let bestScore = -Infinity;

  for (const tonic of ALL_KEYS) {
    const tonicChroma = Note.chroma(tonic);
    if (tonicChroma === null || tonicChroma === undefined) continue;

    for (const mode of ['major', 'minor']) {
      const degreeMap = mode === 'major' ? MAJOR_DEGREES : MINOR_DEGREES;
      const tonicQuality = mode === 'major' ? 'Major' : 'Minor';
      let score = 0;

      parsed.forEach((ch, idx) => {
        const degree = (ch.chroma - tonicChroma + 12) % 12;
        const expectedQualities = degreeMap.get(degree);

        if (expectedQualities) {
          if (expectedQualities.includes(ch.quality)) {
            if (degree === 0) score += 3.0;
            else if (degree === 7) score += 1.5;
            else score += 1.2;
          } else {
            score += 0.4;
          }
        } else {
          score -= 0.5;
        }

        if (idx === 0 && degree === 0 && ch.quality === tonicQuality) {
          score += 2.0;
        }
        if (idx === parsed.length - 1 && degree === 0 && ch.quality === tonicQuality) {
          score += 2.0;
        }
      });

      if (score > bestScore) {
        bestScore = score;
        bestKey = { tonic, mode };
      }
    }
  }

  if (!bestKey) return null;
  return {
    ...bestKey,
    display: bestKey.mode === 'major' ? bestKey.tonic : `${bestKey.tonic}m`,
    fullDisplay: `${bestKey.tonic} ${bestKey.mode === 'major' ? 'Major' : 'Minor'}`,
  };
}

/**
 * Extract all chord occurrences in order from free-form text using Tonal validation.
 */
export function extractChordOccurrences(text) {
  if (!text) return [];
  const chords = [];
  const tokens = text.match(createChordTokenRegex()) || [];
  for (const token of tokens) {
    const chord = Chord.get(token);
    if (chord.tonic) {
      chords.push(token);
    }
  }
  return chords;
}

/**
 * Extract unique chord tokens from free-form text using Tonal validation.
 */
export function extractChordsFromText(text) {
  return [...new Set(extractChordOccurrences(text))];
}

/**
 * Calculate shortest semitone distance (-6..+6) between two keys.
 */
export function getSemitoneDelta(fromKey, toKey) {
  const fromChroma = Note.chroma(fromKey);
  const toChroma = Note.chroma(toKey);
  if (fromChroma === null || fromChroma === undefined || toChroma === null || toChroma === undefined) {
    return 0;
  }
  let delta = toChroma - fromChroma;
  if (delta > 6) delta -= 12;
  if (delta < -6) delta += 12;
  return delta;
}
