// ─── platoo player: Record Module ───

import {
  trackCounter, setTrackCounter,
  recordedChunks,
  recordings, setRecordings,
  undoStack, redoStack, MAX_UNDO,
  practiceBPM,
  metronomeClickEnabled, setMetronomeClickEnabled,
  metroFlashInterval, setMetroFlashInterval,
  metroIndicatorEl, setMetroIndicatorEl,
  bpmDisplayEl, setBpmDisplayEl,
  mediaRecorder, setMediaRecorder,
  recordingStream, setRecordingStream,
  recordingTimer, setRecordingTimer,
  recordingStartTime, setRecordingStartTime,
  isRecording, setIsRecording,
  audioContext, setAudioContext,
  analyserNode, setAnalyserNode,
  animationFrame, setAnimationFrame,
  currentRecTrackId, setCurrentRecTrackId,
} from './state.js';

import { escapeHtml, formatSize, formatDate, formatDuration } from './utils.js';

// ─── Late-bound dependencies ───
let _addNewTrack = null;
let _autoSave = null;
let _ensureAudioCtx = null;

var currentMicId = '';
let _playMetronomeClick = null;

export function init(deps) {
  if (deps.addNewTrack) _addNewTrack = deps.addNewTrack;
  if (deps.autoSave) _autoSave = deps.autoSave;
  if (deps.ensureAudioCtx) _ensureAudioCtx = deps.ensureAudioCtx;
  if (deps.playMetronomeClick) _playMetronomeClick = deps.playMetronomeClick;

  var recordStartBtn = document.getElementById('recordStartBtn');
  var recordStopBtn = document.getElementById('recordStopBtn');
  if (recordStartBtn) {
    recordStartBtn.addEventListener('click', function () {
      if (!recordingStream) {
        requestMic(currentMicId).then(startGlobalRecord)['catch'](function () {});
      } else {
        startGlobalRecord();
      }
    });
  }
  if (recordStopBtn) {
    recordStopBtn.addEventListener('click', stopGlobalRecord);
  }
  var micSelect = document.getElementById('micSelect');
  if (micSelect) {
    micSelect.addEventListener('change', function () {
      if (isRecording) {
        micSelect.value = currentMicId;
        return;
      }
      switchMic(micSelect.value);
    });
  }
  if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
    navigator.mediaDevices.addEventListener('devicechange', refreshMicList);
  }

  // Auto-request the mic shortly after load (as the original app did) so the
  // ⏺ button becomes clickable without requiring the user to do anything first.
  setTimeout(function () {
    if (!recordingStream && !isRecording) {
      requestMic(currentMicId)['catch'](function () {});
    }
  }, 500);
}

export function refreshMicList() {
  var sel = document.getElementById('micSelect');
  if (!sel) return;
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== 'function') return;
  navigator.mediaDevices.enumerateDevices().then(function (devices) {
    var mics = devices.filter(function (d) { return d.kind === 'audioinput'; });
    var prev = sel.value;
    sel.innerHTML = '';
    var def = document.createElement('option');
    def.value = '';
    def.textContent = 'ไมโครโฟนเริ่มต้น (ระบบ)';
    sel.appendChild(def);
    mics.forEach(function (d, i) {
      var o = document.createElement('option');
      o.value = d.deviceId;
      o.textContent = d.label || ('ไมโครโฟน ' + (i + 1));
      sel.appendChild(o);
    });
    if (prev) sel.value = prev;
  })['catch'](function () {});
}

function stopCurrentStream() {
  stopLevelMeter();
  if (recordingStream) {
    if (recordingStream.getTracks) recordingStream.getTracks().forEach(function (t) { if (t.stop) t.stop(); });
    setRecordingStream(null);
  }
  if (mediaRecorder) setMediaRecorder(null);
}

export function switchMic(deviceId) {
  if (isRecording) return;
  var recordStartBtn = document.getElementById('recordStartBtn');
  if (recordStartBtn) recordStartBtn.disabled = true;
  stopCurrentStream();
  requestMic(deviceId)['catch'](function () {});
}

setRecordings(loadRecordings());

// ─── Record (compact bar + per-track) ───

export function captureTrackState() {
  var backingTracklist = document.getElementById('backingTracklist');
  var tracks = backingTracklist.querySelectorAll('.backing-track');
  var data = [];
  tracks.forEach(function (track) {
    var id = track.dataset.id;
    if (!id || !id.startsWith('track_')) return;
    data.push({
      id: id,
      type: track.dataset.type,
      icon: (track.querySelector('.track-icon') || {}).textContent || '\uD83C\uDFB5',
      name: (track.querySelector('.track-name') || {}).textContent || '',
      volume: parseInt((track.querySelector('.track-vol') || {}).value) || 80,
      pan: parseInt((track.querySelector('.pan-slider') || {}).value) || 0,
      eq_bass: parseInt((track.querySelector('.eq-slider[data-band="bass"]') || {}).value) || 0,
      eq_mid: parseInt((track.querySelector('.eq-slider[data-band="mid"]') || {}).value) || 0,
      eq_treble: parseInt((track.querySelector('.eq-slider[data-band="treble"]') || {}).value) || 0,
      muted: (track.querySelector('.track-mute') || {}).classList.contains('active'),
      solo: (track.querySelector('.track-solo') || {}).classList.contains('active')
    });
  });
  return { tracks: data, trackCounter: trackCounter };
}

export function pushUndoState() {
  undoStack.push(captureTrackState());
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
  updateUndoRedoButtons();
}

export function undo() {
  if (undoStack.length === 0) return;
  var current = captureTrackState();
  var prev = undoStack.pop();
  redoStack.push(current);
  restoreTrackState(prev);
  updateUndoRedoButtons();
}

export function redo() {
  if (redoStack.length === 0) return;
  var current = captureTrackState();
  var next = redoStack.pop();
  undoStack.push(current);
  restoreTrackState(next);
  updateUndoRedoButtons();
}

export function restoreTrackState(state) {
  var backingTracklist = document.getElementById('backingTracklist');
  var tracks = backingTracklist.querySelectorAll('.backing-track');
  tracks.forEach(function (t) {
    var id = t.dataset.id;
    if (id && id.startsWith('track_')) t.remove();
  });
  setTrackCounter(state.trackCounter || 0);
  if (state.tracks) {
    state.tracks.forEach(function (t) {
      _addNewTrack(t.type, t);
    });
  }
  _autoSave();
}

export function updateUndoRedoButtons() {
  var undoBtn = document.getElementById('undoBtn');
  var redoBtn = document.getElementById('redoBtn');
  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

export function loadRecordings() {
  try {
    const data = localStorage.getItem('platoo_recordings');
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

export function saveRecordings() {
  localStorage.setItem('platoo_recordings', JSON.stringify(recordings.map(r => ({
    id: r.id,
    name: r.name,
    duration: r.duration,
    date: r.date,
    size: r.size
  }))));
}

export async function requestMic(deviceId) {
  var recordStartBtn = document.getElementById('recordStartBtn');
  var deviceName = document.getElementById('deviceName');
  try {
    var constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      }
    };
    if (deviceId) constraints.audio.deviceId = { exact: deviceId };
    setRecordingStream(await navigator.mediaDevices.getUserMedia(constraints));
    currentMicId = deviceId || '';
    const tracks = recordingStream.getAudioTracks();
    if (tracks.length > 0) {
      deviceName.textContent = '\uD83C\uDFA4 ' + (tracks[0].label || 'ไมโครโฟน');
    }
    recordStartBtn.disabled = false;
    var micSelect = document.getElementById('micSelect');
    if (micSelect) micSelect.value = deviceId || '';
    refreshMicList();

    setAudioContext(new (window.AudioContext || window.webkitAudioContext)());
    const source = audioContext.createMediaStreamSource(recordingStream);
    setAnalyserNode(audioContext.createAnalyser());
    analyserNode.fftSize = 256;
    source.connect(analyserNode);

    setMediaRecorder(new MediaRecorder(recordingStream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' }));
    recordedChunks.length = 0;

    mediaRecorder.ondataavailable = function (e) {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = function () {
      var blob = new Blob(recordedChunks, { type: mediaRecorder ? mediaRecorder.mimeType : 'audio/webm' });
      var duration = Date.now() - recordingStartTime;
      finishTrackRecording(blob, duration);
    };

    startLevelMeter();
  } catch (err) {
    deviceName.textContent = '\u26A0 ' + err.message;
    recordStartBtn.disabled = false;
  }
}

export function startLevelMeter() {
  var levelBar = document.getElementById('levelBar');
  if (!analyserNode) return;
  var freqArray = new Uint8Array(analyserNode.frequencyBinCount);
  var waveformArray = new Uint8Array(analyserNode.fftSize);
  function tick() {
    if (!analyserNode) return;
    analyserNode.getByteFrequencyData(freqArray);
    var sum = 0;
    for (var i = 0; i < freqArray.length; i++) sum += freqArray[i];
    var avg = sum / freqArray.length;
    var pct = Math.min(100, (avg / 128) * 100);
    levelBar.style.width = pct + '%';
    if (pct > 60) levelBar.style.background = '#c33';
    else if (pct > 30) levelBar.style.background = '#888';
    else levelBar.style.background = '#555';

    if (isRecording && currentRecTrackId) {
      var backingTracklist = document.getElementById('backingTracklist');
      var trackEl = backingTracklist.querySelector('.backing-track[data-id="' + currentRecTrackId + '"]');
      if (trackEl) {
        var canvas = trackEl.querySelector('.track-waveform');
        if (canvas) {
          analyserNode.getByteTimeDomainData(waveformArray);
          var ctx = canvas.getContext('2d');
          if (ctx) {
            var w = canvas.width, h = canvas.height;
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#c33';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, h / 2);
            for (var x = 0; x < w; x++) {
              var idx = Math.floor(x / w * waveformArray.length);
              var val = (waveformArray[idx] / 128) - 1;
              ctx.lineTo(x, h / 2 + val * (h / 2 - 4));
            }
            ctx.stroke();
          }
        }
      }
    }

    setAnimationFrame(requestAnimationFrame(tick));
  }
  tick();
}

export function stopLevelMeter() {
  var levelBar = document.getElementById('levelBar');
  if (animationFrame) cancelAnimationFrame(animationFrame);
  setAnimationFrame(null);
  levelBar.style.width = '0%';
}

export function startGlobalRecord() {
  _ensureAudioCtx();
  recordedChunks.length = 0;
  setCurrentRecTrackId(null);
  if (mediaRecorder && mediaRecorder.state !== 'recording') {
    mediaRecorder.start(100);
    setIsRecording(true);
    setRecordingStartTime(Date.now());
    var recordStartBtn = document.getElementById('recordStartBtn');
    recordStartBtn.classList.add('recording');
    recordStartBtn.disabled = true;
    var recordStopBtn = document.getElementById('recordStopBtn');
    recordStopBtn.disabled = false;
    var micSelect = document.getElementById('micSelect');
    if (micSelect) micSelect.disabled = true;
    updateTimer();
    startMetronomeVisual();
  }
}

export function stopGlobalRecord() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    var wasTrackRec = currentRecTrackId;
    mediaRecorder.stop();
    setIsRecording(false);
    if (recordingTimer) clearInterval(recordingTimer);
    var recordStartBtn = document.getElementById('recordStartBtn');
    recordStartBtn.classList.remove('recording');
    recordStartBtn.disabled = false;
    var recordStopBtn = document.getElementById('recordStopBtn');
    recordStopBtn.disabled = true;
    var micSelect = document.getElementById('micSelect');
    if (micSelect) micSelect.disabled = false;
    var recordTimer = document.getElementById('recordTimer');
    recordTimer.textContent = '00:00.0';
    stopMetronomeVisual();
    if (wasTrackRec) {
      var backingTracklist = document.getElementById('backingTracklist');
      var rBtn = backingTracklist.querySelector('.backing-track[data-id="' + wasTrackRec + '"] .track-rec');
      if (rBtn) rBtn.classList.remove('active');
    }
  }
}

export function startTrackRecord(trackId) {
  _ensureAudioCtx();
  if (!mediaRecorder) {
    requestMic().then(function () {
      startTrackRecord(trackId);
    })['catch'](function () {});
    return;
  }
  recordedChunks.length = 0;
  setCurrentRecTrackId(trackId);
  if (mediaRecorder && mediaRecorder.state !== 'recording') {
    mediaRecorder.start(100);
    setIsRecording(true);
    setRecordingStartTime(Date.now());
    var recordStartBtn = document.getElementById('recordStartBtn');
    recordStartBtn.classList.add('recording');
    recordStartBtn.disabled = true;
    var recordStopBtn = document.getElementById('recordStopBtn');
    recordStopBtn.disabled = false;
    var micSelect = document.getElementById('micSelect');
    if (micSelect) micSelect.disabled = true;
    updateTimer();
    startMetronomeVisual();
  }
}

export function finishTrackRecording(blob, duration) {
  var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  var backingTracklist = document.getElementById('backingTracklist');
  var trackEl = currentRecTrackId ? backingTracklist.querySelector('.backing-track[data-id="' + currentRecTrackId + '"]') : null;
  var trackName = trackEl ? trackEl.querySelector('.track-name').textContent : 'บันทึก';
  var rec = { id: id, name: trackName + ' (' + formatDate(Date.now()) + ')', duration: duration, date: Date.now(), size: blob.size, blob: blob };
  recordings.push(rec);
  saveRecordings();
  storeBlob(id, blob);
  renderRecordings();

  if (trackEl) {
    var canvas = trackEl.querySelector('.track-waveform');
    if (canvas) drawRecordedWaveform(canvas, blob);
  }

  pushUndoState();
  setCurrentRecTrackId(null);
}

var decoderCtx = null;

function getDecoderCtx() {
  if (!decoderCtx || decoderCtx.state === 'closed') {
    decoderCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return decoderCtx;
}

export function drawRecordedWaveform(canvas, blob) {
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var ac = getDecoderCtx();
  var reader = new FileReader();
  reader.onload = function (e) {
    ac.decodeAudioData(e.target.result, function (buffer) {
      var data = buffer.getChannelData(0);
      var w = canvas.width;
      var h = canvas.height;
      var step = Math.ceil(data.length / w);
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      for (var x = 0; x < w; x++) {
        var sum = 0;
        for (var j = 0; j < step; j++) { var idx = x * step + j; if (idx < data.length) sum += Math.abs(data[idx]); }
        var val = sum / step * 2;
        ctx.lineTo(x, h / 2 - val * (h / 2));
      }
      ctx.strokeStyle = '#c33';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      for (var x2 = 0; x2 < w; x2++) {
        var sum2 = 0;
        for (var j2 = 0; j2 < step; j2++) { var idx2 = x2 * step + j2; if (idx2 < data.length) sum2 += Math.abs(data[idx2]); }
        var val2 = sum2 / step * 2;
        ctx.lineTo(x2, h / 2 + val2 * (h / 2));
      }
      ctx.fillStyle = '#c33';
      ctx.globalAlpha = 0.15;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  };
  reader.readAsArrayBuffer(blob);
}

export function updateTimer() {
  if (recordingTimer) clearInterval(recordingTimer);
  var id = setInterval(function () {
    const elapsed = Date.now() - recordingStartTime;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    const tenths = Math.floor((elapsed % 1000) / 100);
    var recordTimer = document.getElementById('recordTimer');
    recordTimer.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0') + '.' + tenths;
  }, 100);
  setRecordingTimer(id);
}

export function storeBlob(id, blob) {
  var reader = new FileReader();
  reader.onloadend = function () {
    try { localStorage.setItem('platoo_rec_blob_' + id, reader.result); } catch {}
  };
  reader.readAsDataURL(blob);
}

export function getBlobData(id) { return localStorage.getItem('platoo_rec_blob_' + id); }

export function removeRecording(index) {
  var rec = recordings[index];
  if (rec) { try { localStorage.removeItem('platoo_rec_blob_' + rec.id); } catch {} }
  recordings.splice(index, 1);
  saveRecordings();
  renderRecordings();
}

export function downloadRecording(index) {
  var rec = recordings[index];
  if (!rec) return;
  var data = getBlobData(rec.id);
  if (!data) return;
  var a = document.createElement('a');
  a.href = data; a.download = rec.name + '.webm';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

export function playRecording(index) {
  var rec = recordings[index];
  if (!rec) return;
  var data = getBlobData(rec.id);
  if (!data) return;
  var audio = new Audio(data); audio.play();
}

export function renderRecordings() {
  var recordingsList = document.getElementById('recordingsList');
  var recCount = document.getElementById('recCount');
  recordingsList.innerHTML = '';
  if (recordings.length === 0) {
    recordingsList.innerHTML = '<div class="empty-state"><span class="empty-icon">&#9673;</span><p>ยังไม่มีบันทึก</p></div>';
    recCount.textContent = '0 รายการ';
    return;
  }
  recCount.textContent = recordings.length + ' รายการ';
  recordings.forEach(function (rec, index) {
    var item = document.createElement('div');
    item.className = 'rec-item';
    item.innerHTML = '<span class="rec-icon">&#9673;</span><div class="rec-info"><div class="rec-name">' + escapeHtml(rec.name) + '</div><div class="rec-meta">' + formatDuration(rec.duration) + ' &middot; ' + formatSize(rec.size) + ' &middot; ' + formatDate(rec.date) + '</div></div><div class="rec-actions"><button class="rec-action-btn" data-action="play" data-index="' + index + '">&#9654; เล่น</button><button class="rec-action-btn" data-action="download" data-index="' + index + '">&#8595;</button><button class="rec-action-btn danger" data-action="remove" data-index="' + index + '">&times;</button></div>';
    item.querySelectorAll('.rec-action-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var action = this.dataset.action;
        var idx = parseInt(this.dataset.index);
        if (action === 'play') playRecording(idx);
        else if (action === 'download') downloadRecording(idx);
        else if (action === 'remove') removeRecording(idx);
      });
    });
    recordingsList.appendChild(item);
  });
}

// ─── Metronome Visual Functions ───

let _updateBPM = null;

export function initMetronomeUI(callbacks) {
  _updateBPM = callbacks.updateBPM;

  setMetroIndicatorEl(document.getElementById('metroIndicator'));
  setBpmDisplayEl(document.getElementById('bpmDisplay'));
  if (bpmDisplayEl) bpmDisplayEl.textContent = practiceBPM;
  var toggleBtn = document.getElementById('metroToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      setMetronomeClickEnabled(!metronomeClickEnabled);
      this.textContent = metronomeClickEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD28';
      this.classList.toggle('active', metronomeClickEnabled);
    });
  }
  var minusBtn = document.getElementById('bpmMinus');
  var plusBtn = document.getElementById('bpmPlus');
  if (minusBtn) minusBtn.addEventListener('click', function () { _updateBPM(practiceBPM - 5); updateBpmDisplay(); });
  if (plusBtn) plusBtn.addEventListener('click', function () { _updateBPM(practiceBPM + 5); updateBpmDisplay(); });
}

export function updateBpmDisplay() {
  if (bpmDisplayEl) bpmDisplayEl.textContent = practiceBPM;
}

export function startMetronomeVisual() {
  if (metroFlashInterval) return;
  var beatCount = 0;
  var id = setInterval(function () {
    beatCount = (beatCount % 4) + 1;
    var isDownbeat = beatCount === 1;

    if (metroIndicatorEl) {
      metroIndicatorEl.classList.remove('flash1', 'flash2');
      metroIndicatorEl.classList.add(isDownbeat ? 'flash1' : 'flash2');
    }

    var halfBeatMs = 60000 / practiceBPM / 2;
    setTimeout(function () {
      if (metroIndicatorEl) {
        metroIndicatorEl.classList.remove('flash1', 'flash2');
      }
    }, halfBeatMs);

    if (metronomeClickEnabled) {
      _playMetronomeClick(isDownbeat);
    }
  }, 60000 / practiceBPM);
  setMetroFlashInterval(id);
}

export function stopMetronomeVisual() {
  if (metroFlashInterval) {
    clearInterval(metroFlashInterval);
    setMetroFlashInterval(null);
  }
  if (metroIndicatorEl) {
    metroIndicatorEl.classList.remove('flash1', 'flash2');
  }
}
