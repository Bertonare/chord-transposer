import ChordSheetJS from 'chordsheetjs';
import { Chord } from 'tonal';
import { createChordTokenRegex, transposeChord } from './theory.js';

/**
 * Determine if text is ChordPro format ([Am]Hello [F]world)
 */
export function isChordProFormat(text) {
  return /\[[A-G][b#]?(?:m(?:aj)?|M|aug(?:5)?|dim(?:7)?|sus[24]?|add)?(?:(?:maj|M)?(?:2|4|5|6|7|9|11|13))?(?:[b#]\d+)*(?:\/[A-G][b#]?)?\]/.test(text);
}

/**
 * Resolve accidental option ('b' | '#' | null) from boolean or string input.
 */
function normalizeAccidentalOption(accidentalPref) {
  if (accidentalPref === true || accidentalPref === 'b' || accidentalPref === 'flats') return 'b';
  if (accidentalPref === '#' || accidentalPref === 'sharps') return '#';
  return null;
}

/**
 * Transpose a full chord sheet by semitones.
 * `accidentalPref`: 'b' | '#' | null (or boolean for backward compatibility)
 */
export function transposeSheet(text, semitones, accidentalPref = null, format = 'auto') {
  if (!text.trim()) return text;
  const accidental = normalizeAccidentalOption(accidentalPref);
  if (semitones === 0 && !accidental) return text;

  try {
    const chordProMode = format === 'chordpro' || (format === 'auto' && isChordProFormat(text));
    const parser = chordProMode
      ? new ChordSheetJS.ChordProParser()
      : new ChordSheetJS.ChordsOverWordsParser({ preserveWhitespace: true });
    const formatter = chordProMode
      ? new ChordSheetJS.ChordProFormatter()
      : new ChordSheetJS.TextFormatter();

    let song = parser.parse(text);
    if (semitones !== 0) {
      song = song.transpose(semitones, { accidental });
    } else if (accidental) {
      song = song.useAccidental(accidental);
    }
    return formatter.format(song);
  } catch {
    return transposeRegex(text, semitones, accidental);
  }
}

/**
 * Regex-based fallback transposer using Tonal.
 */
function transposeRegex(text, semitones, accidental) {
  return text.replace(createChordTokenRegex(), (match) => {
    const chord = Chord.get(match);
    if (!chord.tonic) return match;
    return transposeChord(match, semitones, accidental);
  });
}

/**
 * Highlight chord tokens in plain text with HTML spans.
 * Returns HTML string with <span class="chord-token">X</span> wrappers.
 */
export function highlightChordsInText(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped.replace(createChordTokenRegex(), (match) => {
    const chord = Chord.get(match);
    if (!chord.tonic) return match;
    return `<span class="chord-token">${match}</span>`;
  });
}
