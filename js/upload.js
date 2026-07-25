import { stemAudioElements } from './state.js';
import { escapeHtml, formatSize, formatDate } from './utils.js';
import { saveSongs } from './session.js';

const STEM_API_BASE = 'http://localhost:8001';

let songs = [];

export function getSongs() { return songs; }
export function setSongs(v) { songs = v; }

export function initUpload(handleFileCallback) {
  var uploadZone = document.getElementById('uploadZone');
  var fileInput = document.getElementById('fileInput');
  var selectFileBtn = document.getElementById('selectFileBtn');

  selectFileBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    fileInput.click();
  });

  uploadZone.addEventListener('click', function () {
    fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    if (this.files && this.files[0]) {
      handleFileCallback(this.files[0]);
    }
    this.value = '';
  });

  uploadZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    this.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', function () {
    this.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', function (e) {
    e.preventDefault();
    this.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileCallback(e.dataTransfer.files[0]);
    }
  });
}

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
        <div class="song-meta">${formatSize(song.size)} &middot; ${formatDate(song.added)}</div>
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

    uploadAndSeparate(file);

    statusText.textContent = 'อัปโหลดสำเร็จ: ' + file.name;
    setTimeout(() => { uploadStatus.hidden = true; }, 2000);
  }, 800);
}

async function uploadAndSeparate(file) {
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
    pollJobStatus(data.job_id);
  } catch (err) {
    const statusText = document.getElementById('stemsStatusText');
    if (statusText) statusText.textContent = 'เกิดข้อผิดพลาด: ' + err.message;
  }
}

async function pollJobStatus(jobId) {
  try {
    const response = await fetch(STEM_API_BASE + '/api/status/' + jobId);
    const data = await response.json();
    const stemsProgress = document.getElementById('stemsProgress');
    if (data.status === 'done') {
      if (stemsProgress) stemsProgress.hidden = true;
      loadStems(jobId);
    } else if (data.status === 'error') {
      if (stemsProgress) stemsProgress.hidden = true;
      const statusText = document.getElementById('stemsStatusText');
      if (statusText) statusText.textContent = 'เกิดข้อผิดพลาด: ' + (data.error || 'ไม่ทราบสาเหตุ');
    } else if (data.status === 'processing') {
      setTimeout(pollJobStatus, 2000, jobId);
    }
  } catch (err) {
    const stemsProgress = document.getElementById('stemsProgress');
    if (stemsProgress) stemsProgress.hidden = true;
    const statusText = document.getElementById('stemsStatusText');
    if (statusText) statusText.textContent = 'เกิดข้อผิดพลาด: ' + err.message;
  }
}

async function loadStems(jobId) {
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
      { name: 'other', icon: '🎹', desc: 'เครื่องดนตรีอื่นๆ' }
    ];
    stemConfigs.forEach(function (cfg) {
      const url = STEM_API_BASE + data.stems[cfg.name];
      const el = createStemElement(cfg.name, url, cfg.icon, cfg.desc);
      stemsList.appendChild(el);
    });
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
