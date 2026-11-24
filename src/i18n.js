const translations = {
  en: {
    'nav-sheet': 'Sheet Mode',
    'nav-audio': 'Audio Mode',
    'input-title': 'Chord Sheet Input',
    'fmt-plain-btn': 'Plain',
    'fmt-chordpro-btn': 'ChordPro',
    'btn-clear': 'Clear',
    'btn-sample': 'Load Sample',
    'det-key-label': 'Detected Key',
    'det-key-sub-empty': 'Paste chords above to detect',
    'det-key-sub-detected': 'Based on harmonic analysis ({count} unique chords)',
    'ctrl-title': 'Transpose Controls',
    'ctrl-semi-label': 'Semitone Shift',
    'semi-unit': 'semitones',
    'ctrl-target-label': 'Target Key',
    'mode-major': 'Major',
    'mode-minor': 'Minor',
    'ctrl-acc-label': 'Accidental Preference',
    'pref-auto': 'Auto',
    'pref-sharps': '♯ Sharps',
    'pref-flats': '♭ Flats',
    'out-title': 'Transposed Output',
    'btn-copy': 'Copy',
    'btn-print': 'Print',
    'out-empty': 'Output will appear here after you paste chords',
    'capo-title': '🎸 Capo Calculator',
    'capo-sub': 'To play in keys matching target ({key})',
    'capo-play-using': 'Play using {key} shapes',
    'capo-no-capo': 'No Capo',
    'capo-fret': 'Capo {fret}',
    'capo-best': 'Easiest',
    'up-title': 'Drop your audio file here',
    'up-sub': 'Supports MP3, WAV, FLAC, OGG, AAC, M4A',
    'up-btn': 'Browse Files',
    'aud-change': 'Change File',
    'btn-preview': 'Preview Original',
    'btn-preview-shifted': 'Preview Transposed',
    'btn-stop': 'Stop',
    'aud-det-title': 'Key & Pitch Shift',
    'aud-analyzing': 'Analyzing audio...',
    'aud-conf': 'Confidence',
    'aud-semi-label': 'Semitone Shift',
    'aud-fmt-label': 'Output Format',
    'btn-trans-aud': 'Transpose & Download',
    'aud-qlt-label': 'Export Quality (WAV only)',
    'qlt-standard': 'Standard',
    'qlt-compact': 'Compact (24kHz Smaller File)',
    'toast-copy': 'Copied to clipboard!',
    'toast-sel-target': 'Select a target key or semitone shift',
    'toast-already-target': 'Already at 0 semitone shift (or choose Compact WAV)',
    'toast-dl-success': 'Downloaded successfully!',
    'toast-err-trans': 'Error during transposition',
    'toast-err-file': "Error processing audio file. Make sure it's a valid audio format.",
    'proc-shift': 'Pitch Shifting ({semi} steps)...',
    'proc-enc': 'Encoding {fmt}...',
    'proc-done': 'Done!',
    'proc-preview': 'Rendering shifted preview...',
    'placeholder-input': 'Paste your chord sheet here...\n\nExample (Plain):\nAm  F  C  G\nWhen I find myself in times of trouble\n\nExample (ChordPro):\n[Am]When I [F]find myself [C]in times of [G]trouble',
    'aud-unknown': 'Unknown'
  },
  id: {
    'nav-sheet': 'Mode Teks',
    'nav-audio': 'Mode Audio',
    'input-title': 'Input Teks Chord',
    'fmt-plain-btn': 'Biasa',
    'fmt-chordpro-btn': 'ChordPro',
    'btn-clear': 'Hapus',
    'btn-sample': 'Muat Contoh',
    'det-key-label': 'Nada Dasar',
    'det-key-sub-empty': 'Tempel chord di atas untuk mendeteksi',
    'det-key-sub-detected': 'Berdasarkan analisis harmonik ({count} chord unik)',
    'ctrl-title': 'Kontrol Transpose',
    'ctrl-semi-label': 'Geser Semitone',
    'semi-unit': 'semitone',
    'ctrl-target-label': 'Target Nada',
    'mode-major': 'Mayor',
    'mode-minor': 'Minor',
    'ctrl-acc-label': 'Preferensi Aksidental',
    'pref-auto': 'Otomatis',
    'pref-sharps': '♯ Kres (Sharp)',
    'pref-flats': '♭ Mol (Flat)',
    'out-title': 'Hasil Transpose',
    'btn-copy': 'Salin',
    'btn-print': 'Cetak',
    'out-empty': 'Output akan muncul di sini setelah Anda menempelkan chord',
    'capo-title': '🎸 Kalkulator Capo',
    'capo-sub': 'Gunakan capo untuk bermain di target ({key})',
    'capo-play-using': 'Mainkan bentuk {key}',
    'capo-no-capo': 'Tanpa Capo',
    'capo-fret': 'Capo {fret}',
    'capo-best': 'Termudah',
    'up-title': 'Letakkan file audio Anda di sini',
    'up-sub': 'Mendukung MP3, WAV, FLAC, OGG, AAC, M4A',
    'up-btn': 'Cari File',
    'aud-change': 'Ganti File',
    'btn-preview': 'Putar Asli',
    'btn-preview-shifted': 'Putar Transpose',
    'btn-stop': 'Berhenti',
    'aud-det-title': 'Nada Dasar & Geser Pitch',
    'aud-analyzing': 'Menganalisis audio...',
    'aud-conf': 'Akurasi',
    'aud-semi-label': 'Geser Semitone',
    'aud-fmt-label': 'Format Output',
    'btn-trans-aud': 'Transpose & Unduh',
    'aud-qlt-label': 'Kualitas Ekspor (Khusus WAV)',
    'qlt-standard': 'Standar',
    'qlt-compact': 'Ringan (24kHz File Kecil)',
    'toast-copy': 'Berhasil disalin!',
    'toast-sel-target': 'Pilih target nada atau geser semitone',
    'toast-already-target': 'Pergeseran masih 0 semitone (atau pilih WAV Ringan)',
    'toast-dl-success': 'Berhasil diunduh!',
    'toast-err-trans': 'Gagal saat memproses transpose',
    'toast-err-file': 'Gagal memproses file audio. Pastikan format audio valid.',
    'proc-shift': 'Memproses pitch ({semi} nada)...',
    'proc-enc': 'Mengodekan ke {fmt}...',
    'proc-done': 'Selesai!',
    'proc-preview': 'Menyiapkan pratinjau transpose...',
    'placeholder-input': 'Tempel teks chord Anda di sini...\n\nContoh (Biasa):\nAm  F  C  G\nWhen I find myself in times of trouble\n\nContoh (ChordPro):\n[Am]When I [F]find myself [C]in times of [G]trouble',
    'aud-unknown': 'Tidak Diketahui'
  }
};

let currentLang = localStorage.getItem('chordshift_lang') || 'id';

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
    localStorage.setItem('chordshift_lang', lang);
    applyTranslations();
  }
}

export function getCurrentLanguage() {
  return currentLang;
}

export function t(key, params = {}) {
  let text = translations[currentLang][key] ?? translations.en[key];
  if (!text) return key;

  for (const [k, v] of Object.entries(params)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

export function applyTranslations() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach((el) => {
    const key = el.getAttribute('data-i18n');

    if (el.tagName === 'TEXTAREA' && el.id === 'chord-input') {
      el.placeholder = t(key);
    } else {
      const textSpan = el.querySelector('.i18n-text');
      if (textSpan) {
        textSpan.textContent = t(key);
      } else {
        el.textContent = t(key);
      }
    }
  });
}

export function initI18n() {
  applyTranslations();
}
