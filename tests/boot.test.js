// ─── platoo-player: Full-app boot smoke test ───
// Stubs the whole DOM from index.html ids, then imports app.js to verify
// the real module wiring runs end-to-end without throwing.
// Run: node tests/run.js

import { readFileSync } from 'fs';
import { setup, registerIdsFromHtml } from './_stubs.js';
import * as State from '../js/state.js';

const { doc } = setup();

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');
registerIdsFromHtml(doc, html);

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
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEq(a, b, msg) { if (a !== b) throw new Error(msg || `Expected "${b}", got "${a}"`); }

let bootError = null;
try {
  await import('../js/app.js');
} catch (e) {
  bootError = e;
}

test('boot: app.js module graph loads without throwing', () => {
  if (bootError) throw bootError;
});

test('boot: window._platoo global exposed', () => {
  assert(window._platoo, '_platoo should exist');
  assert(typeof window._platoo.ensureAudioCtx === 'function', 'ensureAudioCtx exposed');
  assert(typeof window._platoo.addNewTrack === 'function', 'addNewTrack exposed');
});

test('boot: 6 fixed backing tracks rendered', () => {
  const list = doc.getElementById('backingTracklist');
  assert(list, 'backingTracklist exists');
  assertEq(list.children.length, 6, '6 instrument tracks');
});

test('boot: piano keys start empty (built lazily on instrument open)', () => {
  const keys = doc.getElementById('pianoKeys');
  assert(keys, 'pianoKeys exists');
  assertEq(keys.children.length, 0, 'no keys until modal opens');
});

test('boot: song list renders empty state', () => {
  const list = doc.getElementById('songsList');
  assert(list, 'songsList exists');
  assertEq(list.children.length, 1, 'empty-state placeholder rendered');
  assertEq(list.children[0].className.includes('empty'), true, 'empty-state element');
});

test('boot: record start button is clickable at boot (mic requested on demand)', () => {
  const btn = doc.getElementById('recordStartBtn');
  assert(btn, 'recordStartBtn exists');
  assertEq(btn.disabled, false);
});

test('boot: plan mode metronome/loop/speed UI removed, BPM + start intact', () => {
  assertEq(doc.getElementById('planMetronomeToggle'), null, 'metronome toggle removed');
  assertEq(doc.getElementById('planMetronomeVol'), null, 'metronome volume removed');
  assertEq(doc.getElementById('planLoopToggle'), null, 'loop toggle removed');
  assertEq(doc.getElementById('planLoopSetStart'), null, 'loop start button removed');
  assertEq(doc.getElementById('planLoopSetEnd'), null, 'loop end button removed');
  assertEq(doc.getElementById('planSpeedSlider'), null, 'speed slider removed');
  assertEq(doc.getElementById('planSpeedVal'), null, 'speed value removed');
  assertEq(doc.getElementById('planPitchToggle'), null, 'pitch preserve toggle removed');
  assert(doc.getElementById('planBpmInput'), 'BPM input still present');
  assert(doc.getElementById('planTapBtn'), 'tap tempo still present');
  assert(doc.getElementById('planStartBtn'), 'start practice still present');
});

test('boot: key section renders with 24 options, selection updates state', () => {
  const orig = doc.getElementById('planOriginalKey');
  assert(orig, 'original key label exists');
  assert(html.includes('planOriginalKey">&mdash;</span>'), 'placeholder (—) in markup before auto-detect');
  const sel = doc.getElementById('planKeySelect');
  assert(sel, 'key select exists');
  assertEq(sel.children.length, 24, '12 keys x Major/Minor');
  assertEq(sel.children[0].value, 'C Major', 'first option is C Major');
  assertEq(sel.children[23].value, 'B Minor', 'last option is B Minor');
  assertEq(sel.value, 'C Major', 'defaults to C Major');
  sel.value = 'F# Minor';
  sel.dispatch('change');
  assertEq(State.currentKey, 'F# Minor', 'state follows dropdown selection');
});

console.log('\n═══════════════════════════════════');
console.log('  platoo-player Boot Smoke Test');
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
