import { saveTimeout, setSaveTimeout, trackCounter, setTrackCounter } from './state.js';
import { escapeHtml } from './utils.js';

let addNewTrackFn = null;

export function initSession(deps) {
  addNewTrackFn = deps.addNewTrack;
}

export function autoSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  setSaveTimeout(setTimeout(saveSession, 500));
}

export function saveSession() {
  var backingTracklist = document.getElementById('backingTracklist');
  var tracks = backingTracklist.querySelectorAll('.backing-track');
  var data = [];
  tracks.forEach(function (track) {
    var id = track.dataset.id;
    if (!id || !id.startsWith('track_')) return;
    var type = track.dataset.type;
    var iconEl = track.querySelector('.track-icon');
    var nameEl = track.querySelector('.track-name');
    var volSlider = track.querySelector('.track-vol');
    var panSlider = track.querySelector('.pan-slider');
    var muteBtn = track.querySelector('.track-mute');
    var soloBtn = track.querySelector('.track-solo');
    var eqSliders = track.querySelectorAll('.eq-slider');
    var eq = { bass: 0, mid: 0, treble: 0 };
    eqSliders.forEach(function (s) {
      eq[s.dataset.band] = parseInt(s.value);
    });
    data.push({
      id: id,
      type: type,
      icon: iconEl ? iconEl.textContent : '',
      name: nameEl ? nameEl.textContent : '',
      volume: volSlider ? parseInt(volSlider.value) : 80,
      pan: panSlider ? parseInt(panSlider.value) : 0,
      eq_bass: eq.bass,
      eq_mid: eq.mid,
      eq_treble: eq.treble,
      muted: muteBtn ? muteBtn.classList.contains('active') : false,
      solo: soloBtn ? soloBtn.classList.contains('active') : false
    });
  });
  localStorage.setItem('platoo_session', JSON.stringify({ tracks: data, trackCounter: trackCounter }));
}

export function loadSession() {
  var saved = localStorage.getItem('platoo_session');
  if (!saved) return;
  try {
    var data = JSON.parse(saved);
    if (data.trackCounter) setTrackCounter(data.trackCounter);
    if (data.tracks) {
      data.tracks.forEach(function (t) {
        addNewTrackFn(t.type, t);
      });
    }
  } catch (e) {
    // ignore corrupt data
  }
}

export function loadSongs() {
  try {
    const data = localStorage.getItem('platoo_songs');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveSongs(songs) {
  localStorage.setItem('platoo_songs', JSON.stringify(songs));
}
