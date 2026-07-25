import { trackCounter, setTrackCounter, activeOscillators, backingBuffer } from './state.js';
import { escapeHtml } from './utils.js';

let deps = {};

export function initAddTrack(d) {
  deps = d;
  var addTrackBtn = document.getElementById('addTrackBtn');
  var addTrackModal = document.getElementById('addTrackModal');
  var modalCloseBtn = document.getElementById('modalCloseBtn');

  addTrackBtn.addEventListener('click', function () {
    addTrackModal.classList.add('open');
  });

  modalCloseBtn.addEventListener('click', closeModal);
  addTrackModal.addEventListener('click', function (e) {
    if (e.target === addTrackModal) closeModal();
  });

  addTrackModal.querySelectorAll('.modal-option').forEach(function (opt) {
    opt.addEventListener('click', function () {
      var type = this.dataset.type;
      closeModal();
      addNewTrack(type);
    });
  });
}

export function closeModal() {
  var addTrackModal = document.getElementById('addTrackModal');
  addTrackModal.classList.remove('open');
}

export function addNewTrack(type, restoreData) {
  var backingTracklist = document.getElementById('backingTracklist');
  if (!restoreData) deps.pushUndoState();
  var id, icon, label, vol, pan, eqBass, eqMid, eqTreble, muteActive, soloActive;

  if (restoreData) {
    id = restoreData.id;
    icon = restoreData.icon;
    label = restoreData.name;
    vol = restoreData.volume;
    pan = restoreData.pan;
    eqBass = restoreData.eq_bass;
    eqMid = restoreData.eq_mid;
    eqTreble = restoreData.eq_treble;
    muteActive = restoreData.muted;
    soloActive = restoreData.solo;
    var num = parseInt(id.replace('track_', ''));
    if (num > trackCounter) setTrackCounter(num);
  } else {
    setTrackCounter(trackCounter + 1);
    id = 'track_' + trackCounter;
    var icons = { audio: '🎤', piano: '🎹', guitar: '🎸', bass: '🎸', drums: '🥁' };
    var labels = { audio: 'อัดเสียง ' + trackCounter, piano: 'เปียโน ' + trackCounter, guitar: 'กีตาร์ ' + trackCounter, bass: 'เบส ' + trackCounter, drums: 'กลอง ' + trackCounter };
    icon = icons[type] || '🎵';
    label = labels[type] || 'แทร็ก ' + trackCounter;
    vol = 80;
    pan = 0;
    eqBass = 0;
    eqMid = 0;
    eqTreble = 0;
    muteActive = false;
    soloActive = false;
  }

  if (type !== 'audio') {
    deps.showInstrumentUI(type);
  }

  var track = document.createElement('div');
  track.className = 'backing-track';
  track.dataset.id = id;
  track.dataset.type = type;
  var borderColors = { audio: '#888', piano: '#5b8def', guitar: '#5a5', bass: '#e68a3f', drums: '#c33' };
  track.style.borderLeftColor = borderColors[type] || '#888';

  var panText = pan === 0 ? 'C' : pan > 0 ? pan + 'R' : -pan + 'L';

  track.innerHTML = [
    '<div class="backing-track-header">',
    '  <span class="track-icon">' + icon + '</span>',
    '  <span class="track-name">' + label + '</span>',
    '  <div class="track-btns">',
    '    <button class="track-btn track-play' + (restoreData && restoreData.playing ? ' active' : '') + '" data-id="' + id + '">&#9654;</button>',
    '    <button class="track-btn track-mute' + (muteActive ? ' active' : '') + '" data-id="' + id + '">M</button>',
    '    <button class="track-btn track-solo' + (soloActive ? ' active' : '') + '" data-id="' + id + '">S</button>',
    '    <button class="track-btn track-rec" data-id="' + id + '">R</button>',
    '  </div>',
    '</div>',
    '<div class="backing-track-body">',
    '  <div class="track-controls-col">',
    '    <div class="track-vol-row">',
    '      <span class="vol-label">V</span>',
    '      <input type="range" min="0" max="100" value="' + vol + '" class="track-vol" data-id="' + id + '">',
    '      <span class="vol-value">' + vol + '</span>',
    '    </div>',
    '    <div class="track-pan-row">',
    '      <span class="pan-label">P</span>',
    '      <input type="range" min="-50" max="50" value="' + pan + '" class="pan-slider" data-id="' + id + '">',
    '      <span class="pan-value">' + panText + '</span>',
    '    </div>',
    '  </div>',
    '  <canvas class="track-waveform" width="400" height="60"></canvas>',
    '</div>',
    '<div class="track-eq-row" data-id="' + id + '">',
    '  <span class="eq-label">B</span>',
    '  <input type="range" min="-12" max="12" value="' + eqBass + '" class="eq-slider" data-id="' + id + '" data-band="bass"><span class="eq-value">' + eqBass + '</span>',
    '  <span class="eq-label">M</span>',
    '  <input type="range" min="-12" max="12" value="' + eqMid + '" class="eq-slider" data-id="' + id + '" data-band="mid"><span class="eq-value">' + eqMid + '</span>',
    '  <span class="eq-label">T</span>',
    '  <input type="range" min="-12" max="12" value="' + eqTreble + '" class="eq-slider" data-id="' + id + '" data-band="treble"><span class="eq-value">' + eqTreble + '</span>',
    '</div>',
    '<div class="track-actions-bar">',
    '  <button class="track-act-btn" data-action="trim-start">ตัดหัว</button>',
    '  <button class="track-act-btn" data-action="trim-end">ตัดท้าย</button>',
    '  <button class="track-act-btn" data-action="remove">ลบแทร็ก</button>',
    '</div>'
  ].join('');

  // Play button
  track.querySelector('.track-play').addEventListener('click', function () {
    this.classList.toggle('active');
  });

  // Rec button
  track.querySelector('.track-rec').addEventListener('click', function () {
    var self = this;
    this.classList.toggle('active');
    if (this.classList.contains('active')) {
      // Stop any other recording first
      if (deps.isRecording()) {
        deps.stopGlobalRecord();
        // Small delay to let previous stop complete
      }
      if (!deps.recordingStream()) {
        deps.requestMic().then(function () {
          deps.startTrackRecord(id);
        })['catch'](function () {
          self.classList.remove('active');
        });
      } else {
        deps.startTrackRecord(id);
      }
    } else {
      // Turning off rec — stop recording
      if (deps.isRecording() && deps.currentRecTrackId() === id) {
        deps.stopGlobalRecord();
      }
    }
  });

  // Mute
  track.querySelector('.track-mute').addEventListener('click', function () {
    this.classList.toggle('active');
    deps.autoSave();
  });

  // Solo
  track.querySelector('.track-solo').addEventListener('click', function () {
    this.classList.toggle('active');
    deps.autoSave();
  });

  // Volume
  track.querySelector('.track-vol').addEventListener('input', function () {
    var val = this.nextElementSibling;
    if (val) val.textContent = this.value;
    deps.autoSave();
  });

  // Pan
  track.querySelector('.pan-slider').addEventListener('input', function () {
    var val = this.nextElementSibling;
    var v = parseInt(this.value);
    if (val) val.textContent = v === 0 ? 'C' : v > 0 ? v + 'R' : -v + 'L';
    deps.autoSave();
  });

  // EQ sliders
  track.querySelectorAll('.eq-slider').forEach(function (s) {
    s.addEventListener('input', function () {
      var val = this.parentNode.querySelector('.eq-value');
      if (val) val.textContent = this.value;
      deps.autoSave();
    });
  });

  // Actions
  track.querySelectorAll('.track-act-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var action = this.dataset.action;
      if (action === 'remove') {
        deps.pushUndoState();
        track.remove();
        deps.autoSave();
      } else if (action === 'trim-start') {
        trimTrackStart(id);
      } else if (action === 'trim-end') {
        trimTrackEnd(id);
      }
    });
  });

  var emptyEl = backingTracklist.querySelector('.backing-empty');
  if (emptyEl) emptyEl.remove();
  backingTracklist.appendChild(track);

  // Draw empty waveform
  var canvas = track.querySelector('.track-waveform');
  if (canvas) {
    var ctx = canvas.getContext('2d');
    if (ctx) { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  }
}

export function trimTrackStart(id) {
  var backingTracklist = document.getElementById('backingTracklist');
  var track = backingTracklist.querySelector('.backing-track[data-id="' + id + '"]');
  if (!track || !backingBuffer) return;
  var canvas = track.querySelector('.track-waveform');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var w = canvas.width, h = canvas.height;
  var trimPct = 0.2;
  var data = backingBuffer.getChannelData(0);
  var startIdx = Math.floor(data.length * trimPct);
  var step = Math.ceil((data.length - startIdx) / w);
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h);
  ctx.beginPath(); ctx.moveTo(0, h / 2);
  for (var x = 0; x < w; x++) {
    var sum = 0;
    for (var j = 0; j < step; j++) { var idx = startIdx + x * step + j; if (idx < data.length) sum += Math.abs(data[idx]); }
    ctx.lineTo(x, h / 2 - sum / step * 2 * (h / 2));
  }
  ctx.strokeStyle = '#888'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, h / 2);
  for (var x2 = 0; x2 < w; x2++) {
    var sum2 = 0;
    for (var j2 = 0; j2 < step; j2++) { var idx2 = startIdx + x2 * step + j2; if (idx2 < data.length) sum2 += Math.abs(data[idx2]); }
    ctx.lineTo(x2, h / 2 + sum2 / step * 2 * (h / 2));
  }
  ctx.fillStyle = '#888'; ctx.globalAlpha = 0.15; ctx.fill(); ctx.globalAlpha = 1;
}

export function trimTrackEnd(id) {
  var backingTracklist = document.getElementById('backingTracklist');
  var track = backingTracklist.querySelector('.backing-track[data-id="' + id + '"]');
  if (!track || !backingBuffer) return;
  var canvas = track.querySelector('.track-waveform');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var w = canvas.width, h = canvas.height;
  var trimPct = 0.8;
  var data = backingBuffer.getChannelData(0);
  var endIdx = Math.floor(data.length * trimPct);
  var step = Math.ceil(endIdx / w);
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h);
  ctx.beginPath(); ctx.moveTo(0, h / 2);
  for (var x = 0; x < w; x++) {
    var sum = 0;
    for (var j = 0; j < step; j++) { var idx = x * step + j; if (idx < endIdx) sum += Math.abs(data[idx]); }
    ctx.lineTo(x, h / 2 - sum / step * 2 * (h / 2));
  }
  ctx.strokeStyle = '#888'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, h / 2);
  for (var x2 = 0; x2 < w; x2++) {
    var sum2 = 0;
    for (var j2 = 0; j2 < step; j2++) { var idx2 = x2 * step + j2; if (idx2 < endIdx) sum2 += Math.abs(data[idx2]); }
    ctx.lineTo(x2, h / 2 + sum2 / step * 2 * (h / 2));
  }
  ctx.fillStyle = '#888'; ctx.globalAlpha = 0.15; ctx.fill(); ctx.globalAlpha = 1;
}
