import test from 'node:test';
import assert from 'node:assert/strict';

import {
  transposeChord,
  toFlatSpelling,
  toSharpSpelling,
  detectKeyFromChords,
  extractChordOccurrences,
  extractChordsFromText,
  getSemitoneDelta,
} from '../src/music/theory.js';
import { transposeSheet, isChordProFormat, highlightChordsInText } from '../src/music/sheetParser.js';
import { calcCapo } from '../src/music/capoCalc.js';

test('transposeChord handles basic, slash, and accidental preferences', () => {
  assert.equal(transposeChord('C', 2), 'D');
  assert.equal(transposeChord('Am7', 3), 'Cm7');
  assert.equal(transposeChord('G/B', 2), 'A/C#');
  assert.equal(transposeChord('G/B', 1, 'b'), 'Ab/C');
  assert.equal(transposeChord('F#m/A#', 0, 'b'), 'Gbm/Bb');
});

test('toFlatSpelling and toSharpSpelling preserve slash bass and suffixes', () => {
  assert.equal(toFlatSpelling('C#maj7'), 'Dbmaj7');
  assert.equal(toFlatSpelling('F#/A#'), 'Gb/Bb');
  assert.equal(toSharpSpelling('Db/F'), 'C#/F');
  assert.equal(toFlatSpelling('C'), 'C');
});

test('detectKeyFromChords distinguishes major vs relative minor keys', () => {
  const minorSong = extractChordOccurrences('Am  F  C  G  Am');
  assert.deepEqual(detectKeyFromChords(minorSong), {
    tonic: 'A',
    mode: 'minor',
    display: 'Am',
    fullDisplay: 'A Minor',
  });

  const majorSong = extractChordOccurrences('C  G  Am  F  C');
  assert.deepEqual(detectKeyFromChords(majorSong), {
    tonic: 'C',
    mode: 'major',
    display: 'C',
    fullDisplay: 'C Major',
  });
});

test('extractChordsFromText deduplicates while extractChordOccurrences keeps order', () => {
  const text = 'Am F C G Am';
  assert.deepEqual(extractChordOccurrences(text), ['Am', 'F', 'C', 'G', 'Am']);
  assert.deepEqual(extractChordsFromText(text), ['Am', 'F', 'C', 'G']);
});

test('getSemitoneDelta finds shortest signed chromatic distance', () => {
  assert.equal(getSemitoneDelta('C', 'D'), 2);
  assert.equal(getSemitoneDelta('C', 'B'), -1);
  assert.equal(getSemitoneDelta('Eb', 'F#'), 3);
});

test('transposeSheet handles ChordPro, plain text, and accidental overrides', () => {
  const chordPro = '[C]Hello [G/B]world [Am]test';
  assert.equal(isChordProFormat(chordPro), true);
  assert.equal(isChordProFormat('[Chorus]\nC  G\nHello'), false);

  const up1Flat = transposeSheet(chordPro, 1, 'b', 'chordpro');
  assert.match(up1Flat, /\[Db\]Hello \[Ab\/C\]world \[Bbm\]test/);

  const respellZero = transposeSheet('[C#]Hi [F#]there', 0, 'b', 'chordpro');
  assert.match(respellZero, /\[Db\]Hi \[Gb\]there/);

  const plain = 'C   G\nHello world';
  const plainUp2 = transposeSheet(plain, 2, '#', 'plain');
  assert.match(plainUp2, /D\s+A/);
  assert.match(plainUp2, /Hello world/);
});

test('highlightChordsInText escapes HTML and wraps chord tokens', () => {
  const html = highlightChordsInText('<script> C Am');
  assert.equal(html.includes('<script>'), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<span class="chord-token">C<\/span>/);
  assert.match(html, /<span class="chord-token">Am<\/span>/);
});

test('calcCapo recommends open-friendly fret and maps song chords', () => {
  const caps = calcCapo('Bb', 'major', ['Bb', 'F', 'Gm', 'Eb']);
  assert.equal(caps.length, 8);
  const capo3 = caps.find((c) => c.capo === 3);
  assert.equal(capo3.shapeKey, 'G');
  assert.equal(capo3.chords, 'G  D  Em  C');
  assert.equal(capo3.recommended, true);
});

