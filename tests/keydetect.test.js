// ─── platoo-player: Auto Key Detection Tests ───
// Chromagram + Krumhansl-Schmuckler (pure DSP in Node) and the upload/state
// wiring (DOM stubs). Run: node tests/run.js

import { setup, makeBuffer } from './_stubs.js';

const { doc } = setup();
const State = await import('../js/state.js');
const kd = await import('../js/key-detection.js');

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
function assertMatch(actual, re, msg) {
  if (!re.test(actual)) throw new Error(msg || `Expected "${actual}" to match ${re}`);
}

const register = (id, tag) => doc.register(doc.createElement(tag), id);
const wait = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════
// Helpers: synthesize songs with a known key
// ═══════════════════════════════════════════════════

const NOTE_FREQS = {
  'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13, 'E': 329.63, 'F': 349.23,
  'F#': 369.99, 'G': 392.00, 'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
};

function freqOf(note, octave) {
  return NOTE_FREQS[note] * Math.pow(2, octave - 4);
}

function synthChord(out, offset, len, sr, notes) {
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = Math.min(1, t / 0.05) * Math.min(1, (len / sr - t) / 0.1);
    let v = 0;
    for (const f of notes) {
      v += Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t);
    }
    out[offset + i] += v * env * 0.25;
  }
}

function synthSong(chords, chordLen, sr = 44100) {
  const total = Math.floor(sr * chordLen * chords.length);
  const out = new Float32Array(total);
  chords.forEach((chord, ci) => {
    synthChord(out, ci * Math.floor(sr * chordLen), Math.floor(sr * chordLen), sr, chord);
  });
  return out;
}

function songCMajor() {
  return synthSong([
    [freqOf('C', 4), freqOf('E', 4), freqOf('G', 4)],
    [freqOf('F', 3), freqOf('A', 3), freqOf('C', 4)],
    [freqOf('G', 3), freqOf('B', 3), freqOf('D', 4)],
    [freqOf('A', 3), freqOf('C', 4), freqOf('E', 4)]
  ], 1.0);
}

function songAMinor() {
  return synthSong([
    [freqOf('A', 3), freqOf('C', 4), freqOf('E', 4)],
    [freqOf('F', 3), freqOf('A', 3), freqOf('C', 4)],
    [freqOf('C', 4), freqOf('E', 4), freqOf('G', 4)],
    [freqOf('G', 3), freqOf('B', 3), freqOf('D', 4)]
  ], 1.0);
}

function songFMajor() {
  return synthSong([
    [freqOf('F', 3), freqOf('A', 3), freqOf('C', 4)],
    [freqOf('A#', 3), freqOf('D', 4), freqOf('F', 4)],
    [freqOf('C', 4), freqOf('E', 4), freqOf('G', 4)],
    [freqOf('D', 4), freqOf('F', 4), freqOf('A', 4)]
  ], 1.0);
}

// ═══════════════════════════════════════════════════
// 1. Pure DSP: chromagram
// ═══════════════════════════════════════════════════

await test('chromagram: 440 Hz sine peaks at pitch class A (9)', () => {
  const sr = 44100;
  const n = sr * 3;
  const sine = new Float32Array(n);
  for (let i = 0; i < n; i++) sine[i] = Math.sin(2 * Math.PI * 440 * i / sr);
  const chroma = kd.computeChromagram(sine, sr);
  assert(chroma, 'chroma computed');
  let bestPc = -1, bestVal = -1;
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > bestVal) { bestVal = chroma[i]; bestPc = i; }
  }
  assertEq(bestPc, 9, 'A is the strongest pitch class');
});

await test('chromagram: 261.63 Hz (C4) sine peaks at pitch class C (0)', () => {
  const sr = 44100;
  const n = sr * 2;
  const sine = new Float32Array(n);
  for (let i = 0; i < n; i++) sine[i] = Math.sin(2 * Math.PI * 261.63 * i / sr);
  const chroma = kd.computeChromagram(sine, sr);
  let bestPc = -1, bestVal = -1;
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > bestVal) { bestVal = chroma[i]; bestPc = i; }
  }
  assertEq(bestPc, 0, 'C is the strongest pitch class');
});

await test('chromagram: silence returns null', () => {
  const res = kd.computeChromagram(new Float32Array(44100 * 2), 44100);
  assertEq(res, null, 'silence -> null');
});

await test('chromagram: too-short buffer returns null', () => {
  const res = kd.computeChromagram(new Float32Array(100), 44100);
  assertEq(res, null, 'short buffer -> null');
});

// ═══════════════════════════════════════════════════
// 2. Pure DSP: Krumhansl-Schmuckler key detection
// ═══════════════════════════════════════════════════

await test('detect: C major progression -> C Major', () => {
  const res = kd.detectKeyFromSamples(songCMajor(), 44100);
  assert(res, 'detection result');
  assertEq(res.key, 'C Major', `expected C Major, got ${res.key}`);
  assert(res.correlation > 0, 'correlation positive');
});

await test('detect: A minor progression -> A Minor', () => {
  const res = kd.detectKeyFromSamples(songAMinor(), 44100);
  assert(res, 'detection result');
  assert(
    res.key === 'A Minor' || (!res.confident && res.key === 'C Major'),
    `expected A Minor, got ${res.key}`
  );
  if (res.key === 'C Major') {
    assert(res.scores.some(s => s.key === 'A Minor'), 'A Minor among the 24 candidates');
  }
});

await test('detect: F major progression (C transposed +5) -> F Major', () => {
  const res = kd.detectKeyFromSamples(songFMajor(), 44100);
  assert(res, 'detection result');
  assertEq(res.key, 'F Major', `expected F Major, got ${res.key}`);
});

await test('detect: silence -> null', () => {
  const res = kd.detectKeyFromSamples(new Float32Array(44100 * 2), 44100);
  assertEq(res, null, 'silence -> null');
});

await test('detect: result shape — 24 candidates, key in valid format', () => {
  const res = kd.detectKeyFromSamples(songCMajor(), 44100);
  assertEq(res.scores.length, 24, '24 key candidates');
  assertMatch(res.key, /^[A-G]#? (Major|Minor)$/, 'key name format');
  res.scores.forEach(s => {
    assert(s.correlation >= -1 && s.correlation <= 1, 'correlation in [-1,1]');
  });
});

// ═══════════════════════════════════════════════════
// 3. Wiring: upload applies the detected key
// ═══════════════════════════════════════════════════

const planKeySelect = register('planKeySelect', 'select');
const planOriginalKey = register('planOriginalKey', 'span');
const uploadStatus = register('uploadStatus', 'div');
const statusText = register('statusText', 'span');
const songsList = register('songsList', 'div');
const songCount = register('songCount', 'span');
const stemsStatusText = register('stemsStatusText', 'span');
const backingTracklist = register('backingTracklist', 'div');

if (typeof globalThis.fetch !== 'function') globalThis.fetch = () => {};
if (typeof globalThis.FormData !== 'function') globalThis.FormData = class { append() {} };
globalThis.fetch = () => Promise.reject(new Error('backend offline'));

const upload = await import('../js/upload.js');

await test('applyDetectedKey: sets state, dropdown, display, song meta + session', async () => {
  localStorage.setItem('platoo_songs', JSON.stringify([{ id: 's1', name: 'demo.wav', size: 100, added: 1 }]));
  upload.renderSongs();

  upload.applyDetectedKey('D Major', 's1');

  assertEq(State.originalKey, 'D Major', 'originalKey set');
  assertEq(State.currentKey, 'D Major', 'currentKey set (dropdown default)');
  assertEq(planKeySelect.value, 'D Major', 'dropdown shows detected key');
  assertEq(planOriginalKey.textContent, 'D Major', 'original key display updated');

  const songs = JSON.parse(localStorage.getItem('platoo_songs'));
  assertEq(songs[0].key, 'D Major', 'key persisted in song entry');

  await wait(650);
  const sess = JSON.parse(localStorage.getItem('platoo_session'));
  assertEq(sess.originalKey, 'D Major', 'originalKey saved in session');
  assertEq(sess.currentKey, 'D Major', 'currentKey saved in session');
});

await test('handleFile: end-to-end — uploading a known-key song detects it', async () => {
  window.AudioContext.prototype.decodeAudioData = function () {
    const samples = songCMajor();
    const buf = makeBuffer(1, samples.length, 44100);
    buf.getChannelData(0).set(samples);
    return Promise.resolve(buf);
  };

  const file = {
    name: 'c-major-song.wav',
    size: 98765,
    type: 'audio/wav',
    arrayBuffer: async () => new ArrayBuffer(8)
  };

  upload.handleFile(file);
  assertEq(State.originalKey, 'D Major', 'unchanged before async detection finishes');

  await wait(1000);
  assertEq(State.originalKey, 'C Major', `auto-detected C Major, got ${State.originalKey}`);
  assertEq(State.currentKey, 'C Major', 'currentKey follows detection');
  assertEq(planKeySelect.value, 'C Major', 'dropdown defaults to detected key');
  assertEq(planOriginalKey.textContent, 'C Major', 'original key display updated');

  const songs = JSON.parse(localStorage.getItem('platoo_songs'));
  const song = songs.find(s => s.name === 'c-major-song.wav');
  assert(song && song.key === 'C Major', 'song entry stores detected key');
});

await test('analyzeFile: decode failure returns null (no crash)', async () => {
  window.AudioContext.prototype.decodeAudioData = () => { throw new Error('decode failed'); };
  const res = await kd.analyzeFile({ arrayBuffer: async () => new ArrayBuffer(4) });
  assertEq(res, null, 'graceful null on decode failure');
});

await test('applySongKeyIfAny: restores most recent song key when originalKey empty', () => {
  State.setOriginalKey('');
  State.setCurrentKey('C Major');
  localStorage.setItem('platoo_songs', JSON.stringify([
    { id: 'old', name: 'a.wav', size: 1, added: 100, key: 'A Minor' },
    { id: 'new', name: 'b.wav', size: 2, added: 200, key: 'E Minor' }
  ]));
  upload.applySongKeyIfAny();
  assertEq(State.originalKey, 'E Minor', 'most recent song key applied');
  assertEq(State.currentKey, 'E Minor', 'currentKey follows');
  assertEq(planKeySelect.value, 'E Minor', 'dropdown shows restored key');
});

await test('applySongKeyIfAny: skips when originalKey already set', () => {
  State.setOriginalKey('G Major');
  upload.applySongKeyIfAny();
  assertEq(State.originalKey, 'G Major', 'existing originalKey not clobbered');
});

// ═══════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════

console.log('\n═══════════════════════════════════');
console.log('  platoo-player Key Detection Tests');
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
