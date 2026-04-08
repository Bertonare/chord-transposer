import ChordSheetJS from 'chordsheetjs';
import { Chord, Interval } from 'tonal';
import { keyPrefersSharps } from './theory.js';

/**
 * Determine if text is ChordPro format ([Am]Hello [F]world)
 */
function isChordProFormat(text) {
  return /\[[A-G][^\]]*\]/.test(text);
}

/**
 * Transpose a full chord sheet by semitones.
 * Auto-detects ChordPro vs plain text format.
 * Falls back to regex-based transposition if ChordSheetJS fails.
 */
export function transposeSheet(text, semitones, useFlats = false) {
  if (!text.trim() || semitones === 0) return text;

  // --- Try ChordSheetJS first ---
  try {
    const chordProMode = isChordProFormat(text);
    let parser, formatter;

    if (chordProMode) {
      parser = new ChordSheetJS.ChordProParser();
      formatter = new ChordSheetJS.ChordProFormatter();
    } else {
      parser = new ChordSheetJS.ChordsOverWordsParser({ preserveWhitespace: true });
      formatter = new ChordSheetJS.TextFormatter();
    }

    const song = parser.parse(text);
    const transposed = song.transpose(semitones, { useFlats });
    return formatter.format(transposed);
  } catch (e) {
    // --- Fallback: regex-based transposition using Tonal ---
    return transposeRegex(text, semitones, useFlats);
  }
}

/**
 * Regex-based fallback transposer.
 * Matches chord tokens in text and transposes each with Tonal.
 */
function transposeRegex(text, semitones, useFlats) {
  const interval = Interval.fromSemitones(semitones);
  // Match chord tokens: C, Am, Bm7, F#maj7, G/B, etc.
  return text.replace(
    /(?<=^|\s|\[|<|\/|\()([A-G][b#]?(?:m(?:aj)?|M|aug(?:5)?|dim(?:7)?|sus[24]?|add)?(?:(?:maj|M)?(?:2|4|5|6|7|9|11|13))?(?:[b#]\d+)*(?:\/[A-G][b#]?)?)(?=$|\s|\]|>|\/|\)|,|\.|!|\?)/g,
    (match) => {
      // Validate with Tonal
      const chord = Chord.get(match);
      if (!chord.tonic) return match;
      const transposed = Chord.transpose(match, interval);
      if (!transposed) return match;
      if (useFlats) return toFlat(transposed);
      return transposed;
    }
  );
}

function toFlat(chordSymbol) {
  // Replace sharp enharmonics with flat equivalents
  return chordSymbol
    .replace(/A#/, 'Bb')
    .replace(/C#/, 'Db')
    .replace(/D#/, 'Eb')
    .replace(/F#/, 'Gb')
    .replace(/G#/, 'Ab');
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

  return escaped.replace(
    /(?<=^|\s|\[|<|\/|\()([A-G][b#]?(?:m(?:aj)?|M|aug(?:5)?|dim(?:7)?|sus[24]?|add)?(?:(?:maj|M)?(?:2|4|5|6|7|9|11|13))?(?:[b#]\d+)*(?:\/[A-G][b#]?)?)(?=$|\s|\]|>|\/|\)|,|\.|!|\?)/g,
    (match) => {
      const chord = Chord.get(match);
      if (!chord.tonic) return match;
      return `<span class="chord-token">${match}</span>`;
    }
  );
}
