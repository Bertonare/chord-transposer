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
    'det-key-sub-detected': 'Based on logic analysis ({count} chords)',
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
    'up-title': 'Drop your audio file here',
    'up-sub': 'Supports MP3, WAV, FLAC, OGG, AAC, M4A',
    'up-btn': 'Browse Files',
    'aud-change': 'Change File',
    'btn-preview': 'Preview',
    'btn-stop': 'Stop',
    'aud-det-title': 'Key Detection',
    'aud-analyzing': 'Analyzing audio...',
    'aud-conf': 'Confidence',
    'aud-fmt-label': 'Output Format',
    'btn-trans-aud': 'Transpose & Download',
    'aud-qlt-label': 'Export Quality (WAV only)',
    'qlt-standard': 'Standard',
    'qlt-compact': 'Compact (Smaller File)',
    'toast-copy': 'Copied to clipboard!',
    'toast-sel-target': 'Select a target key',
    'toast-already-target': 'Already in target key',
    'toast-dl-success': 'Downloaded successfully!',
    'toast-err-trans': 'Error during transposition',
    'proc-shift': 'Pitch Shifting ({semi} steps)...',
    'proc-enc': 'Encoding {fmt}...',
    'proc-done': 'Done!',
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
    'det-key-sub-detected': 'Berdasarkan analisis logika ({count} chord)',
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
    'up-title': 'Letakkan file audio Anda di sini',
    'up-sub': 'Mendukung MP3, WAV, FLAC, OGG, AAC, M4A',
    'up-btn': 'Cari File',
    'aud-change': 'Ganti File',
    'btn-preview': 'Pratinjau',
    'btn-stop': 'Berhenti',
    'aud-det-title': 'Deteksi Nada Dasar',
    'aud-analyzing': 'Menganalisis audio...',
    'aud-conf': 'Akurasi',
    'aud-fmt-label': 'Format Output',
    'btn-trans-aud': 'Transpose & Unduh',
    'aud-qlt-label': 'Kualitas Ekspor (Khusus WAV)',
    'qlt-standard': 'Standar',
    'qlt-compact': 'Ringan (File Kecil)',
    'toast-copy': 'Berhasil disalin!',
    'toast-sel-target': 'Pilih target nada',
    'toast-already-target': 'Sudah berada di nada target',
    'toast-dl-success': 'Berhasil diunduh!',
    'toast-err-trans': 'Gagal saat memproses transpose',
    'proc-shift': 'Memproses pitch ({semi} nada)...',
    'proc-enc': 'Mengodekan ke {fmt}...',
    'proc-done': 'Selesai!',
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
  let text = translations[currentLang][key];
  if (!text) return key;
  
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}

export function applyTranslations() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    
    if (el.tagName === 'TEXTAREA' && el.id === 'chord-input') {
       el.placeholder = t(key);
    } else {
      // Find text nodes to keep SVGs intact if there's any mixed content
      // Simple replace if it's purely text content or innerHTML is safely replaceable
      // To preserve SVGs or icons inside buttons, we explicitly target .text elements if possible
      // or we just wrap translatable text in spans in HTML. Let's assume index.html wraps text.
      const textSpan = el.querySelector('.i18n-text');
      if (textSpan) {
        textSpan.textContent = t(key);
      } else {
        // If no wrapper, replace textContent (this might destroy inner SVGs if not careful!)
        // In index.html we will wrap text around SVGs with <span class="i18n-text">
        el.textContent = t(key);
      }
    }
  });
}

export function initI18n() {
  applyTranslations();
}
