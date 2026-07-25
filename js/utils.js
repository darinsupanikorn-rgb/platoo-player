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
