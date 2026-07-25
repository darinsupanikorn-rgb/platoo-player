(function () {
  'use strict';

  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');
  const selectFileBtn = document.getElementById('selectFileBtn');
  const uploadStatus = document.getElementById('uploadStatus');
  const statusText = document.getElementById('statusText');
  const songsList = document.getElementById('songsList');
  const songCount = document.getElementById('songCount');

  let songs = loadSongs();

  // ─── Plan Mode Variables ───
  let practiceBPM = 120;
  let metronomeEnabled = false;
  let metronomeVolume = 0.3;
  let metronomeInterval = null;
  let metronomeBeatCount = 0;
  let loopEnabled = false;
  let loopStart = 0;
  let loopEnd = 0;
  let practiceSpeed = 1.0;
  let pitchPreserve = true;
  let tapTimes = [];

  function loadSongs() {
    try {
      const data = localStorage.getItem('platoo_songs');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function saveSongs() {
    localStorage.setItem('platoo_songs', JSON.stringify(songs));
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('th-TH', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function renderSongs() {
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

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function removeSong(index) {
    songs.splice(index, 1);
    saveSongs();
    renderSongs();
  }

  function handleFile(file) {
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

      saveSongs();
      renderSongs();

      uploadAndSeparate(file);

      statusText.textContent = 'อัปโหลดสำเร็จ: ' + file.name;
      setTimeout(() => { uploadStatus.hidden = true; }, 2000);
    }, 800);
  }

  // ─── Instruments ───

  const instruments = [
    { id: 'vocal', label: 'Vocal', icon: '🎤', group: 'vocal' },
    { id: 'drums', label: 'Drums', icon: '🥁', group: 'drums' },
    { id: 'bass', label: 'Bass', icon: '🎸', group: 'strings' },
    { id: 'guitar', label: 'Guitar', icon: '🎸', group: 'strings' },
    { id: 'piano', label: 'Piano', icon: '🎹', group: 'keys' },
    { id: 'other', label: 'Other', icon: '🎵', group: 'other' },
  ];

  const instList = document.getElementById('instList');
  const instDetail = document.getElementById('instDetail');
  const instDetailTitle = document.getElementById('instDetailTitle');
  const instDetailDesc = document.getElementById('instDetailDesc');
  const instBackBtn = document.getElementById('instBackBtn');
  const instState = {};

  function initInstruments() {
    instList.innerHTML = '';

    instruments.forEach((inst) => {
      if (instState[inst.id] === undefined) instState[inst.id] = 80;
      if (instState[inst.id + '_muted'] === undefined) instState[inst.id + '_muted'] = false;

      const btn = document.createElement('button');
      btn.className = 'inst-btn';
      btn.innerHTML = `<span class="inst-icon">${inst.icon}</span> ${inst.label}`;
      btn.dataset.id = inst.id;

      btn.addEventListener('click', function () {
        if (window.innerWidth <= 768) closeSidebar();
        showInstrumentDetail(inst.id);
      });

      instList.appendChild(btn);
    });
  }

  function showInstrumentDetail(id) {
    const inst = instruments.find(i => i.id === id);
    if (!inst) return;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    document.getElementById('tab-instrument').classList.add('active');

    instDetailTitle.textContent = inst.icon + ' ' + inst.label;
    instDetailDesc.textContent = 'ปรับแต่งระดับเสียงและตั้งค่า ' + inst.label;

    renderInstrumentDetail(id);
  }

  function renderInstrumentDetail(id) {
    const inst = instruments.find(i => i.id === id);
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

  function renderNotation(notesStr) {
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

  instBackBtn.addEventListener('click', function () {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('.nav-item[data-tab="dashboard"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-dashboard').classList.add('active');
  });

  // ─── Record (compact bar + per-track) ───

  let mediaRecorder = null;
  let recordedChunks = [];
  let recordingStream = null;
  let recordingTimer = null;
  let recordingStartTime = null;
  let isRecording = false;
  let audioContext = null;
  let analyserNode = null;
  let animationFrame = null;
  let currentRecTrackId = null;

  // ─── Metronome Visual (Record Tab) ───
  let metronomeClickEnabled = false;
  let metroFlashInterval = null;
  let metroIndicatorEl = null;
  let bpmDisplayEl = null;

  const recordStartBtn = document.getElementById('recordStartBtn');
  const recordStopBtn = document.getElementById('recordStopBtn');
  const recordTimer = document.getElementById('recordTimer');
  const deviceName = document.getElementById('deviceName');
  const levelBar = document.getElementById('levelBar');
  const recordingsList = document.getElementById('recordingsList');
  const recCount = document.getElementById('recCount');

  let recordings = loadRecordings();

  const undoStack = [];
  const redoStack = [];
  const MAX_UNDO = 30;

  function captureTrackState() {
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

  function pushUndoState() {
    undoStack.push(captureTrackState());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
    updateUndoRedoButtons();
  }

  function undo() {
    if (undoStack.length === 0) return;
    var current = captureTrackState();
    var prev = undoStack.pop();
    redoStack.push(current);
    restoreTrackState(prev);
    updateUndoRedoButtons();
  }

  function redo() {
    if (redoStack.length === 0) return;
    var current = captureTrackState();
    var next = redoStack.pop();
    undoStack.push(current);
    restoreTrackState(next);
    updateUndoRedoButtons();
  }

  function restoreTrackState(state) {
    var tracks = backingTracklist.querySelectorAll('.backing-track');
    tracks.forEach(function (t) {
      var id = t.dataset.id;
      if (id && id.startsWith('track_')) t.remove();
    });
    trackCounter = state.trackCounter || 0;
    if (state.tracks) {
      state.tracks.forEach(function (t) {
        addNewTrack(t.type, t);
      });
    }
    autoSave();
  }

  function updateUndoRedoButtons() {
    var undoBtn = document.getElementById('undoBtn');
    var redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
  }

  function loadRecordings() {
    try {
      const data = localStorage.getItem('platoo_recordings');
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  }

  function saveRecordings() {
    localStorage.setItem('platoo_recordings', JSON.stringify(recordings.map(r => ({
      id: r.id,
      name: r.name,
      duration: r.duration,
      date: r.date,
      size: r.size
    }))));
  }

  async function requestMic() {
    try {
      recordingStream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      }});
      const tracks = recordingStream.getAudioTracks();
      if (tracks.length > 0) {
        deviceName.textContent = '&#127897; ' + (tracks[0].label || 'ไมโครโฟน');
      }
      recordStartBtn.disabled = false;

      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(recordingStream);
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;
      source.connect(analyserNode);

      mediaRecorder = new MediaRecorder(recordingStream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' });
      recordedChunks = [];

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
      deviceName.textContent = '&#9888; ' + err.message;
      recordStartBtn.disabled = true;
    }
  }

  function startLevelMeter() {
    if (!analyserNode) return;
    var freqArray = new Uint8Array(analyserNode.frequencyBinCount);
    var waveformArray = new Uint8Array(analyserNode.fftSize);
    function tick() {
      if (!analyserNode) return;
      // Level meter
      analyserNode.getByteFrequencyData(freqArray);
      var sum = 0;
      for (var i = 0; i < freqArray.length; i++) sum += freqArray[i];
      var avg = sum / freqArray.length;
      var pct = Math.min(100, (avg / 128) * 100);
      levelBar.style.width = pct + '%';
      if (pct > 60) levelBar.style.background = '#c33';
      else if (pct > 30) levelBar.style.background = '#888';
      else levelBar.style.background = '#555';

      // Real-time waveform on recording track
      if (isRecording && currentRecTrackId) {
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
              // Scroll existing waveform left, draw new sample at right
              ctx.strokeStyle = '#c33';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(0, h / 2);
              for (var x = 0; x < w; x++) {
                var idx = Math.floor(x / w * waveformArray.length);
                var val = (waveformArray[idx] / 128) - 1; // normalize around 0
                ctx.lineTo(x, h / 2 + val * (h / 2 - 4));
              }
              ctx.stroke();
            }
          }
        }
      }

      animationFrame = requestAnimationFrame(tick);
    }
    tick();
  }

  function stopLevelMeter() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    levelBar.style.width = '0%';
  }

  function startGlobalRecord() {
    ensureAudioCtx();
    recordedChunks = [];
    currentRecTrackId = null;
    if (mediaRecorder && mediaRecorder.state !== 'recording') {
      mediaRecorder.start(100);
      isRecording = true;
      recordingStartTime = Date.now();
      recordStartBtn.classList.add('recording');
      recordStartBtn.disabled = true;
      recordStopBtn.disabled = false;
      updateTimer();
      startMetronomeVisual();
    }
  }

  function stopGlobalRecord() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      var wasTrackRec = currentRecTrackId;
      mediaRecorder.stop();
      isRecording = false;
      if (recordingTimer) clearInterval(recordingTimer);
      recordStartBtn.classList.remove('recording');
      recordStartBtn.disabled = false;
      recordStopBtn.disabled = true;
      recordTimer.textContent = '00:00.0';
      stopMetronomeVisual();
      // Reset R button on the track
      if (wasTrackRec) {
        var rBtn = backingTracklist.querySelector('.backing-track[data-id="' + wasTrackRec + '"] .track-rec');
        if (rBtn) rBtn.classList.remove('active');
      }
    }
  }

  function startTrackRecord(trackId) {
    ensureAudioCtx();
    if (!mediaRecorder) { requestMic(); return; }
    recordedChunks = [];
    currentRecTrackId = trackId;
    if (mediaRecorder && mediaRecorder.state !== 'recording') {
      mediaRecorder.start(100);
      isRecording = true;
      recordingStartTime = Date.now();
      recordStartBtn.classList.add('recording');
      recordStartBtn.disabled = true;
      recordStopBtn.disabled = false;
      updateTimer();
      startMetronomeVisual();
    }
  }

  function finishTrackRecording(blob, duration) {
    var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var trackEl = currentRecTrackId ? backingTracklist.querySelector('.backing-track[data-id="' + currentRecTrackId + '"]') : null;
    var trackName = trackEl ? trackEl.querySelector('.track-name').textContent : 'บันทึก';
    var rec = { id: id, name: trackName + ' (' + formatDate(Date.now()) + ')', duration: duration, date: Date.now(), size: blob.size, blob: blob };
    recordings.push(rec);
    saveRecordings();
    storeBlob(id, blob);
    renderRecordings();

    // Draw waveform on the recorded track
    if (trackEl) {
      var canvas = trackEl.querySelector('.track-waveform');
      if (canvas) drawRecordedWaveform(canvas, blob);
    }

    pushUndoState();
    currentRecTrackId = null;
  }

  function drawRecordedWaveform(canvas, blob) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var url = URL.createObjectURL(blob);
    var ac = new (window.AudioContext || window.webkitAudioContext)();
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
        URL.revokeObjectURL(url);
      });
    };
    reader.readAsArrayBuffer(blob);
  }

  function updateTimer() {
    if (recordingTimer) clearInterval(recordingTimer);
    recordingTimer = setInterval(function () {
      const elapsed = Date.now() - recordingStartTime;
      const mins = Math.floor(elapsed / 60000);
      const secs = Math.floor((elapsed % 60000) / 1000);
      const tenths = Math.floor((elapsed % 1000) / 100);
      recordTimer.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0') + '.' + tenths;
    }, 100);
  }

  function storeBlob(id, blob) {
    var reader = new FileReader();
    reader.onloadend = function () {
      try { localStorage.setItem('platoo_rec_blob_' + id, reader.result); } catch {}
    };
    reader.readAsDataURL(blob);
  }

  function getBlobData(id) { return localStorage.getItem('platoo_rec_blob_' + id); }

  function removeRecording(index) {
    var rec = recordings[index];
    if (rec) { try { localStorage.removeItem('platoo_rec_blob_' + rec.id); } catch {} }
    recordings.splice(index, 1);
    saveRecordings();
    renderRecordings();
  }

  function downloadRecording(index) {
    var rec = recordings[index];
    if (!rec) return;
    var data = getBlobData(rec.id);
    if (!data) return;
    var a = document.createElement('a');
    a.href = data; a.download = rec.name + '.webm';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function playRecording(index) {
    var rec = recordings[index];
    if (!rec) return;
    var data = getBlobData(rec.id);
    if (!data) return;
    var audio = new Audio(data); audio.play();
  }

  function formatDuration(ms) {
    var mins = Math.floor(ms / 60000);
    var secs = Math.floor((ms % 60000) / 1000);
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  function renderRecordings() {
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

  function initMetronomeUI() {
    metroIndicatorEl = document.getElementById('metroIndicator');
    bpmDisplayEl = document.getElementById('bpmDisplay');
    if (bpmDisplayEl) bpmDisplayEl.textContent = practiceBPM;
    var toggleBtn = document.getElementById('metroToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        metronomeClickEnabled = !metronomeClickEnabled;
        this.textContent = metronomeClickEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD28';
        this.classList.toggle('active', metronomeClickEnabled);
      });
    }
    var minusBtn = document.getElementById('bpmMinus');
    var plusBtn = document.getElementById('bpmPlus');
    if (minusBtn) minusBtn.addEventListener('click', function () { updateBPM(practiceBPM - 5); updateBpmDisplay(); });
    if (plusBtn) plusBtn.addEventListener('click', function () { updateBPM(practiceBPM + 5); updateBpmDisplay(); });
  }

  function updateBpmDisplay() {
    if (bpmDisplayEl) bpmDisplayEl.textContent = practiceBPM;
  }

  function startMetronomeVisual() {
    if (metroFlashInterval) return;
    var beatCount = 0;
    metroFlashInterval = setInterval(function () {
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
        playMetronomeClick(isDownbeat);
      }
    }, 60000 / practiceBPM);
  }

  function stopMetronomeVisual() {
    if (metroFlashInterval) {
      clearInterval(metroFlashInterval);
      metroFlashInterval = null;
    }
    if (metroIndicatorEl) {
      metroIndicatorEl.classList.remove('flash1', 'flash2');
    }
  }

  recordStartBtn.addEventListener('click', startGlobalRecord);
  recordStopBtn.addEventListener('click', stopGlobalRecord);

  var micRequested = false;
  document.querySelector('.nav-item[data-tab="record"]').addEventListener('click', function () {
    if (!micRequested) { micRequested = true; setTimeout(requestMic, 500); }
    renderRecordings();
    // Re-init backing tracks to ensure rec buttons work
    if (backingTracklist.querySelector('.backing-track')) { }
  });

  // ─── Backing Track (GarageBand-style) ───

  let backingAudioCtx = null;
  let backingSource = null;
  let backingGainNodes = {};
  let backingPanNodes = {};
  let backingBuffer = null;
  let backingIsPlaying = false;
  let backingStartOffset = 0;
  let backingStartTime = 0;
  let backingLevelAnims = {};
  let activePlayTrack = null; // id of currently playing solo track
  let masterGain = null;
  const backingDistNodes = {};
  const backingDelayNodes = {};
  const backingDelayFeedback = {};
  const backingDelayWet = {};
  const backingReverbNodes = {};
  const backingReverbWet = {};
  const backingEqBass = {};
  const backingEqMid = {};
  const backingEqTreble = {};

  const backingSelectBtn = document.getElementById('backingSelectBtn');
  const backingFileInput = document.getElementById('backingFileInput');
  const backingFilename = document.getElementById('backingFilename');
  const backingPlayBtn = document.getElementById('backingPlayBtn');
  const backingPauseBtn = document.getElementById('backingPauseBtn');
  const backingStopBtn = document.getElementById('backingStopBtn');
  const backingTracklist = document.getElementById('backingTracklist');

  var playheadAnimId = null;

  function drawWaveform(id, canvas) {
    if (!backingBuffer || !canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var w = canvas.width;
    var h = canvas.height;
    var data = backingBuffer.getChannelData(0);
    var step = Math.ceil(data.length / w);
    var amp = h / 2;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);

    var colorMap = { vocal: '#5b8def', drums: '#e6c340', bass: '#6dbf6d', guitar: '#e68a3f', piano: '#c473d1', other: '#6ab0c9' };
    var color = colorMap[id] || '#888';

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

    // Mirror bottom half
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

  function updatePlayhead() {
    if (!backingBuffer || !backingIsPlaying) return;
    var duration = backingBuffer.duration;
    var elapsed = (Date.now() - backingStartTime) / 1000;
    var displayPos = elapsed;
    if (loopEnabled && loopEnd > loopStart && displayPos >= loopStart) {
      var loopLen = loopEnd - loopStart;
      displayPos = loopStart + ((displayPos - loopStart) % loopLen);
    }
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
    if (backingIsPlaying) playheadAnimId = requestAnimationFrame(updatePlayhead);
  }

  function initBackingTracks() {
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
            <button class="track-btn track-play${isActive ? ' active' : ''}" data-id="${inst.id}" data-action="play">${isActive ? '⏸' : '▶'}</button>
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

      // Volume slider
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

      // Play/Pause button
      var playBtn = track.querySelector('.track-play');
      playBtn.addEventListener('click', function () {
        var id = this.dataset.id;
        if (activePlayTrack === id && backingIsPlaying) {
          pauseBacking();
          activePlayTrack = null;
          this.textContent = '▶';
          this.classList.remove('active');
        } else {
          // Solo this track and play
          instruments.forEach(function (i) {
            instState[i.id + '_solo'] = i.id === id;
          });
          activePlayTrack = id;
          this.textContent = '⏸';
          this.classList.add('active');
          updateSoloMute();
          createBackingGains();
          if (!backingIsPlaying || backingStartOffset === 0) {
            backingStartOffset = 0;
            startBacking();
          } else {
            // Restart from beginning for this track
            backingStartOffset = 0;
            if (backingSource) { try { backingSource.stop(); } catch {}; backingSource.disconnect(); }
            startBacking();
          }
        }
      });

      // Mute button
      var muteBtn = track.querySelector('.track-mute');
      muteBtn.addEventListener('click', function () {
        var id = this.dataset.id;
        instState[id + '_muted'] = !instState[id + '_muted'];
        this.classList.toggle('active');
        if (backingGainNodes[id]) {
          backingGainNodes[id].gain.value = instState[id + '_muted'] ? 0 : instState[id] / 100;
        }
      });

      // Solo button
      var soloBtn = track.querySelector('.track-solo');
      soloBtn.addEventListener('click', function () {
        var id = this.dataset.id;
        instState[id + '_solo'] = !instState[id + '_solo'];
        this.classList.toggle('active');
        updateSoloMute();
      });

      // FX button
      var fxBtn = track.querySelector('.track-fx');
      fxBtn.addEventListener('click', function () {
        var id = this.dataset.id;
        var panel = document.getElementById('fx_' + id);
        if (panel) {
          panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
        }
      });

      // Pan slider
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

      // FX sliders
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

      // EQ sliders
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

  function updateSoloMute() {
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

  function startBackingLevelMeter(id) {
    var bar = document.getElementById('tlvl_' + id);
    if (!bar || !backingGainNodes[id]) return;
    function tick() {
      if (!backingIsPlaying || !bar) { bar.style.width = '0%'; return; }
      var now = Date.now();
      var val = Math.sin(now / 300 + instruments.findIndex(function (i) { return i.id === id; }) * 2) * 0.3 + 0.5;
      var pct = Math.min(80, Math.max(0, val * 60 * (instState[id] / 100)));
      bar.style.width = pct + '%';
      if (pct > 50) bar.style.background = '#e68a3f';
      else if (pct > 25) bar.style.background = '#e6c340';
      else bar.style.background = '#5b8def';
      backingLevelAnims[id] = requestAnimationFrame(tick);
    }
    tick();
  }

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

  function loadBackingTrack(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var arrayBuffer = e.target.result;
      if (!backingAudioCtx) backingAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      backingAudioCtx.decodeAudioData(arrayBuffer, function (buffer) {
        backingBuffer = buffer;
        backingPlayBtn.disabled = false;
        backingPauseBtn.disabled = true;
        backingStopBtn.disabled = true;
        createBackingGains();
        // Draw/redraw waveforms
        instruments.forEach(function (inst) {
          var canvas = document.getElementById('waveform_' + inst.id);
          if (canvas) drawWaveform(inst.id, canvas);
        });
      }, function () {
        alert('ไม่สามารถโหลดไฟล์เสียงได้');
      });
    };
    reader.readAsArrayBuffer(file);
  }

  function makeDistortionCurve(amount) {
    var samples = 256;
    var curve = new Float32Array(samples);
    for (var i = 0; i < samples; i++) {
      var x = (i * 2) / samples - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + (amount * Math.abs(x)));
    }
    return curve;
  }

  function createReverbImpulse(duration, decay) {
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

  function updateTrackFX(id) {
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

  function createBackingGains() {
    if (!backingAudioCtx || !backingBuffer) return;
    if (!masterGain) {
      masterGain = backingAudioCtx.createGain();
      masterGain.gain.value = 0.8;
      masterGain.connect(backingAudioCtx.destination);
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

  function startBacking() {
    if (!backingAudioCtx || !backingBuffer) return;
    if (backingAudioCtx.state === 'suspended') backingAudioCtx.resume();

    if (backingSource) {
      try { backingSource.stop(); } catch {}
      backingSource.disconnect();
    }

    backingSource = backingAudioCtx.createBufferSource();
    backingSource.buffer = backingBuffer;
    backingSource.playbackRate.value = practiceSpeed;
    if (loopEnabled && loopEnd > loopStart) {
      backingSource.loop = true;
      backingSource.loopStart = loopStart;
      backingSource.loopEnd = loopEnd;
    }

    instruments.forEach(function (inst) {
      var gain = backingGainNodes[inst.id];
      if (gain) {
        backingSource.connect(gain);
      }
    });

    updateSoloMute();
    if (metronomeEnabled) startMetronome();
    startMetronomeVisual();

    backingSource.start(0, backingStartOffset);
    backingIsPlaying = true;
    backingStartTime = Date.now() - backingStartOffset * 1000;

    backingPlayBtn.disabled = true;
    backingPauseBtn.disabled = false;
    backingStopBtn.disabled = false;

    // Update all play buttons to reflect active state
    document.querySelectorAll('.track-play').forEach(function (btn) {
      var id = btn.dataset.id;
      if (activePlayTrack === id) { btn.textContent = '⏸'; btn.classList.add('active'); }
      else { btn.textContent = '▶'; btn.classList.remove('active'); }
    });

    // Start playhead animation
    playheadAnimId = requestAnimationFrame(updatePlayhead);
  }

  function stopBacking() {
    stopMetronome();
    stopMetronomeVisual();
    if (backingSource) {
      try { backingSource.stop(); } catch {}
      backingSource.disconnect();
    }
    backingIsPlaying = false;
    backingStartOffset = 0;
    activePlayTrack = null;
    if (playheadAnimId) { cancelAnimationFrame(playheadAnimId); playheadAnimId = null; }
    backingPlayBtn.disabled = false;
    backingPauseBtn.disabled = true;
    backingStopBtn.disabled = true;
    // Reset waveforms to no playhead
    instruments.forEach(function (i) {
      var canvas = document.getElementById('waveform_' + i.id);
      if (canvas) drawWaveform(i.id, canvas);
    });
  }

  function pauseBacking() {
    if (backingSource && backingIsPlaying) {
      backingStartOffset = (Date.now() - backingStartTime) / 1000;
      try { backingSource.stop(); } catch {}
      backingSource.disconnect();
      backingIsPlaying = false;
      if (playheadAnimId) { cancelAnimationFrame(playheadAnimId); playheadAnimId = null; }
      backingPlayBtn.disabled = false;
      backingPauseBtn.disabled = true;
    }
    stopMetronomeVisual();
  }

  // ─── Plan Mode Functions ───

  function updateBPM(value) {
    practiceBPM = Math.min(240, Math.max(40, Math.round(value)));
    var input = document.getElementById('planBpmInput');
    var slider = document.getElementById('planBpmSlider');
    if (input) input.value = practiceBPM;
    if (slider) slider.value = practiceBPM;
    updateBpmDisplay();
    if (metronomeEnabled) {
      stopMetronome();
      startMetronome();
    }
    if (metroFlashInterval) {
      stopMetronomeVisual();
      startMetronomeVisual();
    }
  }

  function tapTempo() {
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

  function playMetronomeClick(isDownbeat) {
    try {
      if (!backingAudioCtx || backingAudioCtx.state === 'closed') {
        backingAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (backingAudioCtx.state === 'suspended') backingAudioCtx.resume();
      var now = backingAudioCtx.currentTime;
      var osc = backingAudioCtx.createOscillator();
      var gain = backingAudioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = isDownbeat ? 1000 : 800;
      gain.gain.setValueAtTime(metronomeVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) { console.warn('metronome click error:', e); }
  }

  function startMetronome() {
    stopMetronome();
    metronomeBeatCount = 0;
    metronomeInterval = setInterval(function () {
      var isDownbeat = metronomeBeatCount % 4 === 0;
      playMetronomeClick(isDownbeat);
      metronomeBeatCount++;
    }, 60000 / practiceBPM);
  }

  function stopMetronome() {
    if (metronomeInterval) {
      clearInterval(metronomeInterval);
      metronomeInterval = null;
    }
    metronomeBeatCount = 0;
  }

  function setLoopStart() {
    if (!backingBuffer) {
      alert('กรุณาโหลดไฟล์เสียงก่อนตั้งจุดลูป');
      return;
    }
    var currentPos = 0;
    if (backingIsPlaying) {
      currentPos = (Date.now() - backingStartTime) / 1000;
    }
    loopStart = currentPos;
    updateLoopDisplay();
  }

  function setLoopEnd() {
    if (!backingBuffer) {
      alert('กรุณาโหลดไฟล์เสียงก่อนตั้งจุดลูป');
      return;
    }
    var currentPos = backingBuffer.duration;
    if (backingIsPlaying) {
      currentPos = (Date.now() - backingStartTime) / 1000;
    }
    loopEnd = currentPos;
    if (loopEnd > loopStart) {
      updateLoopDisplay();
    }
  }

  function toggleLoop() {
    loopEnabled = !loopEnabled;
    var status = document.getElementById('planLoopStatus');
    if (status) status.textContent = loopEnabled ? 'เปิด' : 'ปิด';
    if (backingIsPlaying && loopEnabled) {
      if (loopEnd <= loopStart) {
        loopEnd = backingBuffer ? backingBuffer.duration : 0;
      }
      backingStartOffset = (Date.now() - backingStartTime) / 1000;
      startBacking();
    }
  }

  function updateLoopDisplay() {
    function fmt(t) { var m = Math.floor(t / 60); var s = Math.floor(t % 60); return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }
    var startEl = document.getElementById('planLoopStartTime');
    var endEl = document.getElementById('planLoopEndTime');
    if (startEl) startEl.textContent = fmt(loopStart);
    if (endEl) endEl.textContent = fmt(loopEnd);
  }

  function updateSpeed(value) {
    practiceSpeed = value;
    var valEl = document.getElementById('planSpeedVal');
    if (valEl) valEl.textContent = practiceSpeed.toFixed(1) + 'x';
    if (backingIsPlaying && backingSource) {
      try {
        backingSource.playbackRate.setValueAtTime(practiceSpeed, backingAudioCtx.currentTime);
      } catch (e) {
        var offset = (Date.now() - backingStartTime) / 1000;
        backingStartOffset = offset;
        startBacking();
      }
    }
  }

  function startPractice() {
    if (!backingBuffer) {
      alert('กรุณาโหลดไฟล์เสียงก่อนเริ่มฝึกซ้อม');
      return;
    }
    if (backingIsPlaying) {
      stopBacking();
    }
    if (loopEnabled) {
      if (loopEnd <= loopStart) {
        loopEnd = backingBuffer.duration;
      }
      backingStartOffset = loopStart;
    } else {
      backingStartOffset = 0;
    }
    startBacking();
  }

  backingPlayBtn.addEventListener('click', startBacking);
  backingPauseBtn.addEventListener('click', pauseBacking);
  backingStopBtn.addEventListener('click', stopBacking);

  // ─── Bounce / Export Mixdown ───

  document.getElementById('bounceBtn').addEventListener('click', bounceMixdown);

  function bounceMixdown() {
    if (!backingBuffer) {
      alert('กรุณาโหลดไฟล์เสียงก่อนทำการ Bounce');
      return;
    }

    var btn = document.getElementById('bounceBtn');
    var origText = btn.textContent;
    btn.textContent = '⏳ กำลัง Bounce...';
    btn.disabled = true;

    var sampleRate = backingBuffer.sampleRate;
    var duration = backingBuffer.duration;
    var offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * duration), sampleRate);

    var anySolo = instruments.some(function (i) { return instState[i.id + '_solo']; });

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
      gainNode.gain.value = vol;

      var panNode = offlineCtx.createStereoPanner();
      panNode.pan.value = panVal;

      source.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(offlineCtx.destination);

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
      alert('เกิดข้อผิดพลาดในการ Bounce');
      btn.textContent = origText;
      btn.disabled = false;
    });
  }

  function encodeWAV(audioBuffer) {
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

  function writeString(view, offset, str) {
    for (var i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  var trackCounter = 0;

  initBackingTracks();
  loadSession();

  // ─── Add Track / Instrument UI ───

  var addTrackBtn = document.getElementById('addTrackBtn');
  var addTrackModal = document.getElementById('addTrackModal');
  var modalCloseBtn = document.getElementById('modalCloseBtn');
  var activeOscillators = {};

  var pianoSection = document.getElementById('pianoSection');
  var guitarSection = document.getElementById('guitarSection');
  var bassSection = document.getElementById('bassSection');
  var drumsSection = document.getElementById('drumsSection');
  var pianoKeysEl = document.getElementById('pianoKeys');
  var guitarFretboardEl = document.getElementById('guitarFretboard');
  var bassFretboardEl = document.getElementById('bassFretboard');
  var drumsPadsEl = document.getElementById('drumsPads');

  addTrackBtn.addEventListener('click', function () {
    addTrackModal.classList.add('open');
  });

  function closeModal() {
    addTrackModal.classList.remove('open');
  }

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

  function addNewTrack(type, restoreData) {
    if (!restoreData) pushUndoState();
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
      if (num > trackCounter) trackCounter = num;
    } else {
      trackCounter++;
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
      showInstrumentUI(type);
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
        if (isRecording) {
          stopGlobalRecord();
          // Small delay to let previous stop complete
        }
        if (!recordingStream) {
          requestMic().then(function () {
            startTrackRecord(id);
          })['catch'](function () {
            self.classList.remove('active');
          });
        } else {
          startTrackRecord(id);
        }
      } else {
        // Turning off rec — stop recording
        if (isRecording && currentRecTrackId === id) {
          stopGlobalRecord();
        }
      }
    });

    // Mute
    track.querySelector('.track-mute').addEventListener('click', function () {
      this.classList.toggle('active');
      autoSave();
    });

    // Solo
    track.querySelector('.track-solo').addEventListener('click', function () {
      this.classList.toggle('active');
      autoSave();
    });

    // Volume
    track.querySelector('.track-vol').addEventListener('input', function () {
      var val = this.nextElementSibling;
      if (val) val.textContent = this.value;
      autoSave();
    });

    // Pan
    track.querySelector('.pan-slider').addEventListener('input', function () {
      var val = this.nextElementSibling;
      var v = parseInt(this.value);
      if (val) val.textContent = v === 0 ? 'C' : v > 0 ? v + 'R' : -v + 'L';
      autoSave();
    });

    // EQ sliders
    track.querySelectorAll('.eq-slider').forEach(function (s) {
      s.addEventListener('input', function () {
        var val = this.parentNode.querySelector('.eq-value');
        if (val) val.textContent = this.value;
        var band = this.dataset.band;
        var v = parseFloat(this.value);
        if (band === 'bass' && backingEqBass[id]) {
          backingEqBass[id].gain.value = v;
        } else if (band === 'mid' && backingEqMid[id]) {
          backingEqMid[id].gain.value = v;
        } else if (band === 'treble' && backingEqTreble[id]) {
          backingEqTreble[id].gain.value = v;
        }
        autoSave();
      });
    });

    // Actions
    track.querySelectorAll('.track-act-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = this.dataset.action;
        if (action === 'remove') {
          pushUndoState();
          track.remove();
          autoSave();
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

  // ─── Save / Load Session ───

  var saveTimeout = null;

  function autoSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveSession, 500);
  }

  function saveSession() {
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

  function loadSession() {
    var saved = localStorage.getItem('platoo_session');
    if (!saved) return;
    try {
      var data = JSON.parse(saved);
      if (data.trackCounter) trackCounter = data.trackCounter;
      if (data.tracks) {
        data.tracks.forEach(function (t) {
          addNewTrack(t.type, t);
        });
      }
    } catch (e) {
      // ignore corrupt data
    }
  }

  // ─── Instrument UI helpers ───

  function showInstrumentUI(type) {
    if (!backingAudioCtx || backingAudioCtx.state === 'closed') {
      backingAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    var sections = { piano: pianoSection, guitar: guitarSection, bass: bassSection, drums: drumsSection };
    var builders = { piano: buildPianoKeys, guitar: buildGuitarFretboard, bass: buildBassFretboard, drums: buildDrumsPads };
    if (sections[type]) {
      if (builders[type]) builders[type]();
      sections[type].hidden = false;
    }
  }

  function hideAllInstrumentUIs() {
    [pianoSection, guitarSection, bassSection, drumsSection].forEach(function (s) { if (s) s.hidden = true; });
    // Stop all oscillators
    Object.keys(activeOscillators).forEach(function (k) { try { activeOscillators[k].osc.stop(); } catch {} });
    activeOscillators = {};
  }

  // ─── Piano ───

  var noteMap = {
    'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
    'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.00,
    'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
  };
  var noteOrder = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function buildPianoKeys() {
    if (pianoKeysEl.children.length > 0) return;
    pianoKeysEl.innerHTML = '';
    for (var oct = 2; oct <= 5; oct++) {
      noteOrder.forEach(function (n) {
        var isBlack = n.indexOf('#') !== -1;
        var key = document.createElement('div');
        key.className = 'piano-key ' + (isBlack ? 'black' : 'white');
        var freq = noteMap[n] * Math.pow(2, oct - 4);
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

    // Build legend
    var legendItems = [];
    for (var k in keyboardNoteMap) {
      if (keyboardNoteMap.hasOwnProperty(k)) {
        legendItems.push({ key: k.toUpperCase(), note: keyboardNoteMap[k] });
      }
    }
    legendItems.sort(function (a, b) { return a.note < b.note ? -1 : a.note > b.note ? 1 : 0; });
    buildLegend('pianoLegend', legendItems);
  }

  document.getElementById('pianoCloseBtn').addEventListener('click', function () {
    pianoSection.hidden = true;
    Object.keys(activeOscillators).forEach(function (k) { try { activeOscillators[k].osc.stop(); } catch {} });
    activeOscillators = {};
  });

  function playInstNote(el) {
    try {
      var freq = parseFloat(el.dataset.freq);
      var note = el.dataset.note;
      if (activeOscillators[note]) return;
      if (!backingAudioCtx || backingAudioCtx.state === 'closed') {
        backingAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

  function stopInstNote(el) {
    var note = el.dataset.note;
    if (!activeOscillators[note]) return;
    try {
      activeOscillators[note].gain.gain.exponentialRampToValueAtTime(0.001, backingAudioCtx.currentTime + 0.1);
      setTimeout(function () { try { activeOscillators[note].osc.stop(); } catch {} }, 150);
    } catch {}
    el.classList.remove('active');
    delete activeOscillators[note];
  }

  // ─── Legend builder ───

  function buildLegend(elId, items) {
    var el = document.getElementById(elId);
    if (!el) return;
    var html = '';
    items.forEach(function (item) {
      html += '<span class="legend-item"><span class="legend-key">' + item.key + '</span><span class="legend-note">' + item.note + '</span></span>';
    });
    el.innerHTML = html;
  }

  // ─── Keyboard shortcuts for piano ───

  var keyboardNoteMap = {
    // Octave 3 (C3-B3) — lower row ZXCVBNM, black keys under left hand
    'z': 'C3', 's': 'C#3', 'x': 'D3', 'd': 'D#3', 'c': 'E3',
    'v': 'F3', 'g': 'F#3', 'b': 'G3', 'h': 'G#3', 'n': 'A3', 'j': 'A#3', 'm': 'B3',
    // Octave 4 (C4-B4) — home/top row QWERTYUI, number row for black keys
    'q': 'C4', '2': 'C#4', 'w': 'D4', '3': 'D#4', 'e': 'E4',
    'r': 'F4', '5': 'F#4', 't': 'G4', '6': 'G#4', 'y': 'A4', '7': 'A#4', 'u': 'B4'
  };

  // Build reverse map: note name -> keyboard key
  var noteToKeyboardKey = {};
  for (var k in keyboardNoteMap) {
    if (keyboardNoteMap.hasOwnProperty(k)) {
      noteToKeyboardKey[keyboardNoteMap[k]] = k.toUpperCase() + ':' + keyboardNoteMap[k];
    }
  }
  // Store just the key character for display
  var noteKeyDisplay = {};
  for (var k2 in keyboardNoteMap) {
    if (keyboardNoteMap.hasOwnProperty(k2)) {
      noteKeyDisplay[keyboardNoteMap[k2]] = k2.toUpperCase();
    }
  }

  var activeKeyboardNotes = {};

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

  // ─── Keyboard shortcuts for Guitar / Bass / Drums ───

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey) return;
    try {
    if (e.repeat) return;
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    var key = e.key.toLowerCase();

    // Guitar
    if (guitarSection && !guitarSection.hidden && guitarKeyboardMap[key]) {
      e.preventDefault();
      var m = guitarKeyboardMap[key];
      var el = findGuitarFretEl(m.strIdx, m.fret);
      if (el) { playGuitarNote(el); }
      return;
    }

    // Bass
    if (bassSection && !bassSection.hidden && bassKeyboardMap[key]) {
      e.preventDefault();
      var m2 = bassKeyboardMap[key];
      var el2 = findBassFretEl(m2.strIdx, m2.fret);
      if (el2) { playBassNote(el2); }
      return;
    }

    // Drums
    if (drumsSection && !drumsSection.hidden && drumsKeyToKey[key]) {
      e.preventDefault();
      var padKey = drumsKeyToKey[key];
      var pad = drumsPadsEl.querySelector('[data-kb-key="' + key + '"]');
      if (pad) { playDrum(pad); }
      return;
    }
    } catch (ex) { console.warn('inst key error:', ex); }
  });

  // ─── Guitar Fretboard ───

  var guitarStrings = [
    { name: 'E2', open: 82.41 },
    { name: 'A2', open: 110.00 },
    { name: 'D3', open: 146.83 },
    { name: 'G3', open: 196.00 },
    { name: 'B3', open: 246.94 },
    { name: 'E4', open: 329.63 }
  ];

  var guitarKeyboardMap = {
    // String 6 (E2): 1=open, Q=f1, A=f2, Z=f3
    '1': { strIdx: 0, fret: 0 }, 'q': { strIdx: 0, fret: 1 },
    'a': { strIdx: 0, fret: 2 }, 'z': { strIdx: 0, fret: 3 },
    // String 5 (A2): 2=open, W=f1, S=f2, X=f3
    '2': { strIdx: 1, fret: 0 }, 'w': { strIdx: 1, fret: 1 },
    's': { strIdx: 1, fret: 2 }, 'x': { strIdx: 1, fret: 3 },
    // String 4 (D3): 3=open, E=f1, D=f2, C=f3
    '3': { strIdx: 2, fret: 0 }, 'e': { strIdx: 2, fret: 1 },
    'd': { strIdx: 2, fret: 2 }, 'c': { strIdx: 2, fret: 3 },
    // String 3 (G3): 4=open, R=f1, F=f2, V=f3
    '4': { strIdx: 3, fret: 0 }, 'r': { strIdx: 3, fret: 1 },
    'f': { strIdx: 3, fret: 2 }, 'v': { strIdx: 3, fret: 3 },
    // String 2 (B3): 5=open, T=f1, G=f2, B=f3
    '5': { strIdx: 4, fret: 0 }, 't': { strIdx: 4, fret: 1 },
    'g': { strIdx: 4, fret: 2 }, 'b': { strIdx: 4, fret: 3 },
    // String 1 (E4): 6=open, Y=f1, H=f2, N=f3
    '6': { strIdx: 5, fret: 0 }, 'y': { strIdx: 5, fret: 1 },
    'h': { strIdx: 5, fret: 2 }, 'n': { strIdx: 5, fret: 3 }
  };
  var guitarKeyToNote = {}; // will be filled after build

  // Guitar chords: [string6..string1] fret numbers (-1 = muted/x)
  var guitarChords = [
    { name: 'C',  frets: [-1, 3, 2, 0, 1, 0] },
    { name: 'D',  frets: [-1, -1, 0, 2, 3, 2] },
    { name: 'E',  frets: [0, 2, 2, 1, 0, 0] },
    { name: 'F',  frets: [1, 3, 3, 2, 1, 1] },
    { name: 'G',  frets: [3, 2, 0, 0, 0, 3] },
    { name: 'A',  frets: [-1, 0, 2, 2, 2, 0] },
    { name: 'B',  frets: [-1, 2, 4, 4, 4, 2] },
    { name: 'Am', frets: [-1, 0, 2, 2, 1, 0] },
    { name: 'Dm', frets: [-1, -1, 0, 2, 3, 1] },
    { name: 'Em', frets: [0, 2, 2, 0, 0, 0] },
    { name: 'C7', frets: [-1, 3, 2, 3, 1, 0] },
    { name: 'G7', frets: [3, 2, 0, 0, 0, 1] },
    { name: 'A7', frets: [-1, 0, 2, 0, 2, 0] },
    { name: 'E7', frets: [0, 2, 0, 1, 0, 0] },
    { name: 'D7', frets: [-1, -1, 0, 2, 1, 2] }
  ];

  var activeGuitarChord = null;
  var strumDown = true;
  var strumDelay = 0.008;

  function buildGuitarChordBar() {
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

  function toggleGuitarChord(chord) {
    // Clear previous chord highlight
    clearGuitarChordHighlight();
    if (activeGuitarChord === chord) {
      activeGuitarChord = null;
      return;
    }
    activeGuitarChord = chord;
    // Highlight frets
    chord.frets.forEach(function (fret, si) {
      if (fret < 0) return;
      var el = findGuitarFretEl(si, fret);
      if (el) {
        el.classList.add('chord');
        el.style.background = '#5b8def';
        el.style.borderColor = '#5b8def';
      }
    });
    // Highlight button
    var bar = document.getElementById('guitarChordBar');
    if (bar) {
      var btns = bar.querySelectorAll('.chord-btn');
      btns.forEach(function (b) { b.classList.toggle('active', b.dataset.chord === chord.name); });
    }
    // Play chord
    playGuitarChord(chord);
  }

  function clearGuitarChordHighlight() {
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

  function playGuitarChord(chord) {
    if (!backingAudioCtx) return;
    var now = backingAudioCtx.currentTime;
    var maxIdx = chord.frets.length - 1;
    chord.frets.forEach(function (fret, si) {
      if (fret < 0) return;
      var str = guitarStrings[si];
      var freq = str.open * Math.pow(2, fret / 12);
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

  function buildGuitarFretboard() {
    if (guitarFretboardEl.querySelector('.fretboard')) return;
    var fb = document.createElement('div'); fb.className = 'fretboard';
    guitarKeyboardMap[' '] = null; // dummy
    guitarStrings.forEach(function (str, si) {
      var row = document.createElement('div'); row.className = 'fretboard-string';
      var label = document.createElement('span'); label.className = 'string-label'; label.textContent = str.name;
      row.appendChild(label);
      var line = document.createElement('div'); line.className = 'string-line';
      for (var f = 0; f <= 12; f++) {
        var fret = document.createElement('div'); fret.className = 'fret';
        var freq = str.open * Math.pow(2, f / 12);
        var noteName = str.name + ' f' + f;
        fret.dataset.freq = freq;
        fret.dataset.note = noteName;
        fret.dataset.strIdx = si;
        fret.dataset.fret = f;
        fret.style.left = (f * 28 + 14) + 'px';
        // Find keyboard key for this position
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
      // Add fret markers
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

    // Build legend
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

  function playGuitarNote(el) {
    try {
      if (!backingAudioCtx || backingAudioCtx.state === 'closed') {
        backingAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

  function findGuitarFretEl(strIdx, fret) {
    var fretEls = guitarFretboardEl.querySelectorAll('.fret');
    for (var i = 0; i < fretEls.length; i++) {
      if (parseInt(fretEls[i].dataset.strIdx) === strIdx && parseInt(fretEls[i].dataset.fret) === fret) {
        return fretEls[i];
      }
    }
    return null;
  }

  document.getElementById('guitarCloseBtn').addEventListener('click', function () {
    guitarSection.hidden = true;
  });

  // ─── Bass Fretboard ───

  var bassStrings = [
    { name: 'E1', open: 41.20 },
    { name: 'A1', open: 55.00 },
    { name: 'D2', open: 73.42 },
    { name: 'G2', open: 98.00 }
  ];

  var bassKeyboardMap = {
    // String 4 (G2): 1=open, Q=f1, A=f2, Z=f3
    '1': { strIdx: 0, fret: 0 }, 'q': { strIdx: 0, fret: 1 },
    'a': { strIdx: 0, fret: 2 }, 'z': { strIdx: 0, fret: 3 },
    // String 3 (D2): 2=open, W=f1, S=f2, X=f3
    '2': { strIdx: 1, fret: 0 }, 'w': { strIdx: 1, fret: 1 },
    's': { strIdx: 1, fret: 2 }, 'x': { strIdx: 1, fret: 3 },
    // String 2 (A1): 3=open, E=f1, D=f2, C=f3
    '3': { strIdx: 2, fret: 0 }, 'e': { strIdx: 2, fret: 1 },
    'd': { strIdx: 2, fret: 2 }, 'c': { strIdx: 2, fret: 3 },
    // String 1 (E1): 4=open, R=f1, F=f2, V=f3
    '4': { strIdx: 3, fret: 0 }, 'r': { strIdx: 3, fret: 1 },
    'f': { strIdx: 3, fret: 2 }, 'v': { strIdx: 3, fret: 3 }
  };
  var bassKeyToNote = {};

  function buildBassFretboard() {
    if (bassFretboardEl.querySelector('.fretboard')) return;
    var fb = document.createElement('div'); fb.className = 'fretboard';
    bassStrings.forEach(function (str, si) {
      var row = document.createElement('div'); row.className = 'fretboard-string';
      var label = document.createElement('span'); label.className = 'string-label'; label.textContent = str.name;
      row.appendChild(label);
      var line = document.createElement('div'); line.className = 'string-line';
      for (var f = 0; f <= 12; f++) {
        var fret = document.createElement('div'); fret.className = 'fret';
        var freq = str.open * Math.pow(2, f / 12);
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

    // Build legend
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

  // Bass power chords: [string4..string1]
  var bassChords = [
    { name: 'C',  frets: [-1, 3, 2, 0] },
    { name: 'D',  frets: [-1, -1, 0, 2] },
    { name: 'E',  frets: [0, 2, 1, 0] },
    { name: 'F',  frets: [1, 3, 3, 1] },
    { name: 'G',  frets: [3, 0, 0, 3] },
    { name: 'A',  frets: [-1, 0, 2, 0] },
    { name: 'B',  frets: [-1, 2, 4, 2] }
  ];

  var activeBassChord = null;

  var bassStrumDown = true;

  function buildBassChordBar() {
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

  function toggleBassChord(chord) {
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

  function clearBassChordHighlight() {
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

  function playBassChord(chord) {
    if (!backingAudioCtx) return;
    var now = backingAudioCtx.currentTime;
    var maxIdx = chord.frets.length - 1;
    chord.frets.forEach(function (fret, si) {
      if (fret < 0) return;
      var str = bassStrings[si];
      var freq = str.open * Math.pow(2, fret / 12);
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

  function playBassNote(el) {
    try {
      if (!backingAudioCtx || backingAudioCtx.state === 'closed') {
        backingAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

  function findBassFretEl(strIdx, fret) {
    var fretEls = bassFretboardEl.querySelectorAll('.fret');
    for (var i = 0; i < fretEls.length; i++) {
      if (parseInt(fretEls[i].dataset.strIdx) === strIdx && parseInt(fretEls[i].dataset.fret) === fret) {
        return fretEls[i];
      }
    }
    return null;
  }

  document.getElementById('bassCloseBtn').addEventListener('click', function () {
    bassSection.hidden = true;
  });

  // ─── Drums Pads ───

  var drumPads = [
    { name: 'Kick', key: 'kick', freq: 60, kbKey: 'a' },
    { name: 'Snare', key: 'snare', freq: 150, kbKey: 's' },
    { name: 'Hi-Hat', key: 'hihat', freq: 300, kbKey: 'd' },
    { name: 'Tom Hi', key: 'tomhi', freq: 200, kbKey: 'f' },
    { name: 'Tom Mid', key: 'tommid', freq: 160, kbKey: 'g' },
    { name: 'Tom Lo', key: 'tomlo', freq: 120, kbKey: 'h' },
    { name: 'Ride', key: 'ride', freq: 250, kbKey: 'j' },
    { name: 'Crash', key: 'crash', freq: 350, kbKey: 'k' },
    { name: 'Clap', key: 'clap', freq: 180, kbKey: 'l' }
  ];
  var drumsKeyToKey = {};

  function buildDrumsPads() {
    if (drumsPadsEl.children.length > 0) return;
    drumsPadsEl.innerHTML = '';
    drumPads.forEach(function (d) {
      var pad = document.createElement('div'); pad.className = 'drum-pad';
      pad.dataset.key = d.key;
      pad.dataset.freq = d.freq;
      pad.dataset.kbKey = d.kbKey;
      pad.style.background = getDrumPadColor(d.key);
      pad.innerHTML = '<span class="dp-icon">' + getDrumPadIcon(d.key) + '</span><span>' + d.name + '</span><span class="dp-kb-label">[' + d.kbKey.toUpperCase() + ']</span>';
      pad.addEventListener('mousedown', function (e) { e.preventDefault(); playDrum(this); });
      pad.addEventListener('touchstart', function (e) { e.preventDefault(); playDrum(this); });
      drumsPadsEl.appendChild(pad);
      drumsKeyToKey[d.kbKey] = d.key;
    });
    // Build legend
    var dLegendItems = [];
    drumPads.forEach(function (dp) {
      dLegendItems.push({ key: dp.kbKey.toUpperCase(), note: dp.name });
    });
    buildLegend('drumsLegend', dLegendItems);
  }

  function getDrumPadColor(key) {
    var colors = { kick: '#2a2a3a', snare: '#3a2a2a', hihat: '#2a3a2a', tomhi: '#2a2a3a', tommid: '#3a2a3a', tomlo: '#3a3a2a', ride: '#2a3a3a', crash: '#3a2a2a', clap: '#2a2a2a' };
    return colors[key] || '#222';
  }

  function getDrumPadIcon(key) {
    var icons = { kick: '⚫', snare: '⚪', hihat: '🔔', tomhi: '🔵', tommid: '🔵', tomlo: '🔵', ride: '🔔', crash: '✨', clap: '👏' };
    return icons[key] || '🔘';
  }

  function playDrum(el) {
    try {
    if (!backingAudioCtx || backingAudioCtx.state === 'closed') {
      backingAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (backingAudioCtx.state === 'suspended') backingAudioCtx.resume();
    var key = el.dataset.key;
    var freq = parseFloat(el.dataset.freq);
    el.classList.add('active');
    setTimeout(function () { el.classList.remove('active'); }, 100);

    if (key === 'hihat' || key === 'ride' || key === 'crash') {
      // Noise-based sounds (hihat, cymbal)
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
      // Tonal drum sounds
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
        // Add noise layer for snare
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

  document.getElementById('drumsCloseBtn').addEventListener('click', function () {
    drumsSection.hidden = true;
  });

  // ─── Trim helpers ───

  function trimTrackStart(id) {
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

  function trimTrackEnd(id) {
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

  // ─── Waveform click-to-seek (for existing tracks) ───
  backingTracklist.addEventListener('click', function (e) {
    var canvas = e.target.closest('.track-waveform');
    if (!canvas || !backingBuffer || !backingIsPlaying) return;
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var pct = x / canvas.width;
    var duration = backingBuffer.duration;
    backingStartOffset = pct * duration;
    // Restart from new position
    if (backingSource) {
      try { backingSource.stop(); } catch {}
      backingSource.disconnect();
    }
    startBacking();
  });

  // ─── Events ───

  selectFileBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    fileInput.click();
  });

  uploadZone.addEventListener('click', function () {
    fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    if (this.files && this.files[0]) {
      handleFile(this.files[0]);
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
      handleFile(e.dataTransfer.files[0]);
    }
  });

  // ─── Mobile Menu ───

  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('open');
  }

  menuToggle.addEventListener('click', function () {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('open');
  });

  sidebarOverlay.addEventListener('click', closeSidebar);

  document.getElementById('instList').addEventListener('click', function (e) {
    var btn = e.target.closest('.inst-btn');
    if (btn && window.innerWidth <= 768) closeSidebar();
  });
  document.querySelectorAll('.nav-item, #instBackBtn').forEach(function (el) {
    el.addEventListener('click', function () {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  // ─── Tab Navigation ───

  document.querySelectorAll('.nav-item').forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();

      document.querySelectorAll('.nav-item').forEach(function (nav) {
        nav.classList.remove('active');
      });
      this.classList.add('active');

      const tab = this.getAttribute('data-tab');
      document.querySelectorAll('.tab-content').forEach(function (tc) {
        tc.classList.remove('active');
      });
      document.getElementById('tab-' + tab).classList.add('active');
    });
  });

  // ─── Track Drag & Drop ───

  function initTrackDragDrop() {
    var dragState = null;

    backingTracklist.addEventListener('mousedown', onPointerDown);
    backingTracklist.addEventListener('touchstart', onPointerDown, { passive: true });

    function onPointerDown(e) {
      var header = e.target.closest('.backing-track-header');
      if (!header) return;
      var track = header.closest('.backing-track');
      if (!track) return;
      if (e.target.closest('button')) return;

      pushUndoState();

      var clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

      dragState = {
        track: track,
        startY: clientY
      };

      track.classList.add('dragging');

      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('mouseup', onPointerUp);
      document.addEventListener('touchmove', onPointerMove, { passive: false });
      document.addEventListener('touchend', onPointerUp);
    }

    function onPointerMove(e) {
      if (!dragState) return;
      e.preventDefault();

      var clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
      var tracks = backingTracklist.querySelectorAll('.backing-track:not(.dragging)');

      backingTracklist.querySelectorAll('.backing-track.drag-target').forEach(function (t) {
        t.classList.remove('drag-target');
      });

      var target = null;
      tracks.forEach(function (t) {
        var rect = t.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2 && !target) {
          target = t;
        }
      });

      if (target) {
        target.classList.add('drag-target');
      }
      dragState.target = target;
    }

    function onPointerUp() {
      if (!dragState) return;

      dragState.track.classList.remove('dragging');

      backingTracklist.querySelectorAll('.backing-track.drag-target').forEach(function (t) {
        t.classList.remove('drag-target');
      });

      if (dragState.target) {
        backingTracklist.insertBefore(dragState.track, dragState.target);
      }

      document.removeEventListener('mousemove', onPointerMove);
      document.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('touchmove', onPointerMove);
      document.removeEventListener('touchend', onPointerUp);

      dragState = null;
      autoSave();
    }
  }

  // ─── Init ───
  renderSongs();
  initInstruments();
  initTrackDragDrop();
  initMetronomeUI();

  // Wire undo/redo buttons
  var undoBtn = document.getElementById('undoBtn');
  var redoBtn = document.getElementById('redoBtn');
  if (undoBtn) undoBtn.addEventListener('click', undo);
  if (redoBtn) redoBtn.addEventListener('click', redo);
  updateUndoRedoButtons();

  // Ensure AudioContext ready on first user click
  var AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    try { backingAudioCtx = new AC(); } catch {}
  }

  function ensureAudioCtx() {
    if (!backingAudioCtx) {
      try { backingAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
    if (backingAudioCtx) {
      if (backingAudioCtx.state === 'suspended') {
        backingAudioCtx.resume()['catch'](function () {});
      }
      if (!masterGain) {
        masterGain = backingAudioCtx.createGain();
        masterGain.gain.value = 0.8;
        masterGain.connect(backingAudioCtx.destination);
      }
      // Keep trying while suspended (some browsers need repeated resume)
      var checkInterval = setInterval(function () {
        if (backingAudioCtx && backingAudioCtx.state === 'suspended') {
          backingAudioCtx.resume()['catch'](function () {});
        } else {
          clearInterval(checkInterval);
        }
      }, 2000);
    }
  }

  ensureAudioCtx();

  // Re-init on first user gesture
  document.addEventListener('click', ensureAudioCtx, { once: true });
  document.addEventListener('touchstart', ensureAudioCtx, { once: true });
  document.addEventListener('keydown', ensureAudioCtx, { once: true });

  // ─── Stem Separation API ───

  const STEM_API_BASE = 'http://localhost:8001';
  const stemAudioElements = {};

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

  // ─── Plan Mode Event Listeners ───
  document.getElementById('planBpmInput').addEventListener('input', function () {
    var v = parseInt(this.value) || 120;
    updateBPM(v);
  });

  document.getElementById('planBpmSlider').addEventListener('input', function () {
    updateBPM(parseInt(this.value));
  });

  document.getElementById('planTapBtn').addEventListener('click', tapTempo);

  document.getElementById('planMetronomeToggle').addEventListener('change', function () {
    metronomeEnabled = this.checked;
    var status = document.getElementById('planMetronomeStatus');
    if (status) status.textContent = metronomeEnabled ? 'เปิด' : 'ปิด';
    if (metronomeEnabled) {
      startMetronome();
    } else {
      stopMetronome();
    }
  });

  document.getElementById('planMetronomeVol').addEventListener('input', function () {
    metronomeVolume = parseInt(this.value) / 100;
    var valEl = document.getElementById('planMetronomeVolVal');
    if (valEl) valEl.textContent = this.value + '%';
  });

  document.getElementById('planLoopToggle').addEventListener('change', function () {
    toggleLoop();
  });

  document.getElementById('planLoopSetStart').addEventListener('click', setLoopStart);
  document.getElementById('planLoopSetEnd').addEventListener('click', setLoopEnd);

  document.getElementById('planSpeedSlider').addEventListener('input', function () {
    var v = parseInt(this.value);
    updateSpeed(v / 100);
  });

  document.getElementById('planPitchToggle').addEventListener('change', function () {
    pitchPreserve = this.checked;
  });

  document.getElementById('planStartBtn').addEventListener('click', startPractice);

  updateLoopDisplay();

  // ─── Keyboard Shortcuts Overlay ───

  var shortcutsModal = document.getElementById('shortcutsModal');
  var shortcutsCloseBtn = document.getElementById('shortcutsCloseBtn');

  function toggleShortcutsOverlay() {
    shortcutsModal.classList.toggle('open');
  }

  function openShortcutsOverlay() {
    shortcutsModal.classList.add('open');
  }

  function closeShortcutsOverlay() {
    shortcutsModal.classList.remove('open');
  }

  shortcutsCloseBtn.addEventListener('click', closeShortcutsOverlay);

  shortcutsModal.addEventListener('click', function (e) {
    if (e.target === shortcutsModal) closeShortcutsOverlay();
  });

  document.addEventListener('keydown', function (e) {
    var tag = e.target.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !e.repeat) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && !e.repeat) {
        e.preventDefault();
        redo();
        return;
      }
    }
    if (e.key === '?' && !e.repeat) {
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      openShortcutsOverlay();
      return;
    }
    if (e.key === 'Escape' && shortcutsModal.classList.contains('open')) {
      closeShortcutsOverlay();
    }
  });

  // Add help button to sidebar footer
  var sidebarFooter = document.querySelector('.sidebar-footer');
  if (sidebarFooter) {
    var helpBtn = document.createElement('button');
    helpBtn.className = 'help-btn';
    helpBtn.innerHTML = '&#63;';
    helpBtn.title = 'คีย์ลัด';
    helpBtn.addEventListener('click', openShortcutsOverlay);
    sidebarFooter.appendChild(helpBtn);
  }

  // ─── Error Boundary ───
  window.onerror = function (msg, url, line, col, err) {
    console.error('[PlatooPlayer Error]', msg, url, 'line ' + line + ':' + col, err);
    return false;
  };
  window.addEventListener('unhandledrejection', function (e) {
    console.error('[PlatooPlayer Unhandled Promise]', e.reason);
  });

})();
