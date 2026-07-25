// ─── platoo-player: Entry Point ───
// Wires all modules together and initializes the app.

import * as State from './state.js';
import { escapeHtml, formatSize, formatDate, formatDuration } from './utils.js';

// Import modules
import { renderSongs, removeSong, handleFile } from './upload.js';
import { initInstrumentsPanel, initVirtualInstruments, initKeyboardShortcuts } from './instruments.js';
import {
  init as initAudioEngine,
  startBacking, stopBacking, pauseBacking, loadBackingTrack,
  createBackingGains, updateSoloMute, drawWaveform, updatePlayhead,
  bounceMixdown, encodeWAV, trimTrackStart as trimStart, trimTrackEnd as trimEnd,
  startMetronome, stopMetronome, updateBPM, tapTempo,
  setLoopStart as planSetLoopStart, setLoopEnd as planSetLoopEnd,
  toggleLoop, updateLoopDisplay, updateSpeed, startPractice,
  playMetronomeClick
} from './audio-engine.js';
import {
  init as initRecord,
  pushUndoState, undo, redo, restoreTrackState,
  updateUndoRedoButtons, requestMic,
  startGlobalRecord, stopGlobalRecord, startTrackRecord,
  renderRecordings, initMetronomeUI, updateBpmDisplay,
  startMetronomeVisual, stopMetronomeVisual,
  drawRecordedWaveform
} from './record.js';
import { initSession, autoSave, saveSession, loadSession, loadSongs, saveSongs } from './session.js';
import { initAddTrack, addNewTrack, trimTrackStart, trimTrackEnd } from './add-track.js';
import { initPlanModeListeners } from './plan-mode.js';
import {
  initUploadEvents, initMobileMenu, closeSidebar,
  initTabNavigation, initTrackDragDrop, initShortcutsOverlay,
  initErrorBoundary
} from './ui.js';

// ─── Ensure AudioContext ───
function ensureAudioCtx() {
  if (!State.backingAudioCtx) {
    try { State.setBackingAudioCtx(new (window.AudioContext || window.webkitAudioContext)()); } catch {}
  }
  if (State.backingAudioCtx) {
    if (State.backingAudioCtx.state === 'suspended') {
      State.backingAudioCtx.resume()['catch'](function () {});
    }
    if (!State.masterGain) {
      var mg = State.backingAudioCtx.createGain();
      mg.gain.value = 0.8;
      mg.connect(State.backingAudioCtx.destination);
      State.setMasterGain(mg);
    }
    var checkInterval = setInterval(function () {
      if (State.backingAudioCtx && State.backingAudioCtx.state === 'suspended') {
        State.backingAudioCtx.resume()['catch'](function () {});
      } else {
        clearInterval(checkInterval);
      }
    }, 2000);
  }
}

// ─── Init everything on user gesture ───
function initOnGesture() {
  ensureAudioCtx();
  document.removeEventListener('click', initOnGesture);
  document.removeEventListener('touchstart', initOnGesture);
  document.removeEventListener('keydown', initOnGesture);
}

document.addEventListener('click', initOnGesture, { once: true });
document.addEventListener('touchstart', initOnGesture, { once: true });
document.addEventListener('keydown', initOnGesture, { once: true });

// ─── Wire up all modules ───

// Session (needs addNewTrack)
initSession({ addNewTrackFn: addNewTrack });

// Audio Engine (needs callbacks from other modules)
initAudioEngine({
  startMetronomeVisual: startMetronomeVisual,
  stopMetronomeVisual: stopMetronomeVisual,
  updateBpmDisplay: updateBpmDisplay,
  pushUndoState: pushUndoState,
  autoSave: autoSave,
  addNewTrack: addNewTrack,
  closeSidebar: closeSidebar,
  startMetronome: startMetronome,
  stopMetronome: stopMetronome
});

// Record module (needs callbacks)
initRecord({
  addNewTrack: addNewTrack,
  autoSave: autoSave,
  ensureAudioCtx: ensureAudioCtx,
  playMetronomeClick: playMetronomeClick
});

// Add Track module - pass getter functions for recording state
initAddTrack({
  showInstrumentUI: function(type) { initVirtualInstruments(); },
  pushUndoState: pushUndoState,
  startTrackRecord: startTrackRecord,
  stopGlobalRecord: stopGlobalRecord,
  requestMic: requestMic,
  autoSave: autoSave,
  drawRecordedWaveform: drawRecordedWaveform,
  isRecording: function() { return State.isRecording; },
  recordingStream: function() { return State.recordingStream; },
  currentRecTrackId: function() { return State.currentRecTrackId; }
});

// UI modules
initMobileMenu();
initTabNavigation();
initUploadEvents({ handleFile: handleFile });
initTrackDragDrop({ pushUndoState: pushUndoState, autoSave: autoSave });
initShortcutsOverlay({ undo: undo, redo: redo });
initErrorBoundary();

// Instruments panel
initInstrumentsPanel(closeSidebar);

// Virtual instruments + keyboard shortcuts
initVirtualInstruments();
initKeyboardShortcuts();

// Plan mode listeners
initPlanModeListeners({
  updateBPM: updateBPM,
  tapTempo: tapTempo,
  startMetronome: startMetronome,
  stopMetronome: stopMetronome,
  toggleLoop: toggleLoop,
  setLoopStart: planSetLoopStart,
  setLoopEnd: planSetLoopEnd,
  updateSpeed: updateSpeed,
  startPractice: startPractice,
  updateLoopDisplay: updateLoopDisplay
});

// Metronome UI
initMetronomeUI(updateBPM, startMetronome, stopMetronome);

// Load saved data
renderSongs();
loadSession();
renderRecordings();

// Undo/Redo buttons
var undoBtn = document.getElementById('undoBtn');
var redoBtn = document.getElementById('redoBtn');
if (undoBtn) undoBtn.addEventListener('click', undo);
if (redoBtn) redoBtn.addEventListener('click', redo);
updateUndoRedoButtons();

// ─── Export globals needed by other modules ───
window._platoo = {
  ensureAudioCtx: ensureAudioCtx,
  pushUndoState: pushUndoState,
  autoSave: autoSave,
  addNewTrack: addNewTrack
};
