// ─── platoo-player: Regression tests for the 2026-08-01 fixes ───
// Run: node tests/run.js

import { setup, makeBuffer } from './_stubs.js';

const { doc } = setup();
const State = await import('../js/state.js');

let passed = 0;
let failed = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push({ name, status: 'PASS' });
  } catch (e) {
    failed++;
    results.push({ name, status: 'FAIL', error: e.message });
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEq(actual, expected, msg) {
  if (actual !== expected) throw new Error(msg || `Expected "${expected}", got "${actual}"`);
}
function assertClose(actual, expected, tol, msg) {
  if (Math.abs(actual - expected) > tol) throw new Error(msg || `Expected ~${expected}, got ${actual}`);
}

const register = (id, tag) => doc.register(doc.createElement(tag), id);
const wait = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════
// 1. Global record buttons (regression fix)
// ═══════════════════════════════════════════════════

const recStartBtn = register('recordStartBtn', 'button');
const recStopBtn = register('recordStopBtn', 'button');
const micSelect = register('micSelect', 'select');
register('deviceName', 'span');
register('levelBar', 'div');
register('recordTimer', 'span');
register('metroIndicator', 'span');
register('bpmDisplay', 'span');
register('metroToggle', 'button');
register('bpmMinus', 'button');
register('bpmPlus', 'button');
const tracklist = register('backingTracklist', 'div');
register('recordingsList', 'div');
register('recCount', 'span');
register('undoBtn', 'button');
register('redoBtn', 'button');

const record = await import('../js/record.js');

record.init({
  addNewTrack: () => {},
  autoSave: () => {},
  ensureAudioCtx: () => {},
  playMetronomeClick: () => {}
});
navigator.mediaDevices._gumCalls.length = 0;

await (async () => {
  await test('mic: auto-requests the mic ~500ms after init (no click needed)', async () => {
    assertEq(recStartBtn.disabled, false, 'start btn is clickable at boot');
    assertEq(navigator.mediaDevices._gumCalls.length, 0, 'no gum call before timer');
    await wait(700);
    assert(navigator.mediaDevices._gumCalls.length >= 1, 'getUserMedia fired by auto-request');
    assertEq(recStartBtn.disabled, false, 'start btn still clickable after grant');
  });

  await test('record: click ⏺ requests mic then starts global recording', async () => {
    recStartBtn.dispatch('click');
    await wait(30);
    assertEq(State.isRecording, true, 'isRecording should become true');
    assertEq(recStartBtn.disabled, true, 'record start btn disabled while recording');
    assertEq(recStopBtn.disabled, false, 'record stop btn enabled while recording');
  });

  await test('record: click ⏹ stops and saves a recording entry', () => {
    recStopBtn.dispatch('click');
    assertEq(State.isRecording, false, 'isRecording should become false');
    assertEq(recStartBtn.disabled, false, 'record start btn re-enabled');
    assertEq(recStopBtn.disabled, true, 'record stop btn disabled after stop');
    assertEq(State.recordings.length, 1, 'one recording saved');
    assert(State.recordings[0].name.includes('บันทึก'), 'default name used');
  });

  await test('mic: dropdown disables while recording, re-enables after stop', async () => {
    recStartBtn.dispatch('click');
    await wait(30);
    assertEq(micSelect.disabled, true, 'mic select disabled while recording');
    recStopBtn.dispatch('click');
    assertEq(micSelect.disabled, false, 'mic select re-enabled after stop');
  });

  await test('mic: lists built-in and external mics from enumerateDevices', async () => {
    await record.refreshMicList();
    const ids = micSelect.children.map(o => o.value);
    assert(ids.includes('builtin-mic'), 'built-in mic listed');
    assert(ids.includes('usb-mic'), 'external mic listed');
    assertEq(micSelect.children[0].value, '', 'first option is system default');
  });

  await test('mic: switching selects the exact device for getUserMedia', async () => {
    navigator.mediaDevices._gumCalls.length = 0;
    const recCountBefore = State.recordings.length;
    micSelect.value = 'usb-mic';
    micSelect.dispatch('change');
    await wait(30);
    assertEq(State.isRecording, false, 'not recording after switch');
    assertEq(recStartBtn.disabled, false, 'start btn enabled after switch');
    const last = navigator.mediaDevices._gumCalls[navigator.mediaDevices._gumCalls.length - 1];
    assertEq(last.audio.deviceId.exact, 'usb-mic', 'getUserMedia requested exact usb-mic');
    assertEq(State.recordings.length, recCountBefore, 'no new recording created by switch');
    const devName = doc.getElementById('deviceName');
    assert(devName.textContent.includes('USB Microphone'), 'device label shown');
  });
})();

// ═══════════════════════════════════════════════════
// 2. Piano C6 frequency fix
// ═══════════════════════════════════════════════════

register('pianoSection', 'div');
const pianoKeys = register('pianoKeys', 'div');
register('guitarSection', 'div');
register('guitarFretboard', 'div');
register('bassSection', 'div');
register('bassFretboard', 'div');
register('drumsSection', 'div');
register('drumsPads', 'div');
register('pianoLegend', 'div');
register('guitarLegend', 'div');
register('bassLegend', 'div');
register('drumsLegend', 'div');
register('pianoCloseBtn', 'button');
register('guitarCloseBtn', 'button');
register('bassCloseBtn', 'button');
register('drumsCloseBtn', 'button');

const instruments = await import('../js/instruments.js');
instruments.initVirtualInstruments();
instruments.buildPianoKeys();

test('piano: C6 key frequency is 1046.5 Hz (was 523.25)', () => {
  const c6 = pianoKeys.children.find(k => k.dataset.note === 'C6');
  assert(c6, 'C6 key exists');
  assertEq(String(c6.dataset.freq), '1046.5');
});

test('piano: C5 key still 523.25 Hz', () => {
  const c5 = pianoKeys.children.find(k => k.dataset.note === 'C5');
  assert(c5, 'C5 key exists');
  assertEq(String(c5.dataset.freq), '523.25');
});

// ═══════════════════════════════════════════════════
// 3. Bounce mixdown gain compensation + EQ
// ═══════════════════════════════════════════════════

const audioEngine = await import('../js/audio-engine.js');
const liveCtx = new window.AudioContext();
State.setBackingAudioCtx(liveCtx);
State.setBackingBuffer(makeBuffer(2, 1000, 44100));
register('bounceBtn', 'button');
register('backingSelectBtn', 'button');
register('backingFileInput', 'input');
register('backingFilename', 'span');
register('backingPlayBtn', 'button');
register('backingPauseBtn', 'button');
register('backingStopBtn', 'button');

audioEngine.init({
  startMetronomeVisual: () => {},
  stopMetronomeVisual: () => {},
  pushUndoState: () => {},
  autoSave: () => {},
  addNewTrack: () => {},
  closeSidebar: () => {},
  updateBpmDisplay: () => {},
  startMetronome: () => {},
  stopMetronome: () => {}
});
audioEngine.initBackingTracks();

await test('bounce: 6 audible channels, each gain = 0.8/6 (no clipping)', async () => {
  globalThis._offlineContexts.length = 0;
  await audioEngine.bounceMixdown();
  const offline = globalThis._offlineContexts[0];
  assert(offline, 'OfflineAudioContext created');
  const gainNodes = offline.gains;
  assertEq(gainNodes.length, 6, 'one gain node per active channel');
  const sum = gainNodes.reduce((s, g) => s + g.gain.value, 0);
  assertClose(sum, 0.8, 1e-6, `total mix amplitude ≈ 0.8 (got ${sum})`);
  gainNodes.forEach(g => assertClose(g.gain.value, 0.8 / 6, 1e-6, 'each channel gain = 0.8/6'));
});

await test('bounce: soloing one channel keeps it at full volume', async () => {
  State.instState['vocal_solo'] = true;
  globalThis._offlineContexts.length = 0;
  await audioEngine.bounceMixdown();
  const offline = globalThis._offlineContexts[0];
  assertEq(offline.gains.length, 1, 'only soloed channel renders');
  assertClose(offline.gains[0].gain.value, 0.8, 1e-6, 'soloed channel gain = 0.8');
  delete State.instState['vocal_solo'];
});

await test('bounce: EQ filters are wired into the chain', async () => {
  globalThis._offlineContexts.length = 0;
  await audioEngine.bounceMixdown();
  const offline = globalThis._offlineContexts[0];
  const filters = offline.biquads || [];
  assertEq(filters.length, 18, '6 channels x 3 EQ bands (bass/mid/treble)');
  filters.forEach(f => assert(typeof f.frequency === 'object', 'biquad has frequency param'));
});

await test('bounce: renders the FULL song, not a loop range', async () => {
  State.setBackingBuffer(makeBuffer(2, 44100 * 10, 44100)); // 10s song
  globalThis._offlineContexts.length = 0;
  await audioEngine.bounceMixdown();
  const offline = globalThis._offlineContexts[0];
  assertEq(offline.length, 44100 * 10, 'offline context covers whole buffer (10s)');
  const src = offline.sources[0];
  assert(src, 'source created');
  assertEq(src.loop, false, 'no looping in bounce');
  assert(src.buffer, 'full backing buffer attached');
  assertEq(src.buffer.length, 44100 * 10, 'bounced audio = entire song');
});

await test('bounce: downloads mixdown.wav', async () => {
  globalThis._offlineContexts.length = 0;
  await audioEngine.bounceMixdown();
  const anchor = doc._anchors[doc._anchors.length - 1];
  assert(anchor, 'anchor element created');
  assertEq(anchor.download, 'mixdown.wav');
  assert(anchor._clicked, 'download clicked');
});

await test('transport: play/pause/stop cycle works without metronome', () => {
  State.setBackingBuffer(makeBuffer(2, 44100, 44100));
  audioEngine.startBacking();
  assertEq(State.backingIsPlaying, true, 'playing after start');
  assertEq(State.backingSource.playbackRate.value, 1, 'always plays at normal speed (1x)');
  audioEngine.pauseBacking();
  assertEq(State.backingIsPlaying, false, 'paused');
  audioEngine.startBacking();
  assertEq(State.backingIsPlaying, true, 'resumed after pause');
  audioEngine.stopBacking();
  assertEq(State.backingIsPlaying, false, 'stopped');
  const pb = doc.getElementById('backingPlayBtn');
  assertEq(pb.disabled, false, 'play btn re-enabled after stop');
  assertEq(doc.getElementById('backingPauseBtn').disabled, true, 'pause btn disabled after stop');
});

// ═══════════════════════════════════════════════════
// 4. Waveform bitmap cache (perf fix)
// ═══════════════════════════════════════════════════

test('waveform: offscreen bitmap cached, no re-render on second draw', () => {
  State.setBackingBuffer(makeBuffer(2, 44100, 44100));
  const canvas = doc.createElement('canvas');
  canvas.width = 400;
  canvas.height = 60;

  let created = 0;
  const origCreate = doc.createElement.bind(doc);
  doc.createElement = tag => { const el = origCreate(tag); if (tag === 'canvas') created++; return el; };
  try {
    audioEngine.drawWaveform('vocal', canvas);
    const first = created;
    audioEngine.drawWaveform('vocal', canvas);
    const second = created;
    assertEq(first, 1, 'first draw renders one offscreen bitmap');
    assertEq(second, first, 'second draw reuses cache (no new canvas)');
  } finally {
    doc.createElement = origCreate;
  }
});

test('waveform: cache invalidates when buffer changes', () => {
  const canvas = doc.createElement('canvas');
  canvas.width = 400;
  canvas.height = 60;
  State.setBackingBuffer(makeBuffer(2, 88200, 44100)); // different buffer
  let created = 0;
  const origCreate = doc.createElement.bind(doc);
  doc.createElement = tag => { const el = origCreate(tag); if (tag === 'canvas') created++; return el; };
  try {
    audioEngine.drawWaveform('vocal', canvas);
    assertEq(created, 1, 'new buffer triggers re-render');
  } finally {
    doc.createElement = origCreate;
  }
});

// ═══════════════════════════════════════════════════
// 5. Trim now actually cuts the backing buffer
// ═══════════════════════════════════════════════════

test('trim: trimTrackStart cuts 20% head of the shared buffer', () => {
  const buf = makeBuffer(2, 10000, 100);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < 10000; i++) d[i] = c * 10000 + i;
  }
  State.setBackingAudioCtx(new window.AudioContext());
  State.setBackingBuffer(buf);

  audioEngine.trimTrackStart('vocal');

  assertEq(State.backingBuffer.length, 8000, 'buffer length 10000 -> 8000');
  assertEq(State.backingBuffer.getChannelData(0)[0], buf.getChannelData(0)[2000], 'starts at old sample 2000');
  assertEq(State.backingBuffer.getChannelData(1)[0], buf.getChannelData(1)[2000], 'channel 2 aligned too');
  assertEq(State.backingStartOffset, 0, 'offset reset');
});

test('trim: trimTrackEnd keeps 80% of the buffer', () => {
  audioEngine.trimTrackEnd('vocal');
  assertEq(State.backingBuffer.length, 6400, '8000 -> 6400');
});

// ═══════════════════════════════════════════════════
// 6. XSS escaping on restored session tracks
// ═══════════════════════════════════════════════════

const addTrack = await import('../js/add-track.js');
register('addTrackBtn', 'button');
register('addTrackModal', 'div');
register('modalCloseBtn', 'button');
addTrack.initAddTrack({
  showInstrumentUI: () => {},
  pushUndoState: () => {},
  startTrackRecord: () => {},
  stopGlobalRecord: () => {},
  requestMic: () => Promise.resolve(),
  autoSave: () => {},
  drawRecordedWaveform: () => {},
  isRecording: () => false,
  recordingStream: () => null,
  currentRecTrackId: () => null
});

test('addNewTrack: restoreData name/icon are HTML-escaped', () => {
  addTrack.addNewTrack('piano', {
    id: 'track_1', type: 'piano',
    icon: '<img src=x onerror=alert(1)>',
    name: '<script>alert(1)</script>',
    volume: 80, pan: 0, eq_bass: 0, eq_mid: 0, eq_treble: 0,
    muted: false, solo: false
  });
  const track = tracklist.children[tracklist.children.length - 1];
  const html = track.innerHTML;
  assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'script tag escaped');
  assert(!html.includes('<script>'), 'no raw script tag');
  assert(html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'icon escaped');
  assert(!html.includes('<img'), 'no raw img tag');
});

// ═══════════════════════════════════════════════════
// 7. Song key state (originalKey / currentKey)
// ═══════════════════════════════════════════════════

const session = await import('../js/session.js');
session.initSession({ addNewTrackFn: () => {} });
const instrumentsMod = await import('../js/instruments.js');

await test('key: currentKey persisted in session and restored on load', () => {
  State.setCurrentKey('F# Minor');
  session.saveSession();
  const saved = JSON.parse(localStorage.getItem('platoo_session'));
  assertEq(saved.currentKey, 'F# Minor', 'currentKey saved in platoo_session');
  assertEq(saved.originalKey, '', 'originalKey saved (empty = not detected)');
  State.setCurrentKey('C Major');
  session.loadSession();
  assertEq(State.currentKey, 'F# Minor', 'currentKey restored after load');
  State.setOriginalKey('D Major');
  session.saveSession();
  session.loadSession();
  assertEq(State.originalKey, 'D Major', 'originalKey restored after load');
});

await test('key: virtual instruments shift pitch by semitone offset of currentKey', () => {
  State.setOriginalKey('C Major');
  State.setCurrentKey('D Major');

  const pianoKey = doc.createElement('div');
  pianoKey.dataset.freq = '440';
  pianoKey.dataset.note = 'C4';
  instrumentsMod.playInstNote(pianoKey);
  assertClose(State.activeOscillators['C4'].osc.frequency.value, 440 * Math.pow(2, 2 / 12), 0.01, 'piano A4 sounds +2 semitones');
  instrumentsMod.stopInstNote(pianoKey);

  const guitarFret = doc.createElement('div');
  guitarFret.dataset.freq = '110';
  instrumentsMod.playGuitarNote(guitarFret);
  const gOsc = State.backingAudioCtx.oscillators[State.backingAudioCtx.oscillators.length - 1];
  assertClose(gOsc.frequency.value, 110 * Math.pow(2, 2 / 12), 0.01, 'guitar A2 sounds +2 semitones');

  const bassFret = doc.createElement('div');
  bassFret.dataset.freq = '55';
  instrumentsMod.playBassNote(bassFret);
  const bOsc = State.backingAudioCtx.oscillators[State.backingAudioCtx.oscillators.length - 1];
  assertClose(bOsc.frequency.value, 55 * Math.pow(2, 2 / 12), 0.01, 'bass A1 sounds +2 semitones');

  State.setOriginalKey('');
  State.setCurrentKey('E Minor');
  pianoKey.dataset.freq = '440';
  pianoKey.dataset.note = 'C4';
  instrumentsMod.playInstNote(pianoKey);
  assertClose(State.activeOscillators['C4'].osc.frequency.value, 440 * Math.pow(2, 4 / 12), 0.01, 'unknown originalKey shifts relative to C');
  instrumentsMod.stopInstNote(pianoKey);

  State.setOriginalKey('');
  State.setCurrentKey('C Major');
});

// ═══════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════

console.log('\n═══════════════════════════════════');
console.log('  platoo-player Fix Regression Tests');
console.log('═══════════════════════════════════');
results.forEach(r => {
  const icon = r.status === 'PASS' ? '✓' : '✗';
  const color = r.status === 'PASS' ? '\x1b[32m' : '\x1b[31m';
  console.log(`  ${color}${icon}\x1b[0m ${r.name}`);
  if (r.error) console.log(`    \x1b[31m${r.error}\x1b[0m`);
});
console.log('───────────────────────────────────');
console.log(`  Total: ${passed + failed} | Pass: ${passed} | Fail: ${failed}`);
console.log('═══════════════════════════════════\n');
process.exit(failed > 0 ? 1 : 0);
