// ─── platoo-player: Audio Engine (ES Module) ───
// Extracted from app.js – backing track, plan mode, bounce/export, trim helpers, waveform seek

import {
  instruments,
  instState,
  backingGainNodes,
  backingPanNodes,
  backingDistNodes,
  backingDelayNodes,
  backingDelayFeedback,
  backingDelayWet,
  backingReverbNodes,
  backingReverbWet,
  backingEqBass,
  backingEqMid,
  backingEqTreble,
  tapTimes,
  backingAudioCtx,
  masterGain,
  backingSource,
  backingBuffer,
  backingIsPlaying,
  backingStartOffset,
  backingStartTime,
  activePlayTrack,
  playheadAnimId,
  practiceBPM,
  metroFlashInterval,
} from './state.js';

import {
  setBackingAudioCtx,
  setMasterGain,
  setBackingSource,
  setBackingBuffer,
  setBackingIsPlaying,
  setBackingStartOffset,
  setBackingStartTime,
  setActivePlayTrack,
  setPlayheadAnimId,
  setPracticeBPM,
} from './state.js';

import { escapeHtml } from './utils.js';

// ─── DOM References (initialized in init()) ───
let backingSelectBtn = null;
let backingFileInput = null;
let backingFilename = null;
let backingPlayBtn = null;
let backingPauseBtn = null;
let backingStopBtn = null;
let backingTracklist = null;

// ─── Callback Dependencies (set via init()) ───
let _startMetronomeVisual = null;
let _stopMetronomeVisual = null;
let _pushUndoState = null;
let _autoSave = null;
let _addNewTrack = null;
let _closeSidebar = null;
let _updateBpmDisplay = null;

// ─── Init: receive circular deps & wire up global event listeners ───
export function init(deps) {
  _startMetronomeVisual = deps.startMetronomeVisual || function () {};
  _stopMetronomeVisual = deps.stopMetronomeVisual || function () {};
  _pushUndoState = deps.pushUndoState || function () {};
  _autoSave = deps.autoSave || function () {};
  _addNewTrack = deps.addNewTrack || function () {};
  _closeSidebar = deps.closeSidebar || function () {};
  _updateBpmDisplay = deps.updateBpmDisplay || function () {};

  backingSelectBtn = document.getElementById('backingSelectBtn');
  backingFileInput = document.getElementById('backingFileInput');
  backingFilename = document.getElementById('backingFilename');
  backingPlayBtn = document.getElementById('backingPlayBtn');
  backingPauseBtn = document.getElementById('backingPauseBtn');
  backingStopBtn = document.getElementById('backingStopBtn');
  backingTracklist = document.getElementById('backingTracklist');

  backingSelectBtn.addEventListener('click', function () {
    backingFileInput.click();
  });

  backingFileInput.addEventListener('change', function () {
    var file = this.files && this.files[0];
    if (!file || !file.type.startsWith('audio/')) return;
    backingFilename.textContent = file.name;
    loadBackingTrack(file);
    this.value = '';
  });

  backingPlayBtn.addEventListener('click', startBacking);
  backingPauseBtn.addEventListener('click', pauseBacking);
  backingStopBtn.addEventListener('click', stopBacking);

  document.getElementById('bounceBtn').addEventListener('click', bounceMixdown);

  backingTracklist.addEventListener('click', function (e) {
    var canvas = e.target.closest('.track-waveform');
    if (!canvas || !backingBuffer || !backingIsPlaying) return;
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var pct = x / canvas.width;
    var duration = backingBuffer.duration;
    setBackingStartOffset(pct * duration);
    if (backingSource) {
      try { backingSource.stop(); } catch {}
      backingSource.disconnect();
    }
    startBacking();
  });
}

// ─── Backing Track (GarageBand-style) ───

var waveCache = {};

function renderWaveformTo(ctx, buffer, w, h, color) {
  var data = buffer.getChannelData(0);
  var step = Math.ceil(data.length / w);
  var amp = h / 2;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, w, h);

  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  for (var x = 0; x < w; x++) {
    var sum = 0;
    for (var j = 0; j < step; j++) {
      var idx = x * step + j;
      if (idx < data.length) sum += Math.abs(data[idx]);
    }
    var val = sum / step * 2;
    var y = amp - val * amp;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h / 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  for (var x2 = 0; x2 < w; x2++) {
    var sum2 = 0;
    for (var j2 = 0; j2 < step; j2++) {
      var idx2 = x2 * step + j2;
      if (idx2 < data.length) sum2 += Math.abs(data[idx2]);
    }
    var val2 = sum2 / step * 2;
    var y2 = amp + val2 * amp;
    ctx.lineTo(x2, y2);
  }
  ctx.lineTo(w, h / 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.15;
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawWaveform(id, canvas) {
  if (!backingBuffer || !canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var w = canvas.width;
  var h = canvas.height;
  var colorMap = { vocal: '#5b8def', drums: '#e6c340', bass: '#6dbf6d', guitar: '#e68a3f', piano: '#c473d1', other: '#6ab0c9' };
  var color = colorMap[id] || '#888';
  var cached = waveCache[id];
  if (!cached || cached.buffer !== backingBuffer || cached.w !== w || cached.h !== h) {
    var off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    renderWaveformTo(off.getContext('2d'), backingBuffer, w, h, color);
    cached = waveCache[id] = { buffer: backingBuffer, w: w, h: h, canvas: off };
  }
  ctx.drawImage(cached.canvas, 0, 0);
}

export function updatePlayhead() {
  if (!backingBuffer || !backingIsPlaying) return;
  var duration = backingBuffer.duration;
  var elapsed = (Date.now() - backingStartTime) / 1000;
  var displayPos = elapsed;
  var pct = Math.min(1, Math.max(0, displayPos / duration));
  document.querySelectorAll('.backing-track').forEach(function (track) {
    var canvas = track.querySelector('.track-waveform');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var w = canvas.width;
    var h = canvas.height;
    var x = pct * w;
    var id = track.dataset.id;
    drawWaveform(id, canvas);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
  if (backingIsPlaying) setPlayheadAnimId(requestAnimationFrame(updatePlayhead));
}

export function initBackingTracks() {
  backingTracklist.innerHTML = '';
  instruments.forEach(function (inst) {
    if (instState[inst.id] === undefined) instState[inst.id] = 80;
    if (instState[inst.id + '_muted'] === undefined) instState[inst.id + '_muted'] = false;
    if (instState[inst.id + '_solo'] === undefined) instState[inst.id + '_solo'] = false;
    if (instState[inst.id + '_pan'] === undefined) instState[inst.id + '_pan'] = 0;
    if (instState[inst.id + '_fx_reverb'] === undefined) instState[inst.id + '_fx_reverb'] = 0;
    if (instState[inst.id + '_fx_delay'] === undefined) instState[inst.id + '_fx_delay'] = 0;
    if (instState[inst.id + '_fx_distortion'] === undefined) instState[inst.id + '_fx_distortion'] = 0;
    if (instState[inst.id + '_eq_bass'] === undefined) instState[inst.id + '_eq_bass'] = 0;
    if (instState[inst.id + '_eq_mid'] === undefined) instState[inst.id + '_eq_mid'] = 0;
    if (instState[inst.id + '_eq_treble'] === undefined) instState[inst.id + '_eq_treble'] = 0;
    if (!backingGainNodes[inst.id]) backingGainNodes[inst.id] = null;

    var track = document.createElement('div');
    track.className = 'backing-track';
    track.dataset.id = inst.id;

    var muted = instState[inst.id + '_muted'];
    var soloed = instState[inst.id + '_solo'];
    var pan = instState[inst.id + '_pan'];

    var isActive = activePlayTrack === inst.id && backingIsPlaying;

    track.innerHTML = `
      <div class="backing-track-header">
        <span class="track-icon">${inst.icon}</span>
        <span class="track-name">${inst.label}</span>
        <div class="track-btns">
          <button class="track-btn track-play${isActive ? ' active' : ''}" data-id="${inst.id}" data-action="play">${isActive ? '\u23F8' : '\u25B6'}</button>
          <button class="track-btn track-mute${muted ? ' active' : ''}" data-id="${inst.id}" data-action="mute">M</button>
          <button class="track-btn track-solo${soloed ? ' active' : ''}" data-id="${inst.id}" data-action="solo">S</button>
          <button class="track-btn track-fx" data-id="${inst.id}" data-action="fx">FX</button>
          <button class="track-btn track-rec" data-id="${inst.id}" data-action="rec">R</button>
        </div>
      </div>
      <div class="backing-track-body">
        <div class="track-controls-col">
          <div class="track-vol-row">
            <span class="vol-label">V</span>
            <input type="range" min="0" max="100" value="${instState[inst.id]}" class="track-vol" data-id="${inst.id}">
            <span class="vol-value" id="tvol_${inst.id}">${instState[inst.id]}</span>
          </div>
          <div class="track-pan-row">
            <span class="pan-label">P</span>
            <input type="range" min="-50" max="50" value="${pan}" class="pan-slider" data-id="${inst.id}">
            <span class="pan-value" id="tpan_${inst.id}">${pan === 0 ? 'C' : pan > 0 ? pan + 'R' : -pan + 'L'}</span>
          </div>
        </div>
        <canvas class="track-waveform" id="waveform_${inst.id}" width="400" height="60"></canvas>
      </div>
      <div class="track-fx-panel" id="fx_${inst.id}" style="display:none">
        <div class="fx-row">
          <span class="fx-label">Reverb</span>
          <input type="range" min="0" max="100" value="${instState[inst.id + '_fx_reverb'] || 0}" class="fx-slider" data-id="${inst.id}" data-fx="reverb">
          <span class="fx-val" id="fxval_${inst.id}_reverb">${instState[inst.id + '_fx_reverb'] || 0}</span>
        </div>
        <div class="fx-row">
          <span class="fx-label">Delay</span>
          <input type="range" min="0" max="100" value="${instState[inst.id + '_fx_delay'] || 0}" class="fx-slider" data-id="${inst.id}" data-fx="delay">
          <span class="fx-val" id="fxval_${inst.id}_delay">${instState[inst.id + '_fx_delay'] || 0}</span>
        </div>
        <div class="fx-row">
          <span class="fx-label">Distort</span>
          <input type="range" min="0" max="100" value="${instState[inst.id + '_fx_distortion'] || 0}" class="fx-slider" data-id="${inst.id}" data-fx="distortion">
          <span class="fx-val" id="fxval_${inst.id}_distortion">${instState[inst.id + '_fx_distortion'] || 0}</span>
        </div>
      </div>
      <div class="track-eq-row" data-id="${inst.id}">
        <span class="eq-label">B</span>
        <input type="range" min="-12" max="12" value="${instState[inst.id + '_eq_bass'] || 0}" class="eq-slider" data-id="${inst.id}" data-band="bass"><span class="eq-value">${instState[inst.id + '_eq_bass'] || 0}</span>
        <span class="eq-label">M</span>
        <input type="range" min="-12" max="12" value="${instState[inst.id + '_eq_mid'] || 0}" class="eq-slider" data-id="${inst.id}" data-band="mid"><span class="eq-value">${instState[inst.id + '_eq_mid'] || 0}</span>
        <span class="eq-label">T</span>
        <input type="range" min="-12" max="12" value="${instState[inst.id + '_eq_treble'] || 0}" class="eq-slider" data-id="${inst.id}" data-band="treble"><span class="eq-value">${instState[inst.id + '_eq_treble'] || 0}</span>
      </div>
    `;

    var volSlider = track.querySelector('.track-vol');
    var volVal = track.querySelector('.vol-value');
    volSlider.addEventListener('input', function () {
      var id = this.dataset.id;
      var v = parseInt(this.value);
      instState[id] = v;
      volVal.textContent = v;
      if (backingGainNodes[id]) {
        backingGainNodes[id].gain.value = instState[id + '_muted'] ? 0 : v / 100;
      }
    });

    var playBtn = track.querySelector('.track-play');
    playBtn.addEventListener('click', function () {
      var id = this.dataset.id;
      if (activePlayTrack === id && backingIsPlaying) {
        pauseBacking();
        setActivePlayTrack(null);
        this.textContent = '\u25B6';
        this.classList.remove('active');
      } else {
        instruments.forEach(function (i) {
          instState[i.id + '_solo'] = i.id === id;
        });
        setActivePlayTrack(id);
        this.textContent = '\u23F8';
        this.classList.add('active');
        updateSoloMute();
        createBackingGains();
        if (!backingIsPlaying || backingStartOffset === 0) {
          setBackingStartOffset(0);
          startBacking();
        } else {
          setBackingStartOffset(0);
          if (backingSource) { try { backingSource.stop(); } catch {}; backingSource.disconnect(); }
          startBacking();
        }
      }
    });

    var muteBtn = track.querySelector('.track-mute');
    muteBtn.addEventListener('click', function () {
      var id = this.dataset.id;
      instState[id + '_muted'] = !instState[id + '_muted'];
      this.classList.toggle('active');
      if (backingGainNodes[id]) {
        backingGainNodes[id].gain.value = instState[id + '_muted'] ? 0 : instState[id] / 100;
      }
    });

    var soloBtn = track.querySelector('.track-solo');
    soloBtn.addEventListener('click', function () {
      var id = this.dataset.id;
      instState[id + '_solo'] = !instState[id + '_solo'];
      this.classList.toggle('active');
      updateSoloMute();
    });

    var fxBtn = track.querySelector('.track-fx');
    fxBtn.addEventListener('click', function () {
      var id = this.dataset.id;
      var panel = document.getElementById('fx_' + id);
      if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
      }
    });

    var panSlider = track.querySelector('.pan-slider');
    var panVal = track.querySelector('.pan-value');
    panSlider.addEventListener('input', function () {
      var id = this.dataset.id;
      var v = parseInt(this.value);
      instState[id + '_pan'] = v;
      panVal.textContent = v === 0 ? 'C' : v > 0 ? v + 'R' : -v + 'L';
      if (backingPanNodes[id]) {
        backingPanNodes[id].pan.value = v / 50;
      }
    });

    track.querySelectorAll('.fx-slider').forEach(function (s) {
      s.addEventListener('input', function () {
        var id = this.dataset.id;
        var fxType = this.dataset.fx;
        var val = parseInt(this.value);
        instState[id + '_fx_' + fxType] = val;
        var valDisplay = document.getElementById('fxval_' + id + '_' + fxType);
        if (valDisplay) valDisplay.textContent = val;
        updateTrackFX(id);
      });
    });

    track.querySelectorAll('.eq-slider').forEach(function (s) {
      s.addEventListener('input', function () {
        var val = this.parentNode.querySelector('.eq-value');
        if (val) val.textContent = this.value;
        var band = this.dataset.band;
        var v = parseFloat(this.value);
        instState[inst.id + '_eq_' + band] = v;
        if (band === 'bass' && backingEqBass[inst.id]) {
          backingEqBass[inst.id].gain.value = v;
        } else if (band === 'mid' && backingEqMid[inst.id]) {
          backingEqMid[inst.id].gain.value = v;
        } else if (band === 'treble' && backingEqTreble[inst.id]) {
          backingEqTreble[inst.id].gain.value = v;
        }
      });
    });

    backingTracklist.appendChild(track);
  });
}

export function updateSoloMute() {
  var anySolo = instruments.some(function (i) { return instState[i.id + '_solo']; });
  instruments.forEach(function (inst) {
    var gain = backingGainNodes[inst.id];
    if (!gain) return;
    if (anySolo) {
      gain.gain.value = instState[inst.id + '_solo'] ? (instState[inst.id + '_muted'] ? 0 : instState[inst.id] / 100) : 0;
    } else {
      gain.gain.value = instState[inst.id + '_muted'] ? 0 : instState[inst.id] / 100;
    }
  });
}

export function loadBackingTrack(file) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var arrayBuffer = e.target.result;
    if (!backingAudioCtx) setBackingAudioCtx(new (window.AudioContext || window.webkitAudioContext)());
    backingAudioCtx.decodeAudioData(arrayBuffer, function (buffer) {
      setBackingBuffer(buffer);
      backingPlayBtn.disabled = false;
      backingPauseBtn.disabled = true;
      backingStopBtn.disabled = true;
      createBackingGains();
      instruments.forEach(function (inst) {
        var canvas = document.getElementById('waveform_' + inst.id);
        if (canvas) drawWaveform(inst.id, canvas);
      });
    }, function () {
      alert('\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E23\u0E20\u0E32\u0E1E\u0E43\u0E07\u0E23\u0E4C\u0E44\u0E1F\u0E22\u0E4C\u0E40\u0E2A\u0E35\u0E22\u0E27\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E23\u0E34\u0E48\u0E21');
    });
  };
  reader.readAsArrayBuffer(file);
}

export function makeDistortionCurve(amount) {
  var samples = 256;
  var curve = new Float32Array(samples);
  for (var i = 0; i < samples; i++) {
    var x = (i * 2) / samples - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + (amount * Math.abs(x)));
  }
  return curve;
}

export function createReverbImpulse(duration, decay) {
  if (!backingAudioCtx) return null;
  var sr = backingAudioCtx.sampleRate;
  var len = sr * duration;
  var impulse = backingAudioCtx.createBuffer(2, len, sr);
  for (var ch = 0; ch < 2; ch++) {
    var data = impulse.getChannelData(ch);
    for (var i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return impulse;
}

export function updateTrackFX(id) {
  if (!backingAudioCtx) return;
  var reverbVal = instState[id + '_fx_reverb'] || 0;
  var delayVal = instState[id + '_fx_delay'] || 0;
  var distVal = instState[id + '_fx_distortion'] || 0;

  var dist = backingDistNodes[id];
  if (dist) {
    if (distVal > 0) {
      dist.curve = makeDistortionCurve(distVal / 100 * 400);
    } else {
      dist.curve = null;
    }
  }

  var delay = backingDelayNodes[id];
  var delayWet = backingDelayWet[id];
  if (delay && delayWet) {
    delay.delayTime.value = delayVal > 0 ? 0.15 + (delayVal / 100) * 0.35 : 0.001;
    delayWet.gain.value = delayVal / 100 * 0.5;
  }

  var revWet = backingReverbWet[id];
  if (revWet) {
    revWet.gain.value = reverbVal / 100;
  }
}

export function createBackingGains() {
  if (!backingAudioCtx || !backingBuffer) return;
  if (!masterGain) {
    var mg = backingAudioCtx.createGain();
    mg.gain.value = 0.8;
    mg.connect(backingAudioCtx.destination);
    setMasterGain(mg);
  }
  instruments.forEach(function (inst) {
    if (backingGainNodes[inst.id]) {
      try { backingGainNodes[inst.id].disconnect(); } catch {}
    }
    if (backingPanNodes[inst.id]) {
      try { backingPanNodes[inst.id].disconnect(); } catch {}
    }
    if (backingDistNodes[inst.id]) {
      try { backingDistNodes[inst.id].disconnect(); } catch {}
    }
    if (backingDelayNodes[inst.id]) {
      try { backingDelayNodes[inst.id].disconnect(); } catch {}
    }
    if (backingDelayFeedback[inst.id]) {
      try { backingDelayFeedback[inst.id].disconnect(); } catch {}
    }
    if (backingDelayWet[inst.id]) {
      try { backingDelayWet[inst.id].disconnect(); } catch {}
    }
    if (backingReverbNodes[inst.id]) {
      try { backingReverbNodes[inst.id].disconnect(); } catch {}
    }
    if (backingReverbWet[inst.id]) {
      try { backingReverbWet[inst.id].disconnect(); } catch {}
    }
    if (backingEqBass[inst.id]) {
      try { backingEqBass[inst.id].disconnect(); } catch {}
    }
    if (backingEqMid[inst.id]) {
      try { backingEqMid[inst.id].disconnect(); } catch {}
    }
    if (backingEqTreble[inst.id]) {
      try { backingEqTreble[inst.id].disconnect(); } catch {}
    }

    var gain = backingAudioCtx.createGain();
    gain.gain.value = instState[inst.id + '_muted'] ? 0 : instState[inst.id] / 100;
    backingGainNodes[inst.id] = gain;

    var pan = backingAudioCtx.createStereoPanner();
    pan.pan.value = instState[inst.id + '_pan'] / 50;
    backingPanNodes[inst.id] = pan;

    var dist = backingAudioCtx.createWaveShaper();
    dist.curve = null;
    backingDistNodes[inst.id] = dist;

    var delay = backingAudioCtx.createDelay(1.0);
    delay.delayTime.value = 0.001;
    backingDelayNodes[inst.id] = delay;

    var delayFeedback = backingAudioCtx.createGain();
    delayFeedback.gain.value = 0;
    backingDelayFeedback[inst.id] = delayFeedback;

    var delayWet = backingAudioCtx.createGain();
    delayWet.gain.value = 0;
    backingDelayWet[inst.id] = delayWet;

    var reverb = backingAudioCtx.createConvolver();
    reverb.buffer = createReverbImpulse(1.5, 1.5);
    backingReverbNodes[inst.id] = reverb;

    var revWet = backingAudioCtx.createGain();
    revWet.gain.value = 0;
    backingReverbWet[inst.id] = revWet;

    var eqBass = backingAudioCtx.createBiquadFilter();
    eqBass.type = 'lowshelf';
    eqBass.frequency.value = 320;
    eqBass.gain.value = 0;
    backingEqBass[inst.id] = eqBass;

    var eqMid = backingAudioCtx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 1;
    eqMid.gain.value = 0;
    backingEqMid[inst.id] = eqMid;

    var eqTreble = backingAudioCtx.createBiquadFilter();
    eqTreble.type = 'highshelf';
    eqTreble.frequency.value = 3200;
    eqTreble.gain.value = 0;
    backingEqTreble[inst.id] = eqTreble;

    if (instState[inst.id + '_eq_bass'] !== undefined) eqBass.gain.value = instState[inst.id + '_eq_bass'];
    if (instState[inst.id + '_eq_mid'] !== undefined) eqMid.gain.value = instState[inst.id + '_eq_mid'];
    if (instState[inst.id + '_eq_treble'] !== undefined) eqTreble.gain.value = instState[inst.id + '_eq_treble'];

    gain.connect(pan);
    pan.connect(eqBass);
    eqBass.connect(eqMid);
    eqMid.connect(eqTreble);
    eqTreble.connect(dist);
    dist.connect(masterGain);

    dist.connect(delay);
    delay.connect(delayWet);
    delayWet.connect(masterGain);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);

    dist.connect(reverb);
    reverb.connect(revWet);
    revWet.connect(masterGain);
  });
}

export function startBacking() {
  if (!backingAudioCtx || !backingBuffer) return;
  if (backingAudioCtx.state === 'suspended') backingAudioCtx.resume();

  if (backingSource) {
    try { backingSource.stop(); } catch {}
    backingSource.disconnect();
  }

  var src = backingAudioCtx.createBufferSource();
  src.buffer = backingBuffer;

  instruments.forEach(function (inst) {
    var gain = backingGainNodes[inst.id];
    if (gain) {
      src.connect(gain);
    }
  });

  updateSoloMute();
  _startMetronomeVisual();

  src.start(0, backingStartOffset);
  setBackingSource(src);
  setBackingIsPlaying(true);
  setBackingStartTime(Date.now() - backingStartOffset * 1000);

  backingPlayBtn.disabled = true;
  backingPauseBtn.disabled = false;
  backingStopBtn.disabled = false;

  document.querySelectorAll('.track-play').forEach(function (btn) {
    var id = btn.dataset.id;
    if (activePlayTrack === id) { btn.textContent = '\u23F8'; btn.classList.add('active'); }
    else { btn.textContent = '\u25B6'; btn.classList.remove('active'); }
  });

  setPlayheadAnimId(requestAnimationFrame(updatePlayhead));
}

export function stopBacking() {
  _stopMetronomeVisual();
  if (backingSource) {
    try { backingSource.stop(); } catch {}
    backingSource.disconnect();
  }
  setBackingIsPlaying(false);
  setBackingStartOffset(0);
  setActivePlayTrack(null);
  if (playheadAnimId) { cancelAnimationFrame(playheadAnimId); setPlayheadAnimId(null); }
  backingPlayBtn.disabled = false;
  backingPauseBtn.disabled = true;
  backingStopBtn.disabled = true;
  instruments.forEach(function (i) {
    var canvas = document.getElementById('waveform_' + i.id);
    if (canvas) drawWaveform(i.id, canvas);
  });
}

export function pauseBacking() {
  if (backingSource && backingIsPlaying) {
    setBackingStartOffset((Date.now() - backingStartTime) / 1000);
    try { backingSource.stop(); } catch {}
    backingSource.disconnect();
    setBackingIsPlaying(false);
    if (playheadAnimId) { cancelAnimationFrame(playheadAnimId); setPlayheadAnimId(null); }
    backingPlayBtn.disabled = false;
    backingPauseBtn.disabled = true;
  }
  _stopMetronomeVisual();
}

// ─── Plan Mode Functions ───

export function updateBPM(value) {
  setPracticeBPM(Math.min(240, Math.max(40, Math.round(value))));
  var input = document.getElementById('planBpmInput');
  var slider = document.getElementById('planBpmSlider');
  if (input) input.value = practiceBPM;
  if (slider) slider.value = practiceBPM;
  _updateBpmDisplay();
  if (metroFlashInterval) {
    _stopMetronomeVisual();
    _startMetronomeVisual();
  }
}

export function tapTempo() {
  var now = Date.now();
  tapTimes.push(now);
  if (tapTimes.length > 4) tapTimes.shift();
  if (tapTimes.length >= 2) {
    var intervals = [];
    for (var i = 1; i < tapTimes.length; i++) {
      intervals.push(tapTimes[i] - tapTimes[i - 1]);
    }
    var avgInterval = intervals.reduce(function (a, b) { return a + b; }, 0) / intervals.length;
    var bpm = Math.min(240, Math.max(40, Math.round(60000 / avgInterval)));
    updateBPM(bpm);
  }
}

export function playMetronomeClick(isDownbeat) {
  try {
    if (!backingAudioCtx || backingAudioCtx.state === 'closed') {
      setBackingAudioCtx(new (window.AudioContext || window.webkitAudioContext)());
    }
    if (backingAudioCtx.state === 'suspended') backingAudioCtx.resume();
    var now = backingAudioCtx.currentTime;
    var osc = backingAudioCtx.createOscillator();
    var gain = backingAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = isDownbeat ? 1000 : 800;
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  } catch (e) { console.warn('metronome click error:', e); }
}

export function startPractice() {
  if (!backingBuffer) {
    alert('\u0E01\u0E23\u0E38\u0E49\u0E43\u0E0A\u0E49\u0E44\u0E1F\u0E22\u0E4C\u0E40\u0E2A\u0E35\u0E22\u0E27\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E23\u0E34\u0E48\u0E21\u0E1D\u0E27\u0E34\u0E23\u0E4C\u0E0B\u0E2D\u0E14');
    return;
  }
  if (backingIsPlaying) {
    stopBacking();
  }
  setBackingStartOffset(0);
  startBacking();
}

// ─── Bounce / Export Mixdown ───

export function bounceMixdown() {
  if (!backingBuffer) {
    alert('\u0E01\u0E23\u0E38\u0E49\u0E43\u0E0A\u0E49\u0E44\u0E1F\u0E22\u0E4C\u0E40\u0E2A\u0E35\u0E22\u0E27\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E17\u0E33\u0E04\u0E33 Bounce');
    return;
  }

  var btn = document.getElementById('bounceBtn');
  var origText = btn.textContent;
  btn.textContent = '\u23F3 \u0E01\u0E33\u0E25\u0E31\u0E07 Bounce...';
  btn.disabled = true;

  var sampleRate = backingBuffer.sampleRate;
  var duration = backingBuffer.duration;
  var offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * duration), sampleRate);

  var anySolo = instruments.some(function (i) { return instState[i.id + '_solo']; });

  var activeCount = 0;
  instruments.forEach(function (inst) {
    var muted = instState[inst.id + '_muted'];
    var soloed = instState[inst.id + '_solo'];
    if (anySolo ? soloed : !muted) activeCount++;
  });
  var mixScale = activeCount > 0 ? 1 / activeCount : 1;

  instruments.forEach(function (inst) {
    var muted = instState[inst.id + '_muted'];
    var soloed = instState[inst.id + '_solo'];
    var shouldPlay = anySolo ? soloed : !muted;
    if (!shouldPlay) return;

    var vol = instState[inst.id] / 100;
    var panVal = instState[inst.id + '_pan'] / 50;

    var source = offlineCtx.createBufferSource();
    source.buffer = backingBuffer;

    var gainNode = offlineCtx.createGain();
    gainNode.gain.value = vol * mixScale;

    var panNode = offlineCtx.createStereoPanner();
    panNode.pan.value = panVal;

    var eqBass = offlineCtx.createBiquadFilter();
    eqBass.type = 'lowshelf';
    eqBass.frequency.value = 320;
    eqBass.gain.value = instState[inst.id + '_eq_bass'] || 0;

    var eqMid = offlineCtx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 1;
    eqMid.gain.value = instState[inst.id + '_eq_mid'] || 0;

    var eqTreble = offlineCtx.createBiquadFilter();
    eqTreble.type = 'highshelf';
    eqTreble.frequency.value = 3200;
    eqTreble.gain.value = instState[inst.id + '_eq_treble'] || 0;

    source.connect(gainNode);
    gainNode.connect(panNode);
    panNode.connect(eqBass);
    eqBass.connect(eqMid);
    eqMid.connect(eqTreble);
    eqTreble.connect(offlineCtx.destination);

    source.start(0);
  });

  offlineCtx.startRendering().then(function (renderedBuffer) {
    var wavBlob = encodeWAV(renderedBuffer);
    var url = URL.createObjectURL(wavBlob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'mixdown.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    btn.textContent = origText;
    btn.disabled = false;
  })['catch'](function (err) {
    console.error('Bounce error:', err);
    alert('\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E19\u0E15\u0E32\u0E0C\u0E40\u0E23\u0E34 Bounce');
    btn.textContent = origText;
    btn.disabled = false;
  });
}

export function encodeWAV(audioBuffer) {
  var numChannels = audioBuffer.numberOfChannels;
  var sampleRate = audioBuffer.sampleRate;
  var length = audioBuffer.length;
  var bytesPerSample = 2;
  var blockAlign = numChannels * bytesPerSample;
  var dataSize = length * blockAlign;
  var bufferSize = 44 + dataSize;
  var arrayBuffer = new ArrayBuffer(bufferSize);
  var view = new DataView(arrayBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  var channels = [];
  for (var c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  var offset = 44;
  for (var i = 0; i < length; i++) {
    for (var c = 0; c < numChannels; c++) {
      var sample = Math.max(-1, Math.min(1, channels[c][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export function writeString(view, offset, str) {
  for (var i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// ─── Trim Helpers ───
// The backing mixer shares one buffer across all tracks, so trimming is
// applied to the shared backing buffer itself.

function applyTrimmedBuffer(buf) {
  setBackingBuffer(buf);
  setBackingStartOffset(0);
  if (backingIsPlaying) {
    stopBacking();
  } else {
    instruments.forEach(function (inst) {
      var canvas = document.getElementById('waveform_' + inst.id);
      if (canvas) drawWaveform(inst.id, canvas);
    });
  }
}

export function trimTrackStart(id) {
  if (!backingBuffer || !backingAudioCtx) {
    alert('\u0E01\u0E23\u0E38\u0E49\u0E43\u0E0A\u0E49\u0E42\u0E2B\u0E25\u0E14\u0E44\u0E1F\u0E25\u0E4C\u0E40\u0E2A\u0E35\u0E22\u0E27\u0E01\u0E48\u0E2D\u0E19\u0E15\u0E31\u0E14\u0E2B\u0E31\u0E27');
    return;
  }
  var cut = Math.floor(backingBuffer.length * 0.2);
  var buf = backingAudioCtx.createBuffer(backingBuffer.numberOfChannels, backingBuffer.length - cut, backingBuffer.sampleRate);
  for (var c = 0; c < backingBuffer.numberOfChannels; c++) {
    buf.getChannelData(c).set(backingBuffer.getChannelData(c).subarray(cut));
  }
  applyTrimmedBuffer(buf);
}

export function trimTrackEnd(id) {
  if (!backingBuffer || !backingAudioCtx) {
    alert('\u0E01\u0E23\u0E38\u0E49\u0E43\u0E0A\u0E49\u0E42\u0E2B\u0E25\u0E14\u0E44\u0E1F\u0E25\u0E4C\u0E40\u0E2A\u0E35\u0E22\u0E27\u0E01\u0E48\u0E2D\u0E19\u0E15\u0E31\u0E14\u0E17\u0E49\u0E32\u0E22');
    return;
  }
  var newLen = Math.floor(backingBuffer.length * 0.8);
  var buf = backingAudioCtx.createBuffer(backingBuffer.numberOfChannels, newLen, backingBuffer.sampleRate);
  for (var c = 0; c < backingBuffer.numberOfChannels; c++) {
    buf.getChannelData(c).set(backingBuffer.getChannelData(c).subarray(0, newLen));
  }
  applyTrimmedBuffer(buf);
}
