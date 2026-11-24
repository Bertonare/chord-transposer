import {
  ALL_KEYS,
  FLAT_KEYS,
  SHARP_KEYS,
  detectKeyFromChords,
  extractChordOccurrences,
  extractChordsFromText,
  getSemitoneDelta,
} from './music/theory.js';
import { transposeSheet, highlightChordsInText } from './music/sheetParser.js';
import { calcCapo } from './music/capoCalc.js';
import { t, initI18n, setLanguage, getCurrentLanguage } from './i18n.js';

const SHEET_STORAGE_KEY = 'chordshift_sheet_state';

const SAMPLES = {
  plain: `C              G\nWhen I find myself in times of trouble\nAm             F\nMother Mary comes to me\nC              G              F    C\nSpeaking words of wisdom, let it be`,
  chordpro: `[C]When I find myself in [G]times of trouble\n[Am]Mother Mary [F]comes to me\n[C]Speaking words of [G]wisdom, let it [F]be [C]`,
};

// --- Lazy-loaded Audio Modules ---
let audioModulesPromise = null;
function loadAudioModules() {
  if (!audioModulesPromise) {
    audioModulesPromise = Promise.all([
      import('./audio/keyDetector.js'),
      import('./audio/pitchShifter.js'),
      import('./audio/encoder.js'),
      import('./ui/waveformVisualizer.js'),
    ]).then(([keyDet, shifter, encoder, wave]) => ({
      detectAudioKey: keyDet.detectAudioKey,
      pitchShiftAudio: shifter.pitchShiftAudio,
      encodeWAV: encoder.encodeWAV,
      encodeMP3: encoder.encodeMP3,
      triggerDownload: encoder.triggerDownload,
      drawWaveform: wave.drawWaveform,
      attachWaveformHandlers: wave.attachWaveformHandlers,
    }));
  }
  return audioModulesPromise;
}

// --- State ---
const state = {
  tab: 'sheet',

  // Sheet state
  inputText: '',
  inputFormat: 'plain', // plain | chordpro
  semitones: 0,
  targetKey: null,
  targetMode: 'major',
  detectedKey: null,
  accidentalPref: 'auto', // auto | sharps | flats

  // Audio state
  audioBuffer: null,
  audioFile: null,
  audioDetectedKey: null,
  audioSemitones: 0,
  audioTargetKey: null,
  audioTargetMode: 'major',
  audioOutputFormat: 'wav',
  audioExportQuality: 'standard', // standard | compact
  audioPreviewPlayer: null,
  audioPlayingMode: null, // null | 'original' | 'shifted'
  audioSeekOffset: 0, // seconds
  audioPlayStartedAt: 0,
  audioPlayDuration: 0,
  audioRafId: null,
  shiftedPreviewCache: new Map(),
};

// --- DOM Elements ---
const $ = (id) => document.getElementById(id);

const tabSheet = $('tab-sheet');
const tabAudio = $('tab-audio');
const panelSheet = $('panel-sheet');
const panelAudio = $('panel-audio');

// Sheet Elements
const chordInput = $('chord-input');
const fmtPlain = $('fmt-plain');
const fmtChordpro = $('fmt-chordpro');
const btnClear = $('btn-clear-input');
const btnSample = $('btn-sample');
const detKeyDisplay = $('detected-key-display');
const detKeySub = $('detected-key-sub');

const semiDown = $('semi-down');
const semiUp = $('semi-up');
const semiValue = $('semitone-value');

const keyGrid = $('key-grid');
const modeMajor = $('mode-major');
const modeMinor = $('mode-minor');

const prefAuto = $('pref-auto');
const prefSharps = $('pref-sharps');
const prefFlats = $('pref-flats');

const outputEmpty = $('output-empty');
const outputPre = $('output-pre');
const btnCopy = $('btn-copy');
const btnPrint = $('btn-print');

const capoCard = $('capo-card');
const capoSubtitle = $('capo-subtitle');
const capoGrid = $('capo-grid');

// Audio Elements
const uploadZone = $('upload-zone');
const fileInput = $('audio-file-input');
const uploadCard = $('upload-card');
const audioAnalysisPnl = $('audio-analysis');
const audioFilename = $('audio-filename');
const btnChangeFile = $('btn-change-file');

const waveformCanvas = $('waveform-canvas');
const btnPlayPreview = $('btn-play-preview');
const btnPreviewShifted = $('btn-preview-shifted');
const audioDuration = $('audio-duration');

const audioDetecting = $('audio-detecting');
const detectProgress = $('detect-progress');
const audioKeyResult = $('audio-key-result');

const audioDetKey = $('audio-detected-key');
const confBar = $('confidence-bar');
const confPct = $('confidence-pct');

const audioSemiDown = $('audio-semi-down');
const audioSemiUp = $('audio-semi-up');
const audioSemiValue = $('audio-semitone-value');

const audioKeyGrid = $('audio-key-grid');
const audioModeMajor = $('audio-mode-major');
const audioModeMinor = $('audio-mode-minor');

const fmtWav = $('fmt-wav');
const fmtMp3 = $('fmt-mp3');
const audioQualitySection = $('audio-quality-section');
const qltStandard = $('qlt-standard');
const qltCompact = $('qlt-compact');
const btnTransposeAudio = $('btn-transpose-audio');

const audioProcessProgress = $('audio-process-progress');
const processBar = $('process-bar');
const processLabel = $('process-label');

const toastEl = $('toast');
let toastTimer = null;

function showToast(msg, type = 'success') {
  toastEl.textContent = msg;
  toastEl.className = `toast show ${type}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 3000);
}

// --- Lazy AudioContext ---
let sharedAudioCtx = null;
function getAudioContext() {
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

// --- Sheet Persistence ---
function saveSheetState() {
  try {
    localStorage.setItem(
      SHEET_STORAGE_KEY,
      JSON.stringify({
        inputText: state.inputText,
        inputFormat: state.inputFormat,
        semitones: state.semitones,
        accidentalPref: state.accidentalPref,
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

function restoreSheetState() {
  try {
    const raw = localStorage.getItem(SHEET_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved.inputText === 'string') {
      state.inputText = saved.inputText;
      chordInput.value = saved.inputText;
    }
    if (saved.inputFormat === 'plain' || saved.inputFormat === 'chordpro') {
      state.inputFormat = saved.inputFormat;
    }
    if (typeof saved.semitones === 'number' && Number.isFinite(saved.semitones)) {
      state.semitones = saved.semitones;
    }
    if (['auto', 'sharps', 'flats'].includes(saved.accidentalPref)) {
      state.accidentalPref = saved.accidentalPref;
    }
  } catch {
    // Ignore malformed saved state
  }
}

// --- Initialization ---
function init() {
  initI18n();
  restoreSheetState();

  const langBtns = document.querySelectorAll('.lang-btn');
  langBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      langBtns.forEach((b) => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      setLanguage(e.currentTarget.dataset.lang);
      updateSheetSync();
      refreshAudioI18n();
    });
    btn.classList.toggle('active', btn.dataset.lang === getCurrentLanguage());
  });

  bindTabs();
  bindSheetEvents();
  bindAudioEvents();

  updateSheetFmtUI();
  updatePrefUI();
  updateSheetSync();
  renderKeyGrid(audioKeyGrid, state.audioTargetKey, state.audioTargetMode, updateAudioTargetKey);
}

// --- Tabs ---
function bindTabs() {
  tabSheet.addEventListener('click', () => {
    state.tab = 'sheet';
    tabSheet.classList.add('active');
    tabAudio.classList.remove('active');
    panelSheet.classList.add('active');
    panelAudio.classList.remove('active');
  });
  tabAudio.addEventListener('click', () => {
    state.tab = 'audio';
    tabAudio.classList.add('active');
    tabSheet.classList.remove('active');
    panelAudio.classList.add('active');
    panelSheet.classList.remove('active');
    loadAudioModules();
  });
}

// --- Shared Grid Render ---
function renderKeyGrid(container, activeKey, mode, onClick) {
  container.innerHTML = '';
  ALL_KEYS.forEach((k) => {
    const btn = document.createElement('button');
    btn.className = `key-btn ${activeKey === k ? 'active' : ''}`;
    btn.textContent = mode === 'major' ? k : `${k}m`;
    btn.onclick = () => onClick(k);
    container.appendChild(btn);
  });
}

// --- Sheet Mode ---
function bindSheetEvents() {
  chordInput.addEventListener('input', (e) => {
    state.inputText = e.target.value;
    saveSheetState();
    updateSheetSync();
  });

  btnClear.addEventListener('click', () => {
    chordInput.value = '';
    state.inputText = '';
    state.semitones = 0;
    state.targetKey = null;
    saveSheetState();
    updateSheetSync();
  });

  btnSample.addEventListener('click', () => {
    const sample = SAMPLES[state.inputFormat] || SAMPLES.plain;
    chordInput.value = sample;
    state.inputText = sample;
    state.semitones = 0;
    state.targetKey = null;
    saveSheetState();
    updateSheetSync();
  });

  fmtPlain.addEventListener('click', () => {
    state.inputFormat = 'plain';
    updateSheetFmtUI();
    saveSheetState();
    updateSheetSync();
  });

  fmtChordpro.addEventListener('click', () => {
    state.inputFormat = 'chordpro';
    updateSheetFmtUI();
    saveSheetState();
    updateSheetSync();
  });

  const shiftSemitones = (delta) => {
    state.semitones += delta;
    saveSheetState();
    updateSheetUI();
  };

  semiDown.addEventListener('click', () => shiftSemitones(-1));
  semiUp.addEventListener('click', () => shiftSemitones(1));

  document.addEventListener('keydown', (e) => {
    if (state.tab !== 'sheet') return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') {
      e.preventDefault();
      shiftSemitones(1);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') {
      e.preventDefault();
      shiftSemitones(-1);
    }
  });

  modeMajor.addEventListener('click', () => {
    state.targetMode = 'major';
    modeMajor.classList.add('active');
    modeMinor.classList.remove('active');
    renderKeyGrid(keyGrid, state.targetKey, 'major', updateTargetKey);
    updateSheetUI();
  });

  modeMinor.addEventListener('click', () => {
    state.targetMode = 'minor';
    modeMinor.classList.add('active');
    modeMajor.classList.remove('active');
    renderKeyGrid(keyGrid, state.targetKey, 'minor', updateTargetKey);
    updateSheetUI();
  });

  const selectPref = (pref) => {
    state.accidentalPref = pref;
    updatePrefUI();
    saveSheetState();
    updateSheetSync();
  };
  prefAuto.addEventListener('click', () => selectPref('auto'));
  prefSharps.addEventListener('click', () => selectPref('sharps'));
  prefFlats.addEventListener('click', () => selectPref('flats'));

  btnCopy.addEventListener('click', () => {
    navigator.clipboard.writeText(outputPre.textContent).then(() => showToast(t('toast-copy')));
  });
  btnPrint.addEventListener('click', () => window.print());
}

function updatePrefUI() {
  prefAuto.classList.toggle('active', state.accidentalPref === 'auto');
  prefSharps.classList.toggle('active', state.accidentalPref === 'sharps');
  prefFlats.classList.toggle('active', state.accidentalPref === 'flats');
}

function updateTargetKey(key) {
  state.targetKey = key;
  if (state.detectedKey) {
    state.semitones = getSemitoneDelta(state.detectedKey.tonic, key);
  }
  saveSheetState();
  updateSheetUI();
}

function updateSheetFmtUI() {
  fmtPlain.classList.toggle('active', state.inputFormat === 'plain');
  fmtChordpro.classList.toggle('active', state.inputFormat === 'chordpro');
}

function resolveSheetAccidental() {
  if (state.accidentalPref === 'flats') return 'b';
  if (state.accidentalPref === 'sharps') return '#';
  if (state.targetKey && FLAT_KEYS.includes(state.targetKey)) return 'b';
  if (state.targetKey && state.targetKey !== 'C' && SHARP_KEYS.includes(state.targetKey)) return '#';
  return null;
}

function updateSheetSync() {
  const txt = state.inputText;
  if (!txt.trim()) {
    detKeyDisplay.textContent = '—';
    detKeySub.textContent = t('det-key-sub-empty');
    semiValue.textContent = state.semitones > 0 ? `+${state.semitones}` : state.semitones;
    outputEmpty.style.display = 'flex';
    outputPre.style.display = 'none';
    capoCard.style.display = 'none';
    state.detectedKey = null;
    renderKeyGrid(keyGrid, state.targetKey, state.targetMode, updateTargetKey);
    return;
  }

  const occurrences = extractChordOccurrences(txt);
  const uniqueChords = [...new Set(occurrences)];
  state.detectedKey = detectKeyFromChords(occurrences);

  if (state.detectedKey) {
    detKeyDisplay.textContent =
      state.detectedKey.mode === 'major'
        ? `${state.detectedKey.tonic} ${t('mode-major')}`
        : `${state.detectedKey.tonic} ${t('mode-minor')}`;
    detKeySub.textContent = t('det-key-sub-detected', { count: uniqueChords.length });
    if (!state.targetKey) {
      state.targetKey = state.detectedKey.tonic;
      state.targetMode = state.detectedKey.mode;
      modeMajor.classList.toggle('active', state.targetMode === 'major');
      modeMinor.classList.toggle('active', state.targetMode === 'minor');
    }
  } else {
    detKeyDisplay.textContent = '—';
    detKeySub.textContent = t('det-key-sub-empty');
  }

  updateSheetUI();
}

function updateSheetUI() {
  semiValue.textContent = state.semitones > 0 ? `+${state.semitones}` : state.semitones;

  if (state.detectedKey) {
    const idx = ALL_KEYS.indexOf(state.detectedKey.tonic);
    if (idx !== -1) {
      state.targetKey = ALL_KEYS[(idx + state.semitones + 48) % 12];
    }
  }

  renderKeyGrid(keyGrid, state.targetKey, state.targetMode, updateTargetKey);

  if (state.inputText.trim()) {
    const accidental = resolveSheetAccidental();
    const transposed = transposeSheet(state.inputText, state.semitones, accidental, state.inputFormat);
    outputEmpty.style.display = 'none';
    outputPre.style.display = 'block';
    outputPre.innerHTML = highlightChordsInText(transposed);

    if (state.targetKey) {
      const transposedChords = extractChordsFromText(transposed);
      capoCard.style.display = 'block';
      capoSubtitle.textContent = t('capo-sub', { key: state.targetKey });
      const caps = calcCapo(state.targetKey, state.targetMode, transposedChords);
      capoGrid.innerHTML = caps
        .map(
          (c) => `
        <div class="capo-item ${c.recommended ? 'recommended' : ''}">
          <div class="capo-fret-row">
            <span class="capo-fret">${c.capo === 0 ? t('capo-no-capo') : t('capo-fret', { fret: c.capo })}</span>
            ${c.recommended ? `<span class="capo-badge">${t('capo-best')}</span>` : ''}
          </div>
          <div class="capo-chords">${c.chords}</div>
          <div class="capo-key">${t('capo-play-using', { key: c.shapeKey })}</div>
        </div>
      `
        )
        .join('');
    }
  }
}

// --- Audio Mode ---
function formatTime(secs) {
  const safe = Math.max(0, secs || 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function setPlayButtonLabel(btn, isPlaying, defaultKey) {
  const span = btn.querySelector('.i18n-text');
  if (span) span.textContent = isPlaying ? t('btn-stop') : t(defaultKey);
  const svg = btn.querySelector('svg');
  if (svg) {
    svg.innerHTML = isPlaying
      ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
      : '<polygon points="5 3 19 12 5 21 5 3"/>';
  }
}

function updateAudioDurationDisplay() {
  if (!state.audioBuffer) {
    audioDuration.textContent = '—';
    return;
  }
  const current = Math.min(state.audioBuffer.duration, state.audioSeekOffset);
  audioDuration.textContent = `${formatTime(current)} / ${formatTime(state.audioBuffer.duration)}`;
}

async function stopAudioPlayback(resetSeek = false) {
  if (state.audioRafId) {
    cancelAnimationFrame(state.audioRafId);
    state.audioRafId = null;
  }
  if (state.audioPreviewPlayer) {
    const player = state.audioPreviewPlayer;
    state.audioPreviewPlayer = null;
    player.onended = null;
    try {
      player.stop();
    } catch {
      // Ignore already-stopped nodes
    }
  }
  if (resetSeek) {
    state.audioSeekOffset = 0;
  }
  state.audioPlayingMode = null;
  setPlayButtonLabel(btnPlayPreview, false, 'btn-preview');
  setPlayButtonLabel(btnPreviewShifted, false, 'btn-preview-shifted');
  btnPreviewShifted.classList.remove('playing');
  updateAudioDurationDisplay();

  if (state.audioBuffer) {
    const { drawWaveform } = await loadAudioModules();
    drawWaveform(waveformCanvas, state.audioBuffer, state.audioSeekOffset / state.audioBuffer.duration);
  }
}

function startPlaybackAnimation(startOffset, duration, bufferDuration) {
  const tick = async () => {
    if (!state.audioPlayingMode || !state.audioBuffer) return;
    const ctx = getAudioContext();
    const elapsed = Math.max(0, ctx.currentTime - state.audioPlayStartedAt);
    const pos = Math.min(bufferDuration, startOffset + elapsed);
    state.audioSeekOffset = pos;
    updateAudioDurationDisplay();

    const { drawWaveform } = await loadAudioModules();
    drawWaveform(waveformCanvas, state.audioBuffer, pos / bufferDuration);

    if (elapsed < duration && state.audioPlayingMode) {
      state.audioRafId = requestAnimationFrame(tick);
    }
  };
  state.audioRafId = requestAnimationFrame(tick);
}

async function startOriginalPreview() {
  if (!state.audioBuffer) return;
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') await ctx.resume();

  const offset = state.audioSeekOffset >= state.audioBuffer.duration ? 0 : state.audioSeekOffset;
  const remaining = Math.max(0.05, state.audioBuffer.duration - offset);

  const source = ctx.createBufferSource();
  source.buffer = state.audioBuffer;
  source.connect(ctx.destination);
  source.start(0, offset);

  state.audioPreviewPlayer = source;
  state.audioPlayingMode = 'original';
  state.audioPlayStartedAt = ctx.currentTime;
  state.audioPlayDuration = remaining;

  setPlayButtonLabel(btnPlayPreview, true, 'btn-preview');
  setPlayButtonLabel(btnPreviewShifted, false, 'btn-preview-shifted');

  source.onended = () => {
    if (state.audioPreviewPlayer === source) {
      stopAudioPlayback(true);
    }
  };

  startPlaybackAnimation(offset, remaining, state.audioBuffer.duration);
}

async function startShiftedPreview() {
  if (!state.audioBuffer) return;
  const semi = state.audioSemitones;
  if (semi === 0) {
    await startOriginalPreview();
    return;
  }

  const ctx = getAudioContext();
  if (ctx.state === 'suspended') await ctx.resume();

  const fullBuf = state.audioBuffer;
  const offsetSec = fullBuf.duration - state.audioSeekOffset < 1 ? 0 : state.audioSeekOffset;
  const snippetSec = Math.min(12, fullBuf.duration - offsetSec);
  const startSample = Math.floor(offsetSec * fullBuf.sampleRate);
  const sampleLen = Math.max(1, Math.floor(snippetSec * fullBuf.sampleRate));

  const cacheKey = `${startSample}:${semi}`;
  let shiftedSnippet = state.shiftedPreviewCache.get(cacheKey);

  if (!shiftedSnippet) {
    btnPreviewShifted.disabled = true;
    const origText = btnPreviewShifted.querySelector('.i18n-text');
    if (origText) origText.textContent = t('proc-preview');

    try {
      const excerpt = new AudioBuffer({
        length: sampleLen,
        numberOfChannels: fullBuf.numberOfChannels,
        sampleRate: fullBuf.sampleRate,
      });
      for (let c = 0; c < fullBuf.numberOfChannels; c++) {
        excerpt.copyToChannel(fullBuf.getChannelData(c).subarray(startSample, startSample + sampleLen), c);
      }
      const { pitchShiftAudio } = await loadAudioModules();
      shiftedSnippet = await pitchShiftAudio(excerpt, semi);
      state.shiftedPreviewCache.set(cacheKey, shiftedSnippet);
    } catch (err) {
      console.error(err);
      showToast(t('toast-err-trans'), 'error');
      btnPreviewShifted.disabled = false;
      setPlayButtonLabel(btnPreviewShifted, false, 'btn-preview-shifted');
      return;
    } finally {
      btnPreviewShifted.disabled = false;
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = shiftedSnippet;
  source.connect(ctx.destination);
  source.start(0);

  state.audioPreviewPlayer = source;
  state.audioPlayingMode = 'shifted';
  state.audioPlayStartedAt = ctx.currentTime;
  state.audioPlayDuration = shiftedSnippet.duration;

  setPlayButtonLabel(btnPlayPreview, false, 'btn-preview');
  setPlayButtonLabel(btnPreviewShifted, true, 'btn-preview-shifted');
  btnPreviewShifted.classList.add('playing');

  source.onended = () => {
    if (state.audioPreviewPlayer === source) {
      stopAudioPlayback(false);
    }
  };

  startPlaybackAnimation(offsetSec, shiftedSnippet.duration, fullBuf.duration);
}

function bindAudioEvents() {
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleAudioFile(e.dataTransfer.files[0]);
  });
  uploadZone.addEventListener('click', (e) => {
    if (e.target.closest('label[for="audio-file-input"]') || e.target === fileInput) return;
    fileInput.click();
  });
  uploadZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleAudioFile(e.target.files[0]);
  });

  btnChangeFile.addEventListener('click', async () => {
    await stopAudioPlayback(true);
    state.audioFile = null;
    state.audioBuffer = null;
    state.audioDetectedKey = null;
    state.audioSemitones = 0;
    state.shiftedPreviewCache.clear();
    fileInput.value = '';
    uploadCard.style.display = 'block';
    audioAnalysisPnl.style.display = 'none';
  });

  btnPlayPreview.addEventListener('click', async () => {
    if (!state.audioBuffer) return;
    if (state.audioPlayingMode === 'original') {
      await stopAudioPlayback(false);
    } else {
      await stopAudioPlayback(false);
      await startOriginalPreview();
    }
  });

  btnPreviewShifted.addEventListener('click', async () => {
    if (!state.audioBuffer) return;
    if (state.audioPlayingMode === 'shifted') {
      await stopAudioPlayback(false);
    } else {
      await stopAudioPlayback(false);
      await startShiftedPreview();
    }
  });

  audioSemiDown.addEventListener('click', () => updateAudioSemitones(state.audioSemitones - 1));
  audioSemiUp.addEventListener('click', () => updateAudioSemitones(state.audioSemitones + 1));

  audioModeMajor.addEventListener('click', () => {
    state.audioTargetMode = 'major';
    audioModeMajor.classList.add('active');
    audioModeMinor.classList.remove('active');
    renderKeyGrid(audioKeyGrid, state.audioTargetKey, 'major', updateAudioTargetKey);
  });

  audioModeMinor.addEventListener('click', () => {
    state.audioTargetMode = 'minor';
    audioModeMinor.classList.add('active');
    audioModeMajor.classList.remove('active');
    renderKeyGrid(audioKeyGrid, state.audioTargetKey, 'minor', updateAudioTargetKey);
  });

  fmtWav.addEventListener('click', () => {
    state.audioOutputFormat = 'wav';
    fmtWav.classList.add('active');
    fmtMp3.classList.remove('active');
    audioQualitySection.style.display = 'block';
  });
  fmtMp3.addEventListener('click', () => {
    state.audioOutputFormat = 'mp3';
    fmtMp3.classList.add('active');
    fmtWav.classList.remove('active');
    audioQualitySection.style.display = 'none';
  });

  qltStandard.addEventListener('click', () => {
    state.audioExportQuality = 'standard';
    qltStandard.classList.add('active');
    qltCompact.classList.remove('active');
  });
  qltCompact.addEventListener('click', () => {
    state.audioExportQuality = 'compact';
    qltCompact.classList.add('active');
    qltStandard.classList.remove('active');
  });

  btnTransposeAudio.addEventListener('click', execAudioTranspose);

  // Waveform seeking + resize redraw
  loadAudioModules().then(({ attachWaveformHandlers }) => {
    attachWaveformHandlers(
      waveformCanvas,
      () => state.audioBuffer,
      () => (state.audioBuffer ? state.audioSeekOffset / state.audioBuffer.duration : 0),
      async (ratio) => {
        if (!state.audioBuffer) return;
        const wasPlayingMode = state.audioPlayingMode;
        await stopAudioPlayback(false);
        state.audioSeekOffset = ratio * state.audioBuffer.duration;
        updateAudioDurationDisplay();
        const { drawWaveform } = await loadAudioModules();
        drawWaveform(waveformCanvas, state.audioBuffer, ratio);
        if (wasPlayingMode === 'original') await startOriginalPreview();
        else if (wasPlayingMode === 'shifted') await startShiftedPreview();
      }
    );
  });
}

function updateAudioSemitones(nextSemi) {
  state.audioSemitones = Math.max(-12, Math.min(12, nextSemi));
  audioSemiValue.textContent =
    state.audioSemitones > 0 ? `+${state.audioSemitones}` : state.audioSemitones;

  if (state.audioDetectedKey?.tonic) {
    const baseIdx = ALL_KEYS.indexOf(
      state.audioDetectedKey.tonic.replace('C#', 'Db').replace('D#', 'Eb').replace('G#', 'Ab').replace('A#', 'Bb')
    );
    if (baseIdx !== -1) {
      state.audioTargetKey = ALL_KEYS[(baseIdx + state.audioSemitones + 48) % 12];
      renderKeyGrid(audioKeyGrid, state.audioTargetKey, state.audioTargetMode, updateAudioTargetKey);
    }
  }
}

function updateAudioTargetKey(key) {
  state.audioTargetKey = key;
  if (state.audioDetectedKey?.tonic) {
    state.audioSemitones = getSemitoneDelta(state.audioDetectedKey.tonic, key);
    audioSemiValue.textContent =
      state.audioSemitones > 0 ? `+${state.audioSemitones}` : state.audioSemitones;
  }
  renderKeyGrid(audioKeyGrid, key, state.audioTargetMode, updateAudioTargetKey);
}

function refreshAudioI18n() {
  if (state.audioDetectedKey) {
    if (state.audioDetectedKey.tonic) {
      const modeText = state.audioDetectedKey.mode === 'major' ? t('mode-major') : t('mode-minor');
      audioDetKey.textContent = `${state.audioDetectedKey.tonic} ${modeText}`;
    } else {
      audioDetKey.textContent = t('aud-unknown');
    }
  }
  setPlayButtonLabel(btnPlayPreview, state.audioPlayingMode === 'original', 'btn-preview');
  setPlayButtonLabel(btnPreviewShifted, state.audioPlayingMode === 'shifted', 'btn-preview-shifted');
}

async function handleAudioFile(file) {
  await stopAudioPlayback(true);
  state.audioFile = file;
  state.audioDetectedKey = null;
  state.audioSemitones = 0;
  state.audioTargetKey = null;
  state.shiftedPreviewCache.clear();
  audioSemiValue.textContent = '0';

  uploadCard.style.display = 'none';
  audioAnalysisPnl.style.display = 'block';
  audioDetecting.style.display = 'flex';
  audioKeyResult.style.display = 'none';
  audioFilename.textContent = file.name;

  try {
    const { detectAudioKey, drawWaveform } = await loadAudioModules();
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = getAudioContext();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    const audioBuf = await audioCtx.decodeAudioData(arrayBuffer);
    state.audioBuffer = audioBuf;
    state.audioSeekOffset = 0;
    updateAudioDurationDisplay();

    drawWaveform(waveformCanvas, audioBuf, 0);

    detectProgress.style.width = '0%';
    const detResult = await detectAudioKey(audioBuf, (pct) => {
      detectProgress.style.width = `${Math.round(pct * 100)}%`;
    });

    state.audioDetectedKey = detResult;

    audioDetecting.style.display = 'none';
    audioKeyResult.style.display = 'block';

    if (detResult && detResult.tonic) {
      const modeText = detResult.mode === 'major' ? t('mode-major') : t('mode-minor');
      audioDetKey.textContent = `${detResult.tonic} ${modeText}`;
      confBar.style.width = `${detResult.confidence}%`;
      confPct.textContent = `${detResult.confidence}%`;

      const normalizedTonic = detResult.tonic
        .replace('C#', 'Db')
        .replace('D#', 'Eb')
        .replace('G#', 'Ab')
        .replace('A#', 'Bb');
      state.audioTargetKey = normalizedTonic;
      state.audioTargetMode = detResult.mode;
      audioModeMajor.classList.toggle('active', state.audioTargetMode === 'major');
      audioModeMinor.classList.toggle('active', state.audioTargetMode === 'minor');
      renderKeyGrid(audioKeyGrid, state.audioTargetKey, state.audioTargetMode, updateAudioTargetKey);
    } else {
      audioDetKey.textContent = t('aud-unknown');
      confBar.style.width = '0%';
      confPct.textContent = '0%';
      renderKeyGrid(audioKeyGrid, null, state.audioTargetMode, updateAudioTargetKey);
    }
  } catch (err) {
    console.error(err);
    showToast(t('toast-err-file'), 'error');
    btnChangeFile.click();
  }
}

async function execAudioTranspose() {
  if (!state.audioBuffer) return;

  const semi = state.audioSemitones;
  const isCompactWav = state.audioOutputFormat === 'wav' && state.audioExportQuality === 'compact';

  if (semi === 0 && !isCompactWav) {
    showToast(t('toast-already-target'), 'error');
    return;
  }

  btnTransposeAudio.disabled = true;
  audioProcessProgress.style.display = 'block';
  processLabel.textContent = t('proc-shift', { semi: semi > 0 ? `+${semi}` : semi });
  processBar.style.width = '10%';

  try {
    const { pitchShiftAudio, encodeMP3, encodeWAV, triggerDownload } = await loadAudioModules();
    const targetSampleRate = isCompactWav ? 24000 : state.audioBuffer.sampleRate;

    const shiftedBuf = await pitchShiftAudio(
      state.audioBuffer,
      semi,
      (p) => {
        processBar.style.width = `${10 + p * 40}%`;
      },
      targetSampleRate
    );

    processLabel.textContent = t('proc-enc', { fmt: state.audioOutputFormat.toUpperCase() });

    const blob =
      state.audioOutputFormat === 'mp3'
        ? await encodeMP3(shiftedBuf, (p) => {
            processBar.style.width = `${50 + p * 50}%`;
          })
        : await encodeWAV(shiftedBuf, (p) => {
            processBar.style.width = `${50 + p * 50}%`;
          });

    processLabel.textContent = t('proc-done');
    processBar.style.width = '100%';

    const suffix = state.audioTargetKey
      ? `(${state.audioTargetKey}_${state.audioTargetMode})`
      : `(${semi > 0 ? `+${semi}` : semi}st)`;
    const outName =
      state.audioFile.name.replace(/\.[^/.]+$/, '') + `_${suffix}.${state.audioOutputFormat}`;
    triggerDownload(blob, outName);
    showToast(t('toast-dl-success'));
  } catch (e) {
    console.error(e);
    showToast(t('toast-err-trans'), 'error');
  } finally {
    setTimeout(() => {
      btnTransposeAudio.disabled = false;
      audioProcessProgress.style.display = 'none';
      processBar.style.width = '0%';
    }, 2000);
  }
}

init();
