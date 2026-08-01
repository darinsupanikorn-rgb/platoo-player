// ─── platoo-player: Utility Functions ───

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function formatDuration(ms) {
  var mins = Math.floor(ms / 60000);
  var secs = Math.floor((ms % 60000) / 1000);
  return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

export function buildLegend(elId, items) {
  var el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = items.map(function (item) {
    return '<span class="legend-item"><span class="legend-key">' + item.key + '</span> ' + item.label + '</span>';
  }).join('');
}

// ─── Song key helpers (transpose) ───

const PITCH_CLASSES = {
  'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
  'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
};

export function keyNameToPitchClass(keyName) {
  if (!keyName) return 0;
  var m = String(keyName).match(/^([A-G]#?)/);
  return (m && PITCH_CLASSES[m[1]] !== undefined) ? PITCH_CLASSES[m[1]] : 0;
}

export function semitoneOffsetOf(currentKey, originalKey) {
  var cur = keyNameToPitchClass(currentKey);
  var orig = keyNameToPitchClass(originalKey || 'C');
  var raw = cur - orig;
  if (raw > 6) raw -= 12;
  if (raw <= -6) raw += 12;
  return raw;
}

export function applySemitoneOffset(freq, offset) {
  return freq * Math.pow(2, offset / 12);
}
