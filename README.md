# ChordShift 🎸

**ChordShift** is a professional-grade web application designed for musicians to transpose chord sheets and audio files with ease. Featuring state-of-the-art audio processing and a sleek, modern interface.

![Preview](https://via.placeholder.com/800x400?text=ChordShift+Interface+Preview)

## ✨ Features

### 📄 Sheet Mode
- **Multi-Format Support**: Handle both **Plain Text** and **ChordPro** formats accurately.
- **Smart Detection**: Automatically detects the key of your chord sheet using logical analysis.
- **Capo Calculator**: Automatically calculates capo positions to match your target key using familiar chord shapes.
- **Professional Print**: Clean, focused print mode for your transposed sheets.

### 🎵 Audio Mode (SOTA 2026)
- **High-Quality Pitch Shifting**: Powered by the **Rubber Band Library (WASM)**, providing professional, frequency-domain transposition that preserves transients and clarity.
- **Key Detection**: Built-in audio analysis to detect the tonic and mode of your tracks.
- **Format Options**: Export your transposed audio to **WAV** or **MP3**.
- **Size Optimization**: Includes a **Compact Mode** for WAV files, reducing file size by 50% while maintaining stereo quality.

### 🌐 Internationalization (i18n)
- Native support for **English** and **Bahasa Indonesia**.
- Persistent settings for a personalized experience.

## 🛠️ Tech Stack
- **Framework**: Vite
- **Audio Processing**: [Rubber Band Library](https://breakfastquay.com/rubberband/) (WASM), [Tone.js](https://tonejs.github.io/)
- **Music Theory**: [Tonal.js](https://tonaljs.github.io/tonal/)
- **Chord Parsing**: [ChordSheetJS](https://github.com/martijnversluis/ChordSheetJS)
- **MP3 Encoding**: [lamejs](https://github.com/zhuker/lamejs)
- **Styling**: Vanilla CSS with modern Glassmorphism aesthetics.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer)
- npm

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Bertonare/chord-transposer.git
   cd chord-transposer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## 📝 License
This project is for educational and personal use. Audio processing powered by Rubber Band Library.

---
Built with ❤️ for musicians everywhere.
