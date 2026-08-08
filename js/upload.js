import { stemAudioElements, setOriginalKey, setCurrentKey, originalKey } from './state.js';
import { escapeHtml, formatSize, formatDate } from './utils.js';
import { saveSongs, loadSongs, autoSave } from './session.js';
import { analyzeFile } from './key-detection.js';
import { updateOriginalKeyDisplay } from './plan-mode.js';
import { saveSongBlob, removeSongBlob } from './song-store.js';
import { loadSongFromLibrary, refreshSongSelect, loadStemsForMixer } from './audio-engine.js';

const STEM_API_BASE = 'http://localhost:8001';

let songs = [];

export function renderSongs() {
  var songsList = document.getElementById('songsList');
  var songCount = document.getElementById('songCount');
  if (!songsList) return;
  if (songs.length === 0) {
    try {
      var data = localStorage.getItem('platoo_songs');
      if (data) songs = JSON.parse(data);
    } catch (e) {}
  }
  songsList.innerHTML = '';

  if (songs.length === 0) {
    songsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">&#9835;</span>
        <p>ยังไม่มีเพลง อัปโหลดเพลงเพื่อเริ่มต้น</p>
      </div>`;
    songCount.textContent = '0 เพลง';
    return;
  }

  songCount.textContent = songs.length + ' เพลง';

  songs.forEach((song, index) => {
    const item = document.createElement('div');
    item.className = 'song-item';

    item.innerHTML = `
      <span class="song-icon">&#9835;</span>
      <div class="song-info">
        <div class="song-name">${escapeHtml(song.name)}</div>
        <div class="song-meta">${formatSize(song.size)} &middot; ${formatDate(song.added)}${song.key ? ' &middot; คีย์: ' + escapeHtml(song.key) : ''}</div>
      </div>
      <span class="song-status">&#10003; พร้อมแยกเสียง</span>
      <button class="song-remove" data-index="${index}" title="ลบเพลง">&times;</button>
    `;

    item.querySelector('.song-remove').addEventListener('click', function (e) {
      e.stopPropagation();
      removeSong(index);
    });

    songsList.appendChild(item);
  });
}

export function removeSong(index) {
  var song = songs[index];
  if (song) removeSongBlob(song.id);
  songs.splice(index, 1);
  saveSongs(songs);
  renderSongs();
}

export function handleFile(file) {
  var uploadStatus = document.getElementById('uploadStatus');
  var statusText = document.getElementById('statusText');

  if (!file || !file.type.startsWith('audio/')) {
    alert('กรุณาเลือกไฟล์เพลงที่รองรับ (MP3, WAV, M4A)');
    return;
  }
  if (file.size > 100 * 1024 * 1024) {
    alert('ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 100MB)');
    return;
  }

  uploadStatus.hidden = false;
  statusText.textContent = 'กำลังประมวลผล ' + file.name + '...';

  // Simulate processing delay
  setTimeout(() => {
    const existing = songs.findIndex(s => s.name === file.name && s.size === file.size);
    if (existing !== -1) {
      statusText.textContent = 'ไฟล์นี้มีอยู่แล้วในรายการ';
      setTimeout(() => { uploadStatus.hidden = true; }, 1500);
      return;
    }

    songs.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: file.name,
      size: file.size,
      type: file.type,
      added: Date.now()
    });

    saveSongs(songs);
    renderSongs();

    uploadAndSeparate(file, songs[songs.length - 1].id);
    detectSongKey(file, songs[songs.length - 1].id);
    saveSongBlob(songs[songs.length - 1].id, file);
    loadSongFromLibrary(songs[songs.length - 1].id);
    refreshSongSelect();

    statusText.textContent = 'อัปโหลดสำเร็จ: ' + file.name;
    setTimeout(() => { uploadStatus.hidden = true; }, 2000);
  }, 800);
}

// ─── Auto key detection ───
function detectSongKey(file, songId) {
  analyzeFile(file).then(function (res) {
    if (res && res.key) {
      applyDetectedKey(res.key, songId);
    }
  });
}

// Set the detected key into state + UI (originalKey, dropdown default,
// display) and persist it to the song entry + session. Manual override is
// still possible afterwards via the เปลี่ยนคีย์ dropdown.
export function applyDetectedKey(key, songId) {
  setOriginalKey(key);
  setCurrentKey(key);
  var sel = document.getElementById('planKeySelect');
  if (sel) sel.value = key;
  updateOriginalKeyDisplay();
  if (songId) {
    var s = songs.find(function (x) { return x.id === songId; });
    if (s) {
      s.key = key;
      saveSongs(songs);
      renderSongs();
    }
  }
  autoSave();
  console.log('[Key Detection] คีย์ต้นฉบับ =', key);
}

// On startup: if there are songs with a detected key and originalKey is not
// set yet (no session), restore the most recently added song's key.
export function applySongKeyIfAny() {
  if (originalKey) return;
  var withKey = loadSongs().filter(function (s) { return s.key; });
  if (!withKey.length) return;
  withKey.sort(function (a, b) { return b.added - a.added; });
  applyDetectedKey(withKey[0].key, withKey[0].id);
}

async function uploadAndSeparate(file, songId) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(STEM_API_BASE + '/api/separate', {
      method: 'POST',
      body: formData
    });
    if (!response.ok) throw new Error('Server responded with ' + response.status);
    const data = await response.json();
    const stemsSection = document.getElementById('stemsSection');
    const stemsProgress = document.getElementById('stemsProgress');
    if (stemsSection) stemsSection.hidden = false;
    if (stemsProgress) stemsProgress.hidden = false;
    pollJobStatus(data.job_id, songId);
  } catch (err) {
    const statusText = document.getElementById('stemsStatusText');
    if (statusText) statusText.textContent = 'เกิดข้อผิดพลาด: ' + err.message;
  }
}

async function pollJobStatus(jobId, songId) {
  try {
    const response = await fetch(STEM_API_BASE + '/api/status/' + jobId);
    const data = await response.json();
    const stemsProgress = document.getElementById('stemsProgress');
    if (data.status === 'done') {
      if (stemsProgress) stemsProgress.hidden = true;
      loadStems(jobId, songId);
    } else if (data.status === 'error') {
      if (stemsProgress) stemsProgress.hidden = true;
      const statusText = document.getElementById('stemsStatusText');
      if (statusText) statusText.textContent = 'เกิดข้อผิดพลาด: ' + (data.error || 'ไม่ทราบสาเหตุ');
    } else if (data.status === 'processing') {
      setTimeout(pollJobStatus, 2000, jobId, songId);
    }
  } catch (err) {
    const stemsProgress = document.getElementById('stemsProgress');
    if (stemsProgress) stemsProgress.hidden = true;
    const statusText = document.getElementById('stemsStatusText');
    if (statusText) statusText.textContent = 'เกิดข้อผิดพลาด: ' + err.message;
  }
}

async function loadStems(jobId, songId) {
  try {
    const response = await fetch(STEM_API_BASE + '/api/stems/' + jobId);
    const data = await response.json();
    const stemsList = document.getElementById('stemsList');
    if (!stemsList) return;
    stemsList.innerHTML = '';
    const stemConfigs = [
      { name: 'vocals', icon: '🎤', desc: 'เสียงร้อง' },
      { name: 'drums', icon: '🥁', desc: 'กลอง' },
      { name: 'bass', icon: '🎸', desc: 'เบส' },
      { name: 'guitar', icon: '🎸', desc: 'กีตาร์' },
      { name: 'piano', icon: '🎹', desc: 'เปียโน/คีย์บอร์ด' },
      { name: 'other', icon: '🎵', desc: 'เครื่องดนตรีอื่นๆ' }
    ];
    const stemUrls = {};
    stemConfigs.forEach(function (cfg) {
      const url = STEM_API_BASE + data.stems[cfg.name];
      stemUrls[cfg.name] = url;
      const el = createStemElement(cfg.name, url, cfg.icon, cfg.desc);
      stemsList.appendChild(el);
    });
    // โหลดสเต็มเข้า Mixer — แต่ละแทร็ก (Vocal/Guitar/Bass/Drums/Piano/Other) จะเล่นสายของตัวเอง
    loadStemsForMixer(stemUrls, songId);
    const statusText = document.getElementById('stemsStatusText');
    if (statusText) statusText.textContent = 'แยกเสียงเสร็จ — โหลดเข้า Mixer แล้ว (กด play ที่แทร็กเพื่อฟังสายของตัวเอง)';
  } catch (err) {
    const statusText = document.getElementById('stemsStatusText');
    if (statusText) statusText.textContent = 'เกิดข้อผิดพลาด: ' + err.message;
  }
}

function createStemElement(name, url, icon, desc) {
  const div = document.createElement('div');
  div.className = 'stem-item';
  div.dataset.stem = name;
  div.innerHTML = [
    '<span class="stem-icon">' + icon + '</span>',
    '<div class="stem-info">',
    '  <div class="stem-name">' + name + ' (' + desc + ')</div>',
    '  <div class="stem-desc">' + desc + '</div>',
    '</div>',
    '<input type="range" class="stem-volume" min="0" max="1" step="0.05" value="1">',
    '<button class="stem-play-btn">▶</button>'
  ].join('');
  const audio = new Audio(url);
  stemAudioElements[name] = audio;
  const playBtn = div.querySelector('.stem-play-btn');
  const volSlider = div.querySelector('.stem-volume');
  audio.volume = 1;
  playBtn.addEventListener('click', function () {
    if (audio.paused) {
      audio.play()['catch'](function () {});
      playBtn.textContent = '⏸';
      div.classList.add('active');
    } else {
      audio.pause();
      playBtn.textContent = '▶';
      div.classList.remove('active');
    }
  });
  audio.addEventListener('ended', function () {
    playBtn.textContent = '▶';
    div.classList.remove('active');
  });
  volSlider.addEventListener('input', function () {
    audio.volume = parseFloat(this.value);
  });
  return div;
}
