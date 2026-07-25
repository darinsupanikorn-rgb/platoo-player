// ─── platoo-player: Virtual Instruments Module ───

import {
  instruments, instState, activeOscillators,
  backingAudioCtx, masterGain, setBackingAudioCtx,
  noteMap, noteOrder, keyboardNoteMap, noteToKeyboardKey, noteKeyDisplay,
  activeKeyboardNotes,
  guitarStrings, guitarKeyboardMap, guitarKeyToNote, guitarChords, strumDelay,
  bassStrings, bassKeyboardMap, bassKeyToNote, bassChords,
  drumPads, drumsKeyToKey
} from './state.js';
import { escapeHtml } from './utils.js';

// ─── Local mutable state ───

let activeGuitarChord = null;
let strumDown = true;
let activeBassChord = null;
let bassStrumDown = true;

// ─── Drum frequency map (not in state.js) ───

const drumFreqs = {
  kick: 60, snare: 150, hihat: 300, tom1: 200, tom2: 160,
  tom3: 120, ride: 250, crash: 350, clap: 180
};

// ─── Reversed string arrays (state.js exports high→low, original code expects low→high) ───

const guitarStringsAsc = [...guitarStrings].reverse();
const bassStringsAsc = [...bassStrings].reverse();

// ─── DOM element caches ───

let instList, instDetail, instDetailTitle, instDetailDesc, instBackBtn;
let pianoSection, pianoKeysEl, guitarSection, guitarFretboardEl;
let bassSection, bassFretboardEl, drumsSection, drumsPadsEl;

// ─── Close sidebar callback ───

let closeSidebarFn = null;

// ─── Legend builder (local helper) ───

function buildLegend(elId, items) {
  var el = document.getElementById(elId);
  if (!el) return;
  var html = '';
  items.forEach(function (item) {
    html += '<span class="legend-item"><span class="legend-key">' + item.key + '</span><span class="legend-note">' + item.note + '</span></span>';
  });
  el.innerHTML = html;
}

// ─── Instruments Panel ───

const instrumentsList = instruments;

export function showInstrumentDetail(id) {
  const inst = instrumentsList.find(i => i.id === id);
  if (!inst) return;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

  document.getElementById('tab-instrument').classList.add('active');

  instDetailTitle.textContent = inst.icon + ' ' + inst.label;
  instDetailDesc.textContent = 'ปรับแต่งระดับเสียงและตั้งค่า ' + inst.label;

  renderInstrumentDetail(id);
}

export function renderInstrumentDetail(id) {
  const inst = instrumentsList.find(i => i.id === id);
  if (!inst) return;

  const value = instState[id];
  const muted = instState[id + '_muted'];

  let contentHtml = '';

  if (id === 'vocal') {
    const lyrics = instState[id + '_lyrics'] || '';
    contentHtml = `
      <div class="detail-content-section">
        <h4 class="detail-content-title">&#9835; เนื้อร้อง</h4>
        <textarea class="lyrics-editor" id="lyricsEditor" placeholder="พิมพ์หรือวางเนื้อร้องที่นี่...">${escapeHtml(lyrics)}</textarea>
      </div>
    `;
  } else {
    const notes = instState[id + '_notes'] || '4 4 4 8 8 4 4 4';
    contentHtml = `
      <div class="detail-content-section">
        <h4 class="detail-content-title">&#9835; โน้ตเพลง</h4>
        <div class="notation-area" id="notationArea">
          <div class="staff">
            <div class="staff-line"></div>
            <div class="staff-line"></div>
            <div class="staff-line"></div>
            <div class="staff-line"></div>
            <div class="staff-line"></div>
          </div>
          <div class="notes-container" id="notesContainer">
            <span class="note">&#9833;</span>
            <span class="note">&#9833;</span>
            <span class="note">&#9835;</span>
            <span class="note">&#9833;</span>
            <span class="note">&#9835;</span>
            <span class="note">&#9833;</span>
            <span class="note">&#9833;</span>
            <span class="note">&#9835;</span>
          </div>
          <div class="notation-input-row">
            <input type="text" class="notation-input" id="notationInput" value="${notes}" placeholder="โน้ต (เช่น 4 4 8 8 4)">
            <button class="btn btn-primary btn-sm" id="notationUpdateBtn">อัปเดต</button>
          </div>
        </div>
      </div>
    `;
  }

  instDetail.innerHTML = `
    <div class="inst-detail-row">
      <span class="detail-label">Volume</span>
      <input type="range" min="0" max="100" value="${value}" id="detailSlider">
      <span class="detail-value" id="detailVal">${value}%</span>
      <button class="detail-mute${muted ? ' muted' : ''}" id="detailMute">Mute</button>
    </div>
    ${contentHtml}
    <div class="inst-detail-info">
      <div class="info-item">Group: <strong>${inst.group}</strong></div>
      <div class="info-item">Status: <strong>${muted ? 'Muted' : 'Active'}</strong></div>
    </div>
  `;

  const slider = document.getElementById('detailSlider');
  const valDisplay = document.getElementById('detailVal');
  const muteBtn = document.getElementById('detailMute');

  slider.addEventListener('input', function () {
    const v = parseInt(this.value);
    instState[id] = v;
    valDisplay.textContent = v + '%';
  });

  muteBtn.addEventListener('click', function () {
    instState[id + '_muted'] = !instState[id + '_muted'];
    this.classList.toggle('muted');
    renderInstrumentDetail(id);
  });

  if (id === 'vocal') {
    const editor = document.getElementById('lyricsEditor');
    if (editor) {
      editor.addEventListener('input', function () {
        instState[id + '_lyrics'] = this.value;
      });
    }
  } else {
    const noteInput = document.getElementById('notationInput');
    const updateBtn = document.getElementById('notationUpdateBtn');
    if (noteInput && updateBtn) {
      updateBtn.addEventListener('click', function () {
        instState[id + '_notes'] = noteInput.value;
        renderNotation(noteInput.value);
      });
    }
  }
}

export function renderNotation(notesStr) {
  const container = document.getElementById('notesContainer');
  if (!container) return;
  const parts = notesStr.trim().split(/\s+/);
  container.innerHTML = parts.map(p => {
    const num = parseInt(p);
    if (isNaN(num)) return '';
    if (num >= 8) return '<span class="note note-eighth">&#9835;</span>';
    if (num >= 4) return '<span class="note note-quarter">&#9833;</span>';
    if (num >= 2) return '<span class="note note-half">&#9834;</span>';
    return '<span class="note note-whole">&#9833;</span>';
  }).join('');
}

export function initInstrumentsPanel(closeSidebarCallback) {
  closeSidebarFn = closeSidebarCallback;

  instList = document.getElementById('instList');
  instDetail = document.getElementById('instDetail');
  instDetailTitle = document.getElementById('instDetailTitle');
  instDetailDesc = document.getElementById('instDetailDesc');
  instBackBtn = document.getElementById('instBackBtn');

  instList.innerHTML = '';

  instrumentsList.forEach((inst) => {
    if (instState[inst.id] === undefined) instState[inst.id] = 80;
    if (instState[inst.id + '_muted'] === undefined) instState[inst.id + '_muted'] = false;

    const btn = document.createElement('button');
    btn.className = 'inst-btn';
    btn.innerHTML = `<span class="inst-icon">${inst.icon}</span> ${inst.label}`;
    btn.dataset.id = inst.id;

    btn.addEventListener('click', function () {
      if (window.innerWidth <= 768 && closeSidebarFn) closeSidebarFn();
      showInstrumentDetail(inst.id);
    });

    instList.appendChild(btn);
  });

  instBackBtn.addEventListener('click', function () {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('.nav-item[data-tab="dashboard"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-dashboard').classList.add('active');
  });
}

// ─── Instrument UI helpers ───

export function showInstrumentUI(type) {
  if (!backingAudioCtx || backingAudioCtx.state === 'closed') {
    setBackingAudioCtx(new (window.AudioContext || window.webkitAudioContext)());
  }
  var sections = { piano: pianoSection, guitar: guitarSection, bass: bassSection, drums: drumsSection };
  var builders = { piano: buildPianoKeys, guitar: buildGuitarFretboard, bass: buildBassFretboard, drums: buildDrumsPads };
  if (sections[type]) {
    if (builders[type]) builders[type]();
    sections[type].hidden = false;
  }
}

export function hideAllInstrumentUIs() {
  [pianoSection, guitarSection, bassSection, drumsSection].forEach(function (s) { if (s) s.hidden = true; });
  Object.keys(activeOscillators).forEach(function (k) { try { activeOscillators[k].osc.stop(); } catch {} delete activeOscillators[k]; });
}

// ─── Piano ───

export function buildPianoKeys() {
  if (pianoKeysEl.children.length > 0) return;
  pianoKeysEl.innerHTML = '';
  for (var oct = 2; oct <= 5; oct++) {
    noteOrder.forEach(function (n) {
      var isBlack = n.indexOf('#') !== -1;
      var key = document.createElement('div');
      key.className = 'piano-key ' + (isBlack ? 'black' : 'white');
      var freq = noteMap[n + oct];
      var noteName = n + oct;
      key.dataset.freq = freq;
      key.dataset.note = noteName;
      var kbKey = noteKeyDisplay[noteName] || '';
      if (!isBlack) {
        key.innerHTML = '<span class="piano-note-label">' + noteName + '</span><span class="piano-kb-label">' + kbKey + '</span>';
      } else {
        key.innerHTML = '<span class="piano-kb-label">' + kbKey + '</span>';
      }
      key.addEventListener('mousedown', function (e) { e.preventDefault(); playInstNote(this); });
      key.addEventListener('mouseup', function () { stopInstNote(this); });
      key.addEventListener('mouseleave', function () { stopInstNote(this); });
      key.addEventListener('touchstart', function (e) { e.preventDefault(); playInstNote(this); });
      key.addEventListener('touchend', function () { stopInstNote(this); });
      pianoKeysEl.appendChild(key);
    });
  }
  var lastC = document.createElement('div');
  lastC.className = 'piano-key white';
  lastC.dataset.freq = 523.25;
  lastC.dataset.note = 'C6';
  var kbKey6 = noteKeyDisplay['C6'] || '';
  lastC.innerHTML = '<span class="piano-note-label">C6</span><span class="piano-kb-label">' + kbKey6 + '</span>';
  lastC.addEventListener('mousedown', function (e) { e.preventDefault(); playInstNote(this); });
  lastC.addEventListener('mouseup', function () { stopInstNote(this); });
  lastC.addEventListener('mouseleave', function () { stopInstNote(this); });
  lastC.addEventListener('touchstart', function (e) { e.preventDefault(); playInstNote(this); });
  lastC.addEventListener('touchend', function () { stopInstNote(this); });
  pianoKeysEl.appendChild(lastC);

  var legendItems = [];
  for (var k in keyboardNoteMap) {
    if (keyboardNoteMap.hasOwnProperty(k)) {
      legendItems.push({ key: k.toUpperCase(), note: keyboardNoteMap[k] });
    }
  }
  legendItems.sort(function (a, b) { return a.note < b.note ? -1 : a.note > b.note ? 1 : 0; });
  buildLegend('pianoLegend', legendItems);
}

export function playInstNote(el) {
  try {
    var freq = parseFloat(el.dataset.freq);
    var note = el.dataset.note;
    if (activeOscillators[note]) return;
    if (!backingAudioCtx || backingAudioCtx.state === 'closed') {
      setBackingAudioCtx(new (window.AudioContext || window.webkitAudioContext)());
    }
    if (backingAudioCtx.state === 'suspended') backingAudioCtx.resume();
    var osc = backingAudioCtx.createOscillator();
    var gain = backingAudioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, backingAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, backingAudioCtx.currentTime + 2);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    el.classList.add('active');
    activeOscillators[note] = { osc: osc, gain: gain, key: el };
  } catch (e) { console.warn('playInstNote error:', e); }
}

export function stopInstNote(el) {
  var note = el.dataset.note;
  if (!activeOscillators[note]) return;
  try {
    activeOscillators[note].gain.gain.exponentialRampToValueAtTime(0.001, backingAudioCtx.currentTime + 0.1);
    setTimeout(function () { try { activeOscillators[note].osc.stop(); } catch {} }, 150);
  } catch {}
  el.classList.remove('active');
  delete activeOscillators[note];
}

// ─── Guitar Fretboard ───

export function buildGuitarFretboard() {
  if (guitarFretboardEl.querySelector('.fretboard')) return;
  var fb = document.createElement('div'); fb.className = 'fretboard';
  guitarKeyboardMap[' '] = null;
  guitarStringsAsc.forEach(function (str, si) {
    var row = document.createElement('div'); row.className = 'fretboard-string';
    var label = document.createElement('span'); label.className = 'string-label'; label.textContent = str.name;
    row.appendChild(label);
    var line = document.createElement('div'); line.className = 'string-line';
    for (var f = 0; f <= 12; f++) {
      var fret = document.createElement('div'); fret.className = 'fret';
      var freq = str.freq * Math.pow(2, f / 12);
      var noteName = str.name + ' f' + f;
      fret.dataset.freq = freq;
      fret.dataset.note = noteName;
      fret.dataset.strIdx = si;
      fret.dataset.fret = f;
      fret.style.left = (f * 28 + 14) + 'px';
      var kbKey = '';
      for (var k in guitarKeyboardMap) {
        if (guitarKeyboardMap.hasOwnProperty(k) && guitarKeyboardMap[k] &&
            guitarKeyboardMap[k].strIdx === si && guitarKeyboardMap[k].fret === f) {
          kbKey = k.toUpperCase();
          guitarKeyToNote[k] = { strIdx: si, fret: f };
          break;
        }
      }
      if (kbKey) {
        fret.innerHTML = '<span class="fret-kb-label">' + kbKey + '</span>';
      }
      fret.addEventListener('mousedown', function (e) { e.preventDefault(); playGuitarNote(this); });
      fret.addEventListener('touchstart', function (e) { e.preventDefault(); playGuitarNote(this); });
      line.appendChild(fret);
    }
    [3, 5, 7, 9, 12].forEach(function (fm) {
      if (fm <= 12) {
        var marker = document.createElement('div'); marker.className = 'fret-marker';
        marker.style.left = (fm * 28 + 14) + 'px';
        line.appendChild(marker);
      }
    });
    row.appendChild(line);
    fb.appendChild(row);
  });
  guitarFretboardEl.appendChild(fb);

  var guitarStrNames = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
  var gLegendItems = [];
  for (var gk in guitarKeyboardMap) {
    if (guitarKeyboardMap.hasOwnProperty(gk) && guitarKeyboardMap[gk]) {
      var gm = guitarKeyboardMap[gk];
      var strName = guitarStrNames[gm.strIdx] || '?';
      var fretLabel = gm.fret === 0 ? 'open' : 'f' + gm.fret;
      gLegendItems.push({ key: gk.toUpperCase(), note: strName + ' ' + fretLabel });
    }
  }
  gLegendItems.sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });
  buildLegend('guitarLegend', gLegendItems);
  buildGuitarChordBar();
}

export function buildGuitarChordBar() {
  var bar = document.getElementById('guitarChordBar');
  if (!bar || bar.children.length > 0) return;
  var toggleBtn = document.createElement('button'); toggleBtn.className = 'strum-toggle';
  toggleBtn.textContent = '\u2193';
  toggleBtn.title = '\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19\u0e17\u0e34\u0e28\u0e17\u0e32\u0e07\u0e14\u0e35\u0e14\u0e2a\u0e32\u0e22';
  toggleBtn.addEventListener('click', function () {
    strumDown = !strumDown;
    toggleBtn.textContent = strumDown ? '\u2193' : '\u2191';
  });
  bar.appendChild(toggleBtn);
  guitarChords.forEach(function (chord) {
    var btn = document.createElement('button'); btn.className = 'chord-btn';
    btn.textContent = chord.name;
    btn.dataset.chord = chord.name;
    btn.addEventListener('click', function () {
      toggleGuitarChord(chord);
    });
    bar.appendChild(btn);
  });
}

export function toggleGuitarChord(chord) {
  clearGuitarChordHighlight();
  if (activeGuitarChord === chord) {
    activeGuitarChord = null;
    return;
  }
  activeGuitarChord = chord;
  chord.frets.forEach(function (fret, si) {
    if (fret < 0) return;
    var el = findGuitarFretEl(si, fret);
    if (el) {
      el.classList.add('chord');
      el.style.background = '#5b8def';
      el.style.borderColor = '#5b8def';
    }
  });
  var bar = document.getElementById('guitarChordBar');
  if (bar) {
    var btns = bar.querySelectorAll('.chord-btn');
    btns.forEach(function (b) { b.classList.toggle('active', b.dataset.chord === chord.name); });
  }
  playGuitarChord(chord);
}

export function clearGuitarChordHighlight() {
  var frets = guitarFretboardEl.querySelectorAll('.fret');
  frets.forEach(function (f) {
    f.classList.remove('chord');
    f.style.background = '';
    f.style.borderColor = '';
  });
  activeGuitarChord = null;
  var bar = document.getElementById('guitarChordBar');
  if (bar) {
    bar.querySelectorAll('.chord-btn').forEach(function (b) { b.classList.remove('active'); });
  }
}

export function playGuitarChord(chord) {
  if (!backingAudioCtx) return;
  var now = backingAudioCtx.currentTime;
  var maxIdx = chord.frets.length - 1;
  chord.frets.forEach(function (fret, si) {
    if (fret < 0) return;
    var str = guitarStringsAsc[si];
    var freq = str.freq * Math.pow(2, fret / 12);
    var playIdx = strumDown ? si : (maxIdx - si);
    var startTime = now + strumDelay * playIdx;
    var osc = backingAudioCtx.createOscillator();
    var gain = backingAudioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.5);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startTime);
    var el = findGuitarFretEl(si, fret);
    if (el) {
      el.classList.add('active');
      var dur = 150 + strumDelay * playIdx * 1000;
      setTimeout(function () { if (el) el.classList.remove('active'); }, dur);
    }
  });
}

export function playGuitarNote(el) {
  try {
    if (!backingAudioCtx || backingAudioCtx.state === 'closed') {
      setBackingAudioCtx(new (window.AudioContext || window.webkitAudioContext)());
    }
    if (backingAudioCtx.state === 'suspended') backingAudioCtx.resume();
    var freq = parseFloat(el.dataset.freq);
    var osc = backingAudioCtx.createOscillator();
    var gain = backingAudioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, backingAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, backingAudioCtx.currentTime + 1.5);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    el.classList.add('active');
    setTimeout(function () { el.classList.remove('active'); }, 200);
  } catch (e) { console.warn('playGuitarNote error:', e); }
}

export function findGuitarFretEl(strIdx, fret) {
  var fretEls = guitarFretboardEl.querySelectorAll('.fret');
  for (var i = 0; i < fretEls.length; i++) {
    if (parseInt(fretEls[i].dataset.strIdx) === strIdx && parseInt(fretEls[i].dataset.fret) === fret) {
      return fretEls[i];
    }
  }
  return null;
}

// ─── Bass Fretboard ───

export function buildBassFretboard() {
  if (bassFretboardEl.querySelector('.fretboard')) return;
  var fb = document.createElement('div'); fb.className = 'fretboard';
  bassStringsAsc.forEach(function (str, si) {
    var row = document.createElement('div'); row.className = 'fretboard-string';
    var label = document.createElement('span'); label.className = 'string-label'; label.textContent = str.name;
    row.appendChild(label);
    var line = document.createElement('div'); line.className = 'string-line';
    for (var f = 0; f <= 12; f++) {
      var fret = document.createElement('div'); fret.className = 'fret';
      var freq = str.freq * Math.pow(2, f / 12);
      var noteName = str.name + ' f' + f;
      fret.dataset.freq = freq;
      fret.dataset.note = noteName;
      fret.dataset.strIdx = si;
      fret.dataset.fret = f;
      fret.style.left = (f * 28 + 14) + 'px';
      var kbKey = '';
      for (var k in bassKeyboardMap) {
        if (bassKeyboardMap.hasOwnProperty(k) && bassKeyboardMap[k] &&
            bassKeyboardMap[k].strIdx === si && bassKeyboardMap[k].fret === f) {
          kbKey = k.toUpperCase();
          bassKeyToNote[k] = { strIdx: si, fret: f };
          break;
        }
      }
      if (kbKey) {
        fret.innerHTML = '<span class="fret-kb-label">' + kbKey + '</span>';
      }
      fret.addEventListener('mousedown', function (e) { e.preventDefault(); playBassNote(this); });
      fret.addEventListener('touchstart', function (e) { e.preventDefault(); playBassNote(this); });
      line.appendChild(fret);
    }
    [3, 5, 7, 9, 12].forEach(function (fm) {
      if (fm <= 12) {
        var marker = document.createElement('div'); marker.className = 'fret-marker';
        marker.style.left = (fm * 28 + 14) + 'px';
        line.appendChild(marker);
      }
    });
    row.appendChild(line);
    fb.appendChild(row);
  });
  bassFretboardEl.appendChild(fb);

  var bassStrNames = ['G2', 'D2', 'A1', 'E1'];
  var bLegendItems = [];
  for (var bk in bassKeyboardMap) {
    if (bassKeyboardMap.hasOwnProperty(bk) && bassKeyboardMap[bk]) {
      var bm = bassKeyboardMap[bk];
      var bStrName = bassStrNames[bm.strIdx] || '?';
      var bFretLabel = bm.fret === 0 ? 'open' : 'f' + bm.fret;
      bLegendItems.push({ key: bk.toUpperCase(), note: bStrName + ' ' + bFretLabel });
    }
  }
  bLegendItems.sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });
  buildLegend('bassLegend', bLegendItems);
  buildBassChordBar();
}

export function buildBassChordBar() {
  var bar = document.getElementById('bassChordBar');
  if (!bar || bar.children.length > 0) return;
  var toggleBtn = document.createElement('button'); toggleBtn.className = 'strum-toggle';
  toggleBtn.textContent = '\u2193';
  toggleBtn.title = '\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19\u0e17\u0e34\u0e28\u0e17\u0e32\u0e07\u0e14\u0e35\u0e14\u0e2a\u0e32\u0e22';
  toggleBtn.addEventListener('click', function () {
    bassStrumDown = !bassStrumDown;
    toggleBtn.textContent = bassStrumDown ? '\u2193' : '\u2191';
  });
  bar.appendChild(toggleBtn);
  bassChords.forEach(function (chord) {
    var btn = document.createElement('button'); btn.className = 'chord-btn';
    btn.textContent = chord.name;
    btn.dataset.chord = chord.name;
    btn.addEventListener('click', function () {
      toggleBassChord(chord);
    });
    bar.appendChild(btn);
  });
}

export function toggleBassChord(chord) {
  clearBassChordHighlight();
  if (activeBassChord === chord) { activeBassChord = null; return; }
  activeBassChord = chord;
  chord.frets.forEach(function (fret, si) {
    if (fret < 0) return;
    var el = findBassFretEl(si, fret);
    if (el) {
      el.classList.add('chord');
      el.style.background = '#e68a3f';
      el.style.borderColor = '#e68a3f';
    }
  });
  var bar = document.getElementById('bassChordBar');
  if (bar) {
    bar.querySelectorAll('.chord-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.chord === chord.name);
    });
  }
  playBassChord(chord);
}

export function clearBassChordHighlight() {
  var frets = bassFretboardEl.querySelectorAll('.fret');
  frets.forEach(function (f) {
    f.classList.remove('chord');
    f.style.background = '';
    f.style.borderColor = '';
  });
  activeBassChord = null;
  var bar = document.getElementById('bassChordBar');
  if (bar) {
    bar.querySelectorAll('.chord-btn').forEach(function (b) { b.classList.remove('active'); });
  }
}

export function playBassChord(chord) {
  if (!backingAudioCtx) return;
  var now = backingAudioCtx.currentTime;
  var maxIdx = chord.frets.length - 1;
  chord.frets.forEach(function (fret, si) {
    if (fret < 0) return;
    var str = bassStringsAsc[si];
    var freq = str.freq * Math.pow(2, fret / 12);
    var playIdx = bassStrumDown ? si : (maxIdx - si);
    var startTime = now + strumDelay * playIdx;
    var osc = backingAudioCtx.createOscillator();
    var gain = backingAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 2);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startTime);
    var el = findBassFretEl(si, fret);
    if (el) {
      el.classList.add('active');
      var dur = 150 + strumDelay * playIdx * 1000;
      setTimeout(function () { if (el) el.classList.remove('active'); }, dur);
    }
  });
}

export function playBassNote(el) {
  try {
    if (!backingAudioCtx || backingAudioCtx.state === 'closed') {
      setBackingAudioCtx(new (window.AudioContext || window.webkitAudioContext)());
    }
    if (backingAudioCtx.state === 'suspended') backingAudioCtx.resume();
    var freq = parseFloat(el.dataset.freq);
    var osc = backingAudioCtx.createOscillator();
    var gain = backingAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.35, backingAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, backingAudioCtx.currentTime + 2);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    el.classList.add('active');
    setTimeout(function () { el.classList.remove('active'); }, 200);
  } catch (e) { console.warn('playBassNote error:', e); }
}

export function findBassFretEl(strIdx, fret) {
  var fretEls = bassFretboardEl.querySelectorAll('.fret');
  for (var i = 0; i < fretEls.length; i++) {
    if (parseInt(fretEls[i].dataset.strIdx) === strIdx && parseInt(fretEls[i].dataset.fret) === fret) {
      return fretEls[i];
    }
  }
  return null;
}

// ─── Drums Pads ───

export function buildDrumsPads() {
  if (drumsPadsEl.children.length > 0) return;
  drumsPadsEl.innerHTML = '';
  drumPads.forEach(function (d) {
    var pad = document.createElement('div'); pad.className = 'drum-pad';
    pad.dataset.key = d.key;
    pad.dataset.freq = drumFreqs[d.key] || 0;
    pad.dataset.kbKey = d.kbKey.toLowerCase();
    pad.style.background = getDrumPadColor(d.key);
    pad.innerHTML = '<span class="dp-icon">' + getDrumPadIcon(d.key) + '</span><span>' + d.label + '</span><span class="dp-kb-label">[' + d.kbKey + ']</span>';
    pad.addEventListener('mousedown', function (e) { e.preventDefault(); playDrum(this); });
    pad.addEventListener('touchstart', function (e) { e.preventDefault(); playDrum(this); });
    drumsPadsEl.appendChild(pad);
    drumsKeyToKey[d.kbKey.toLowerCase()] = d.key;
  });
  var dLegendItems = [];
  drumPads.forEach(function (dp) {
    dLegendItems.push({ key: dp.kbKey, note: dp.label });
  });
  buildLegend('drumsLegend', dLegendItems);
}

export function getDrumPadColor(key) {
  var colors = { kick: '#2a2a3a', snare: '#3a2a2a', hihat: '#2a3a2a', tom1: '#2a2a3a', tom2: '#3a2a3a', tom3: '#3a3a2a', ride: '#2a3a3a', crash: '#3a2a2a', clap: '#2a2a2a' };
  return colors[key] || '#222';
}

export function getDrumPadIcon(key) {
  var icons = { kick: '\u26AB', snare: '\u26AA', hihat: '\uD83D\uDD14', tom1: '\uD83D\uDD35', tom2: '\uD83D\uDD35', tom3: '\uD83D\uDD35', ride: '\uD83D\uDD14', crash: '\u2728', clap: '\uD83D\uDC4F' };
  return icons[key] || '\uD83D\uDD18';
}

export function playDrum(el) {
  try {
  if (!backingAudioCtx || backingAudioCtx.state === 'closed') {
    setBackingAudioCtx(new (window.AudioContext || window.webkitAudioContext)());
  }
  if (backingAudioCtx.state === 'suspended') backingAudioCtx.resume();
  var key = el.dataset.key;
  var freq = parseFloat(el.dataset.freq);
  el.classList.add('active');
  setTimeout(function () { el.classList.remove('active'); }, 100);

  if (key === 'hihat' || key === 'ride' || key === 'crash') {
    var bufferSize = backingAudioCtx.sampleRate * 0.2;
    var buffer = backingAudioCtx.createBuffer(1, bufferSize, backingAudioCtx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * (key === 'crash' ? 0.4 : 0.15)));
    }
    var noise = backingAudioCtx.createBufferSource();
    noise.buffer = buffer;
    var ng = backingAudioCtx.createGain();
    ng.gain.value = 0.3;
    var filter = backingAudioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = key === 'crash' ? 2000 : key === 'ride' ? 1000 : 4000;
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(masterGain);
    noise.start();
  } else {
    var osc = backingAudioCtx.createOscillator();
    var gain = backingAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    if (key === 'kick') osc.frequency.exponentialRampToValueAtTime(30, backingAudioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.4, backingAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, backingAudioCtx.currentTime + (key === 'kick' ? 0.4 : 0.2));
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();

    if (key === 'snare') {
      var snBufSize = backingAudioCtx.sampleRate * 0.15;
      var snBuf = backingAudioCtx.createBuffer(1, snBufSize, backingAudioCtx.sampleRate);
      var snData = snBuf.getChannelData(0);
      for (var j = 0; j < snBufSize; j++) snData[j] = (Math.random() * 2 - 1) * Math.exp(-j / (snBufSize * 0.12));
      var snNoise = backingAudioCtx.createBufferSource();
      snNoise.buffer = snBuf;
      var snGain = backingAudioCtx.createGain();
      snGain.gain.value = 0.25;
      var snFilter = backingAudioCtx.createBiquadFilter();
      snFilter.type = 'bandpass';
      snFilter.frequency.value = 200;
      snFilter.Q.value = 0.5;
      snNoise.connect(snFilter);
      snFilter.connect(snGain);
      snGain.connect(masterGain);
      snNoise.start();
    }
  }
  } catch (e) { console.warn('playDrum error:', e); }
}

// ─── Init Virtual Instruments (DOM + event wiring) ───

export function initVirtualInstruments() {
  pianoSection = document.getElementById('pianoSection');
  pianoKeysEl = document.getElementById('pianoKeys');
  guitarSection = document.getElementById('guitarSection');
  guitarFretboardEl = document.getElementById('guitarFretboard');
  bassSection = document.getElementById('bassSection');
  bassFretboardEl = document.getElementById('bassFretboard');
  drumsSection = document.getElementById('drumsSection');
  drumsPadsEl = document.getElementById('drumsPads');

  // Populate keyboard→note maps from keyboardNoteMap
  Object.keys(keyboardNoteMap).forEach(function (k) {
    if (keyboardNoteMap.hasOwnProperty(k)) {
      noteToKeyboardKey[keyboardNoteMap[k]] = k.toUpperCase() + ':' + keyboardNoteMap[k];
      noteKeyDisplay[keyboardNoteMap[k]] = k.toUpperCase();
    }
  });

  // Populate guitar keyboard map
  Object.assign(guitarKeyboardMap, {
    '1': { strIdx: 0, fret: 0 }, 'q': { strIdx: 0, fret: 1 },
    'a': { strIdx: 0, fret: 2 }, 'z': { strIdx: 0, fret: 3 },
    '2': { strIdx: 1, fret: 0 }, 'w': { strIdx: 1, fret: 1 },
    's': { strIdx: 1, fret: 2 }, 'x': { strIdx: 1, fret: 3 },
    '3': { strIdx: 2, fret: 0 }, 'e': { strIdx: 2, fret: 1 },
    'd': { strIdx: 2, fret: 2 }, 'c': { strIdx: 2, fret: 3 },
    '4': { strIdx: 3, fret: 0 }, 'r': { strIdx: 3, fret: 1 },
    'f': { strIdx: 3, fret: 2 }, 'v': { strIdx: 3, fret: 3 },
    '5': { strIdx: 4, fret: 0 }, 't': { strIdx: 4, fret: 1 },
    'g': { strIdx: 4, fret: 2 }, 'b': { strIdx: 4, fret: 3 },
    '6': { strIdx: 5, fret: 0 }, 'y': { strIdx: 5, fret: 1 },
    'h': { strIdx: 5, fret: 2 }, 'n': { strIdx: 5, fret: 3 }
  });

  // Populate bass keyboard map
  Object.assign(bassKeyboardMap, {
    '1': { strIdx: 0, fret: 0 }, 'q': { strIdx: 0, fret: 1 },
    'a': { strIdx: 0, fret: 2 }, 'z': { strIdx: 0, fret: 3 },
    '2': { strIdx: 1, fret: 0 }, 'w': { strIdx: 1, fret: 1 },
    's': { strIdx: 1, fret: 2 }, 'x': { strIdx: 1, fret: 3 },
    '3': { strIdx: 2, fret: 0 }, 'e': { strIdx: 2, fret: 1 },
    'd': { strIdx: 2, fret: 2 }, 'c': { strIdx: 2, fret: 3 },
    '4': { strIdx: 3, fret: 0 }, 'r': { strIdx: 3, fret: 1 },
    'f': { strIdx: 3, fret: 2 }, 'v': { strIdx: 3, fret: 3 }
  });

  // Close buttons
  document.getElementById('pianoCloseBtn').addEventListener('click', function () {
    pianoSection.hidden = true;
    Object.keys(activeOscillators).forEach(function (k) { try { activeOscillators[k].osc.stop(); } catch {} delete activeOscillators[k]; });
  });

  document.getElementById('guitarCloseBtn').addEventListener('click', function () {
    guitarSection.hidden = true;
  });

  document.getElementById('bassCloseBtn').addEventListener('click', function () {
    bassSection.hidden = true;
  });

  document.getElementById('drumsCloseBtn').addEventListener('click', function () {
    drumsSection.hidden = true;
  });
}

// ─── Keyboard Shortcuts ───

export function initKeyboardShortcuts() {
  // Piano keyboard shortcuts
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey) return;
    if (!pianoSection || pianoSection.hidden) return;
    if (e.repeat) return;
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    var key = e.key.toLowerCase();
    var noteName = keyboardNoteMap[key];
    if (!noteName) return;
    e.preventDefault();
    if (activeKeyboardNotes[key]) return;
    try {
      var el = pianoKeysEl.querySelector('[data-note="' + noteName + '"]');
      if (!el) return;
      playInstNote(el);
      activeKeyboardNotes[key] = noteName;
    } catch (ex) { console.warn('piano key error:', ex); }
  });

  document.addEventListener('keyup', function (e) {
    var key = e.key.toLowerCase();
    var noteName = activeKeyboardNotes[key];
    if (!noteName) return;
    e.preventDefault();
    try {
      var el = pianoKeysEl.querySelector('[data-note="' + noteName + '"]');
      if (el) stopInstNote(el);
    } catch (ex) { console.warn('piano keyup error:', ex); }
    delete activeKeyboardNotes[key];
  });

  // Guitar / Bass / Drums keyboard shortcuts
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey) return;
    try {
    if (e.repeat) return;
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    var key = e.key.toLowerCase();

    if (guitarSection && !guitarSection.hidden && guitarKeyboardMap[key]) {
      e.preventDefault();
      var m = guitarKeyboardMap[key];
      var el = findGuitarFretEl(m.strIdx, m.fret);
      if (el) { playGuitarNote(el); }
      return;
    }

    if (bassSection && !bassSection.hidden && bassKeyboardMap[key]) {
      e.preventDefault();
      var m2 = bassKeyboardMap[key];
      var el2 = findBassFretEl(m2.strIdx, m2.fret);
      if (el2) { playBassNote(el2); }
      return;
    }

    if (drumsSection && !drumsSection.hidden && drumsKeyToKey[key]) {
      e.preventDefault();
      var padKey = drumsKeyToKey[key];
      var pad = drumsPadsEl.querySelector('[data-kb-key="' + key + '"]');
      if (pad) { playDrum(pad); }
      return;
    }
    } catch (ex) { console.warn('inst key error:', ex); }
  });
}
