import { ALL_KEYS, transposeChord, detectKeyFromChords, extractChordsFromText, getSemitoneDelta } from './music/theory.js';
import { transposeSheet, highlightChordsInText } from './music/sheetParser.js';
import { calcCapo } from './music/capoCalc.js';
import { detectAudioKey } from './audio/keyDetector.js';
import { pitchShiftAudio } from './audio/pitchShifter.js';
import { encodeWAV, encodeMP3, triggerDownload } from './audio/encoder.js';
import { drawWaveform } from './ui/waveformVisualizer.js';

// --- State ---
const state = {
  tab: 'sheet', // sheet | audio
  
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
  audioTargetKey: null,
  audioTargetMode: 'major',
  audioOutputFormat: 'wav',
  audioPreviewPlayer: null,
};

// --- DOM Elements ---
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// Tabs
const tabSheet = $('tab-sheet');
const tabAudio = $('tab-audio');
const panelSheet = $('panel-sheet');
const panelAudio = $('panel-audio');

// Sheet Elements
const chordInput = $('chord-input');
const highlightOverlay = $('highlight-overlay');
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
const audioDuration = $('audio-duration');

const audioDetecting = $('audio-detecting');
const detectProgress = $('detect-progress');
const audioKeyResult = $('audio-key-result');

const audioDetKey = $('audio-detected-key');
const confBar = $('confidence-bar');
const confPct = $('confidence-pct');

const audioKeyGrid = $('audio-key-grid');
const audioModeMajor = $('audio-mode-major');
const audioModeMinor = $('audio-mode-minor');

const fmtWav = $('fmt-wav');
const fmtMp3 = $('fmt-mp3');
const btnTransposeAudio = $('btn-transpose-audio');

const audioProcessProgress = $('audio-process-progress');
const processBar = $('process-bar');
const processLabel = $('process-label');

const toastEl = $('toast');

function showToast(msg, type = 'success') {
  toastEl.textContent = msg;
  toastEl.className = `toast show ${type}`;
  setTimeout(() => { toastEl.className = 'toast'; }, 3000);
}

// --- Initialization ---
function init() {
  bindTabs();
  bindSheetEvents();
  bindAudioEvents();
  renderKeyGrid(keyGrid, state.targetKey, state.targetMode, (key) => {
    state.targetKey = key;
    if (state.detectedKey) {
      state.semitones = getSemitoneDelta(state.detectedKey.tonic, key);
    }
    updateSheetUI();
  });
  renderKeyGrid(audioKeyGrid, state.audioTargetKey, state.audioTargetMode, (key) => {
    state.audioTargetKey = key;
    renderKeyGrid(audioKeyGrid, state.audioTargetKey, state.audioTargetMode, arguments.callee);
  });
}

// --- Tabs ---
function bindTabs() {
  tabSheet.addEventListener('click', () => {
    state.tab = 'sheet';
    tabSheet.classList.add('active'); tabAudio.classList.remove('active');
    panelSheet.classList.add('active'); panelAudio.classList.remove('active');
  });
  tabAudio.addEventListener('click', () => {
    state.tab = 'audio';
    tabAudio.classList.add('active'); tabSheet.classList.remove('active');
    panelAudio.classList.add('active'); panelSheet.classList.remove('active');
  });
}

// --- Shared Grid Render ---
function renderKeyGrid(container, activeKey, mode, onClick) {
  container.innerHTML = '';
  ALL_KEYS.forEach(k => {
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
    updateSheetSync();
  });
  
  // Highlighting is tricky with editable textarea. 
  // We'll update the output visually and just keep input plain for simplicity, 
  // or sync scroll. Let's just update the output transpose fast.

  btnClear.addEventListener('click', () => { chordInput.value = state.inputText = ''; updateSheetSync(); });
  btnSample.addEventListener('click', () => {
    chordInput.value = state.inputText = `[C]When I find myself in [G]times of trouble\n[Am]Mother Mary [F]comes to me\n[C]Speaking words of [G]wisdom, let it [F]be [C]`;
    updateSheetSync();
  });

  fmtPlain.addEventListener('click', () => { state.inputFormat = 'plain'; updateSheetFmtUI(); updateSheetSync(); });
  fmtChordpro.addEventListener('click', () => { state.inputFormat = 'chordpro'; updateSheetFmtUI(); updateSheetSync(); });

  semiDown.addEventListener('click', () => { state.semitones--; updateSheetUI(); });
  semiUp.addEventListener('click', () => { state.semitones++; updateSheetUI(); });

  modeMajor.addEventListener('click', () => { state.targetMode = 'major'; modeMajor.classList.add('active'); modeMinor.classList.remove('active'); renderKeyGrid(keyGrid, state.targetKey, 'major', updateTargetKey); updateSheetUI(); });
  modeMinor.addEventListener('click', () => { state.targetMode = 'minor'; modeMinor.classList.add('active'); modeMajor.classList.remove('active'); renderKeyGrid(keyGrid, state.targetKey, 'minor', updateTargetKey); updateSheetUI(); });

  const setPref = (pref) => { state.accidentalPref = pref; [prefAuto, prefSharps, prefFlats].forEach(b => b.classList.remove('active')); updateSheetSync(); };
  prefAuto.addEventListener('click', () => { setPref('auto'); prefAuto.classList.add('active'); });
  prefSharps.addEventListener('click', () => { setPref('sharps'); prefSharps.classList.add('active'); });
  prefFlats.addEventListener('click', () => { setPref('flats'); prefFlats.classList.add('active'); });

  btnCopy.addEventListener('click', () => {
    navigator.clipboard.writeText(outputPre.textContent).then(() => showToast('Copied to clipboard!'));
  });
  btnPrint.addEventListener('click', () => window.print());
}

function updateTargetKey(key) {
  state.targetKey = key;
  if (state.detectedKey) {
    state.semitones = getSemitoneDelta(state.detectedKey.tonic, key);
  } else {
    // Just transpose, no specific delta anchor
  }
  updateSheetUI();
}

function updateSheetFmtUI() {
  fmtPlain.classList.toggle('active', state.inputFormat === 'plain');
  fmtChordpro.classList.toggle('active', state.inputFormat === 'chordpro');
}

function updateSheetSync() {
  const txt = state.inputText;
  if (!txt.trim()) {
    detKeyDisplay.textContent = '—';
    detKeySub.textContent = 'Paste chords above to detect';
    outputEmpty.style.display = 'flex';
    outputPre.style.display = 'none';
    capoCard.style.display = 'none';
    state.detectedKey = null;
    return;
  }

  // Detect Key
  const chords = extractChordsFromText(txt);
  state.detectedKey = detectKeyFromChords(chords);
  
  if (state.detectedKey) {
    detKeyDisplay.textContent = state.detectedKey.fullDisplay;
    detKeySub.textContent = `Based on logic analysis (${chords.length} chords)`;
    if (!state.targetKey) {
      state.targetKey = state.detectedKey.tonic;
      state.targetMode = state.detectedKey.mode;
      modeMajor.classList.toggle('active', state.targetMode === 'major');
      modeMinor.classList.toggle('active', state.targetMode === 'minor');
    }
  }

  updateSheetUI();
}

function updateSheetUI() {
  semiValue.textContent = state.semitones > 0 ? `+${state.semitones}` : state.semitones;
  
  // Highlight target key in grid
  if (state.detectedKey) {
    const currentTarget = ALL_KEYS[(ALL_KEYS.indexOf(state.detectedKey.tonic) + state.semitones + 48) % 12];
    state.targetKey = currentTarget;
  }
  
  renderKeyGrid(keyGrid, state.targetKey, state.targetMode, updateTargetKey);
  
  // Run Transposition
  if (state.inputText.trim()) {
    let useFlats = false;
    if (state.accidentalPref === 'flats') useFlats = true;
    else if (state.accidentalPref === 'sharps') useFlats = false;
    else if (state.targetKey && ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'].includes(state.targetKey)) {
      useFlats = true;
    }

    const transposed = transposeSheet(state.inputText, state.semitones, useFlats);
    outputEmpty.style.display = 'none';
    outputPre.style.display = 'block';
    outputPre.innerHTML = highlightChordsInText(transposed);

    // Update Capo
    if (state.targetKey) {
      capoCard.style.display = 'block';
      capoSubtitle.textContent = `To play in keys matching target (${state.targetKey})`;
      const caps = calcCapo(state.targetKey, state.targetMode);
      capoGrid.innerHTML = caps.map(c => `
        <div class="capo-item">
          <div class="capo-fret">${c.label}</div>
          <div class="capo-chords">${c.chords}</div>
          <div class="capo-key">Play using ${c.shapeKey} shapes</div>
        </div>
      `).join('');
    }
  }
}

// --- Audio Mode ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function bindAudioEvents() {
  uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault(); uploadZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleAudioFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleAudioFile(e.target.files[0]);
  });

  btnChangeFile.addEventListener('click', () => {
    state.audioFile = null; state.audioBuffer = null;
    if (state.audioPreviewPlayer) { state.audioPreviewPlayer.stop(); }
    uploadCard.style.display = 'block';
    audioAnalysisPnl.style.display = 'none';
  });

  btnPlayPreview.addEventListener('click', () => {
    if (!state.audioBuffer) return;
    if (state.audioPreviewPlayer) {
      state.audioPreviewPlayer.stop();
      state.audioPreviewPlayer = null;
      btnPlayPreview.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Preview`;
    } else {
      const source = audioCtx.createBufferSource();
      source.buffer = state.audioBuffer;
      source.connect(audioCtx.destination);
      source.start();
      state.audioPreviewPlayer = source;
      source.onended = () => {
        state.audioPreviewPlayer = null;
        btnPlayPreview.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Preview`;
      };
      btnPlayPreview.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Stop`;
    }
  });

  audioModeMajor.addEventListener('click', () => { state.audioTargetMode = 'major'; audioModeMajor.classList.add('active'); audioModeMinor.classList.remove('active'); renderKeyGrid(audioKeyGrid, state.audioTargetKey, 'major', updateAudioTargetKey); });
  audioModeMinor.addEventListener('click', () => { state.audioTargetMode = 'minor'; audioModeMinor.classList.add('active'); audioModeMajor.classList.remove('active'); renderKeyGrid(audioKeyGrid, state.audioTargetKey, 'minor', updateAudioTargetKey); });

  fmtWav.addEventListener('click', () => { state.audioOutputFormat = 'wav'; fmtWav.classList.add('active'); fmtMp3.classList.remove('active'); });
  fmtMp3.addEventListener('click', () => { state.audioOutputFormat = 'mp3'; fmtMp3.classList.add('active'); fmtWav.classList.remove('active'); });

  btnTransposeAudio.addEventListener('click', execAudioTranspose);
}

function updateAudioTargetKey(key) {
  state.audioTargetKey = key;
  renderKeyGrid(audioKeyGrid, key, state.audioTargetMode, updateAudioTargetKey);
}

async function handleAudioFile(file) {
  state.audioFile = file;
  uploadCard.style.display = 'none';
  audioAnalysisPnl.style.display = 'block';
  audioDetecting.style.display = 'flex';
  audioKeyResult.style.display = 'none';
  
  audioFilename.textContent = file.name;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const clonedBuffer = arrayBuffer.slice(0); // in case decode clears it
    
    // Resume context if needed
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    
    const audioBuf = await audioCtx.decodeAudioData(arrayBuffer);
    state.audioBuffer = audioBuf;
    audioDuration.textContent = formatTime(audioBuf.duration);
    
    // Draw Waveform
    drawWaveform(waveformCanvas, audioBuf);

    // Detect Key
    detectProgress.style.width = '0%';
    const detResult = await detectAudioKey(audioBuf, (pct) => {
      detectProgress.style.width = `${pct * 100}%`;
    });

    state.audioDetectedKey = detResult;
    
    audioDetecting.style.display = 'none';
    audioKeyResult.style.display = 'block';

    audioDetKey.textContent = detResult ? detResult.text : 'Unknown';
    if (detResult) {
      confBar.style.width = `${detResult.confidence}%`;
      confPct.textContent = `${detResult.confidence}%`;
      
      // Auto set target
      state.audioTargetKey = detResult.tonic;
      state.audioTargetMode = detResult.mode;
      audioModeMajor.classList.toggle('active', state.audioTargetMode === 'major');
      audioModeMinor.classList.toggle('active', state.audioTargetMode === 'minor');
      renderKeyGrid(audioKeyGrid, state.audioTargetKey, state.audioTargetMode, updateAudioTargetKey);
    }

  } catch (err) {
    console.error(err);
    alert("Error processing audio file. Make sure it's a valid audio format.");
    btnChangeFile.click();
  }
}

async function execAudioTranspose() {
  if (!state.audioBuffer || !state.audioDetectedKey) return;
  if (!state.audioTargetKey) {
    showToast('Select a target key', 'error'); return;
  }

  const semi = getSemitoneDelta(state.audioDetectedKey.tonic, state.audioTargetKey);
  if (semi === 0 && state.audioDetectedKey.mode === state.audioTargetMode) {
    showToast('Already in target key', 'error'); return;
  }

  btnTransposeAudio.disabled = true;
  audioProcessProgress.style.display = 'block';
  processLabel.textContent = `Pitch Shifting (${semi > 0 ? '+'+semi : semi} steps)...`;
  processBar.style.width = '10%';

  try {
    const shiftedBuf = await pitchShiftAudio(state.audioBuffer, semi, (p) => {
      processBar.style.width = `${10 + p*40}%`;
    });

    processLabel.textContent = `Encoding ${state.audioOutputFormat.toUpperCase()}...`;
    
    let blob;
    if (state.audioOutputFormat === 'mp3') {
      blob = await encodeMP3(shiftedBuf, (p) => {
        processBar.style.width = `${50 + p*50}%`;
      });
    } else {
      blob = await encodeWAV(shiftedBuf, (p) => {
        processBar.style.width = `${50 + p*50}%`;
      });
    }

    processLabel.textContent = "Done!";
    processBar.style.width = '100%';

    const outName = state.audioFile.name.replace(/\.[^/.]+$/, "") + `_(${state.audioTargetKey}_${state.audioTargetMode}).${state.audioOutputFormat}`;
    triggerDownload(blob, outName);
    showToast('Downloaded successfully!');

  } catch (e) {
    console.error(e);
    showToast('Error during transposition', 'error');
  } finally {
    setTimeout(() => {
      btnTransposeAudio.disabled = false;
      audioProcessProgress.style.display = 'none';
      processBar.style.width = '0%';
    }, 2000);
  }
}

// Start
init();
