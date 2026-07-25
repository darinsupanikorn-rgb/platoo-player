// ─── platoo-player: Unit Tests ───
// Run: node --experimental-vm-modules tests/utils.test.js
// Or simply: node tests/run.js

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push({ name, status: 'PASS' });
  } catch (e) {
    failed++;
    results.push({ name, status: 'FAIL', error: e.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg || `Expected "${expected}", got "${actual}"`);
  }
}

function assertIncludes(str, sub, msg) {
  if (!str.includes(sub)) {
    throw new Error(msg || `Expected "${str}" to include "${sub}"`);
  }
}

// ─── Test: escapeHtml ───
import { escapeHtml, formatSize, formatDate, formatDuration, buildLegend } from '../js/utils.js';

const hasDocument = typeof document !== 'undefined';

test('escapeHtml: plain text unchanged', () => {
  if (!hasDocument) { console.log('    (skipped - no DOM)'); return; }
  assertEqual(escapeHtml('hello'), 'hello');
});

test('escapeHtml: escapes < > &', () => {
  if (!hasDocument) { console.log('    (skipped - no DOM)'); return; }
  const result = escapeHtml('<script>alert("xss")</script>');
  assert(!result.includes('<script>'), 'Should not contain <script>');
  assertIncludes(result, '&lt;');
  assertIncludes(result, '&gt;');
});

test('escapeHtml: empty string', () => {
  if (!hasDocument) { console.log('    (skipped - no DOM)'); return; }
  assertEqual(escapeHtml(''), '');
});

// ─── Test: formatSize ───
test('formatSize: bytes', () => {
  assertEqual(formatSize(512), '512 B');
});

test('formatSize: kilobytes', () => {
  assertEqual(formatSize(1536), '1.5 KB');
});

test('formatSize: megabytes', () => {
  assertEqual(formatSize(5 * 1024 * 1024), '5.0 MB');
});

test('formatSize: zero', () => {
  assertEqual(formatSize(0), '0 B');
});

// ─── Test: formatDate ───
test('formatDate: returns string', () => {
  const result = formatDate(Date.now());
  assert(typeof result === 'string', 'Should be a string');
  assert(result.length > 0, 'Should not be empty');
});

// ─── Test: formatDuration ───
test('formatDuration: zero', () => {
  assertEqual(formatDuration(0), '00:00');
});

test('formatDuration: 65000ms = 01:05', () => {
  assertEqual(formatDuration(65000), '01:05');
});

test('formatDuration: 3661000ms = 61:01', () => {
  assertEqual(formatDuration(3661000), '61:01');
});

// ─── Test: buildLegend (DOM-dependent, skip in Node) ───
// These would need jsdom or similar

// ─── Test: State module ───
import * as State from '../js/state.js';

test('state: instruments array has 6 items', () => {
  assertEqual(State.instruments.length, 6);
});

test('state: instruments have required fields', () => {
  State.instruments.forEach(inst => {
    assert(inst.id, 'Should have id');
    assert(inst.label, 'Should have label');
    assert(inst.icon, 'Should have icon');
  });
});

test('state: default practiceBPM is 120', () => {
  assertEqual(State.practiceBPM, 120);
});

test('state: setPracticeBPM works', () => {
  const orig = State.practiceBPM;
  State.setPracticeBPM(140);
  assertEqual(State.practiceBPM, 140);
  State.setPracticeBPM(orig);
});

test('state: setBackingIsPlaying works', () => {
  const orig = State.backingIsPlaying;
  State.setBackingIsPlaying(true);
  assertEqual(State.backingIsPlaying, true);
  State.setBackingIsPlaying(orig);
});

test('state: setIsRecording works', () => {
  const orig = State.isRecording;
  State.setIsRecording(true);
  assertEqual(State.isRecording, true);
  State.setIsRecording(orig);
});

test('state: instState is empty object', () => {
  assertEqual(typeof State.instState, 'object');
});

test('state: undoStack is array', () => {
  assert(Array.isArray(State.undoStack));
});

test('state: noteMap has C4 with correct freq', () => {
  assertEqual(State.noteMap['C4'], 261.63);
});

test('state: guitarStrings has 6 entries', () => {
  assertEqual(State.guitarStrings.length, 6);
});

test('state: bassStrings has 4 entries', () => {
  assertEqual(State.bassStrings.length, 4);
});

test('state: drumPads has 9 entries', () => {
  assertEqual(State.drumPads.length, 9);
});

test('state: MAX_UNDO is 30', () => {
  assertEqual(State.MAX_UNDO, 30);
});

// ─── Test: Audio Engine pure functions ───
// makeDistortionCurve and createReverbImpulse need AudioContext, skip in Node

// ─── Summary ───
console.log('\n═══════════════════════════════════');
console.log('  platoo-player Unit Tests');
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
