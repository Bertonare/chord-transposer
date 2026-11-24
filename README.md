# ChordShift

A client-side web app for transposing chord sheets and audio files. Runs entirely in the browser.

Live demo: https://bertonare.github.io/chord-transposer/

## Features

**Sheet Mode**
- Supports Plain text (chords over lyrics) and ChordPro (`[Am]`) formats
- Automatic key detection and signed semitone shifting (`Ctrl/Cmd + ↑/↓`)
- Accidental preference (`Auto`, `♯`, `♭`) and capo fret recommendations
- Print-friendly output and `localStorage` persistence

**Audio Mode**
- Key detection via FFT chromagram in a Web Worker
- Pitch shifting via Rubber Band WASM in a Web Worker
- Waveform seek and 12-second transposed snippet preview
- Export to WAV (`Standard` or `24 kHz Compact`) or MP3 (`192 kbps`)

**Localization**
- English and Bahasa Indonesia

## Stack

- Vite
- Tonal & ChordSheetJS
- Rubber Band (WASM) & Web Audio API
- lamejs

## Development

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Run tests and build:

```bash
npm test
npm run build
```

## Deployment

Pushes to `master` build and deploy automatically to GitHub Pages via `.github/workflows/deploy.yml`.
