import { currentKey, originalKey, setCurrentKey } from './state.js';
import { semitoneOffsetOf } from './utils.js';

const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const KEY_MODES = ['Major', 'Minor'];

let deps = {};

export function populateKeySelect() {
  var sel = document.getElementById('planKeySelect');
  if (!sel) return;
  sel.innerHTML = '';
  KEY_NAMES.forEach(function (k) {
    KEY_MODES.forEach(function (m) {
      var o = document.createElement('option');
      o.value = k + ' ' + m;
      o.textContent = k + ' ' + m;
      sel.appendChild(o);
    });
  });
  sel.value = currentKey;
}

export function updateKeyDisplay() {
  var sel = document.getElementById('planKeySelect');
  if (sel) sel.value = currentKey;
}

export function updateOriginalKeyDisplay() {
  var el = document.getElementById('planOriginalKey');
  if (el) el.textContent = originalKey || '\u2014';
}

export function initPlanModeListeners(d) {
  deps = d;

  document.getElementById('planBpmInput').addEventListener('input', function () {
    var v = parseInt(this.value) || 120;
    deps.updateBPM(v);
  });

  document.getElementById('planBpmSlider').addEventListener('input', function () {
    deps.updateBPM(parseInt(this.value));
  });

  document.getElementById('planTapBtn').addEventListener('click', deps.tapTempo);

  var keySelect = document.getElementById('planKeySelect');
  if (keySelect) {
    keySelect.addEventListener('change', function () {
      setCurrentKey(this.value);
      console.log('[Plan Mode] เปลี่ยนคีย์ ->', this.value, '| semitone offset:', semitoneOffsetOf(this.value, originalKey));
    });
  }

  document.getElementById('planStartBtn').addEventListener('click', deps.startPractice);

  populateKeySelect();
  updateOriginalKeyDisplay();
}
