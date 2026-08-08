# Platoo Player — AGENTS.md

## Project Overview
Thai-language web-based DAW-style music app: upload songs, multi-track recording, virtual instruments (piano/guitar/bass/drums), mixer/EQ/FX, Plan Mode (BPM + key selection + transpose), export mixdown. Vanilla ES modules, no build step, no external deps.

## Commands
```powershell
node tests/run.js                          # full test suite (runs every *.test.js, prints per-file + grand total)
node tests/fixes.test.js                   # single test file (boot / fixes / utils work the same way)
node --check js/xxx.js                     # syntax check (no linter/typecheck exists)
python -m uvicorn main:app --port 8001     # backend (run from backend/); demucs subprocess does the heavy lifting
```
- There is **no lint/typecheck step — `node tests/run.js` is the only automated verification**. Always run it after changes. Current count: **70/70** (boot 8, fixes 21, keydetect 14, utils 27) — update this when adding tests.
- Serving is required: `index.html` loads `js/` as ES modules (`type="module"`), so `file://` will not work. The dev server used in these sessions: `node C:\Users\Lenovo\AppData\Local\Temp\opencode\platoo-server.js` → http://localhost:8123 (a plain static server; python works identically).
- Backend restart wipes in-flight jobs (they live in RAM, not disk).

## Module Map (read these before editing)
- `js/app.js` (153 lines) — **entry point / wiring only**. Calls `initX({ deps })` for every module (dependency-injection pattern), exposes `window._platoo`. Boot tests import it to prove the whole module graph loads.
- `js/state.js` — **single source of truth**. All shared state is exported as `let` bindings + `set*()` setters (e.g. `practiceBPM`, `originalKey`, `currentKey`, `backingAudioCtx`, `activeOscillators`, `instState`). Add new state here first; read via imported live binding at call time (works because ES module bindings stay live).
- `js/audio-engine.js` — backing transport (`startBacking`/`pauseBacking`/`stopBacking`), `bounceMixdown` (OfflineAudioContext), trim (ตัดหัว/ตัดท้าย), `tapTempo`, `updateBPM`, `playMetronomeClick`, `startPractice`.
- `js/record.js` — mic handling (`requestMic(deviceId)` uses `deviceId: { exact }`, `switchMic`, `refreshMicList`), global + per-track recording, record-bar metronome visuals.
- `js/instruments.js` — builders (`buildPianoKeys`, `buildGuitarFretboard`, `buildBassFretboard`, `buildDrumsPads`) + play functions. All pitched instruments read `el.dataset.freq` and set `osc.frequency.value` via the shared `playFreq()` helper, which applies transpose (`semitoneOffsetOf`/`applySemitoneOffset` from `utils.js`). **Drums are percussion — never transposed.**
- `js/session.js` — `saveSession`/`loadSession` on `localStorage['platoo_session']` with shape `{ tracks, trackCounter, originalKey, currentKey }`; loaded data goes through `addNewTrack` (which HTML-escapes name/icon — keep that escaping when touching restore).
- `js/song-store.js` — **IndexedDB blob store** (`platoo_songs_db` → `blobs` keyed by song id). Dashboard uploads keep the real audio here (`saveSongBlob`); `audio-engine.js` `loadSongFromLibrary(songId)` pulls it back into `backingBuffer` so the same file works in mixer / plan mode / record without re-uploading. `removeSongBlob` on song delete. No-op when IndexedDB unavailable.
- `js/plan-mode.js` — BPM input/slider/tap + key section (`populateKeySelect`, change listener → `setCurrentKey` + console.log). Other modules: `add-track.js`, `upload.js`, `ui.js`.
- `js/key-detection.js` — key auto-detect (`analyzeFile(file)` = browser decode path; pure chromagram/detect functions are Node-testable). Wired in `upload.js`: `analyzeFile().then(applyDetectedKey)` per upload; `applySongKeyIfAny` restores the most recent song's key on load. Low-confidence detection falls back to C Major.
- `js/utils.js` — pure helpers shared by all modules: `escapeHtml`, `formatSize`/`formatDate`/`formatDuration`, key math (`keyNameToPitchClass`, `semitoneOffsetOf`, `applySemitoneOffset`). Node-testable (no DOM).
- `js/app.original.js` — **DEAD legacy copy** (the pre-refactor single-file IIFE). It still contains old versions of everything and is loaded by nothing. Grep hits inside it are false leads; never edit it.

## Tests (quirks you WILL trip on)
- `tests/_stubs.js` — `setup()` installs DOM/WebAudio stubs globally (DocStub, ElementStub, AudioContextStub, `navigator.mediaDevices`, localStorage, MediaRecorder). The stubs implement only what the app uses (`dataset`, `classList`, `listeners`, `querySelector[All]`, `innerHTML` parse, `style` object).
- `boot.test.js` uses `registerIdsFromHtml` — **every `id` in `index.html` is auto-registered with its real tag/attrs**, so new UI ids need no manual registration there. `fixes.test.js` has no such helper: register manually with `register(id, tag)`.
- **fixes.test.js `test()` is `async`; boot/utils `test()` are sync.** In fixes.test.js, top-level test calls after the last `await` must be written `await test(...)` — an un-awaited call's result is pushed in a microtask and silently lost when the trailing `process.exit()` kills the process (tests appear to "not run" while counts drop by one).
- Assert real oscillator frequencies: AudioContextStub records every created oscillator — check `State.activeOscillators[note].osc.frequency.value` (piano) or `State.backingAudioCtx.oscillators[last].frequency.value` (guitar/bass).
- `navigator.mediaDevices._gumCalls` records every `getUserMedia` call; `enumerateDevices` returns `builtin-mic`/`usb-mic`.
- utils/fixes use different assert helpers (`assertEqual`/`assertIncludes` vs `assertEq`/`assertClose`).

## Conventions
- Thai UI text, English code. Existing comments are Thai — match them when editing those spots.
- IDs camelCase (`planKeySelect`), classes kebab-case (`backing-track`), dark theme (`#111`, `#ccc`).
- `README.md` is **outdated** (describes IIFE, Loop, Speed, Pitch-preserve — all removed). AGENTS.md is the source of truth.

## Features (All Completed)
| # | Feature | Details |
|---|---------|---------|
| 1 | Dashboard + Upload | Upload MP3/WAV/M4A, list songs, remove, localStorage persistence (metadata) + IndexedDB blobs (`song-store.js`) |
| 2 | Sidebar + Navigation | Logo, 3 tabs (Dashboard, Plan Mode, Record), Instrument list |
| 3 | Instrument Detail | Vocal → lyrics textarea; others → notation editor |
| 4 | Record Bar | Device name, mic dropdown, timer, level meter, ⏺/⏹ buttons |
| 5 | Backing Track Mixer | 6 fixed instruments (Vocal/Drums/Bass/Guitar/Piano/Other) + Volume/Pan/EQ/Mute/Solo/Waveform canvas + Playhead |
| 6 | Add Track Modal | 5 types (audio/piano/guitar/bass/drums) with color-coded borders |
| 7 | Piano Keyboard | 2-4 octaves + C6, triangle wave, mouse/touch/keyboard |
| 8 | Guitar Fretboard | 6 strings × 13 frets, sawtooth, fret markers, keyboard shortcuts |
| 9 | Bass Fretboard | 4 strings × 13 frets, sine wave, fret markers, keyboard shortcuts |
| 10 | Drums Pads | 9 pads (Kick/Snare/Hi-Hat/Tom×3/Ride/Crash/Clap), sine+noise+filters |
| 11 | Keyboard Shortcuts | Piano (ZXCVBNM+QWERTYUI+number), Guitar (1-6+QWERTY...), Bass (1-4+QWERTY...), Drums (ASDFGHJKL) |
| 12 | Legend ปุ่มลัด | `.inst-ui-legend` with `buildLegend()` per instrument |
| 13 | Per-track Recording | R button → mic → MediaRecorder → blob → recorded waveform (red) |
| 14 | Real-time Waveform | `AnalyserNode.getByteTimeDomainData()` on canvas during recording |
| 15 | AudioContext Init | Auto-resume every 2s if suspended; init on click/touch/keydown |
| 16 | Guitar/Bass Chords | Guitar: 15 chords (C/D/E/F/G/A/B/Am/Dm/Em/C7/G7/A7/E7/D7) with strum delay |
| 17 | Bass Power Chords | 7 chords (root+fifth+octave) with strum delay |
| 18 | Strumming Effect | 8ms delay per string, ↓/↑ direction toggle, fret highlight order |
| 19 | Save/Load Session | `platoo_session` in localStorage with all track configs |
| 20 | Export Mixdown (Bounce) | OfflineAudioContext → encodeWAV() → download mixdown.wav |
| 21 | Plan Mode | BPM slider + tap tempo; **คีย์เพลง section**: คีย์ต้นฉบับ + dropdown เปลี่ยนคีย์ 24 ตัว (12 คีย์ × Major/Minor), auto-detect on upload (`analyzeFile`/`applyDetectedKey`, low-confidence → C Major), saves `originalKey`/`currentKey` in session; **transpose ใช้ได้กับเครื่องดนตรีเสมือนแล้ว** — semitone offset = currentKey − originalKey (wrap ใกล้สุด, `semitoneOffsetOf` ใน utils.js), shift frequency ตอนเล่นจริง (เปียโน/กีตาร์/เบส + chord strum) ผ่าน `applySemitoneOffset`, กลองไม่ transpose (เพอร์คัชชัน) |
| 22 | Visual Metronome | Flashing LED (blue on beat 1, gray on 2-4) in record bar; BPM +/- 5 |
| 23 | Click Track Toggle | 🔇/🔊 toggle in record bar; shared BPM with Plan Mode |
| 24 | Keyboard Shortcut Overlay | Press `?` to show all shortcuts in a modal |
| 25 | Undo/Redo | Snapshot-based, 30 steps, Ctrl+Z/Ctrl+Shift+Z+Y, buttons ↩/↪ |
| 26 | Instrument Effects | Per-track FX button → panel with Reverb/Delay/Distortion sliders |
| 27 | Audio Rewire | Fixed instruments changed from serial to parallel routing + MasterGain |
| 28 | Stem → Mixer (เมื่อ backend พร้อม) | หลังแยกเสียงเสร็จ `loadStemsForMixer()` fetch+decode stem wav (vocals/drums/bass/guitar/piano/other — 6 สายจาก `htdemucs_6s`; channel id `vocal` ↔ ชื่อไฟล์ `vocals`) ลง `stemBuffers` (state.js) แล้ว `startBacking()`/`bounceMixdown()`/trim จะเล่น stem ต่อแทร็ก (Vocal/Guitar/Bass/Drums/Piano/Other ตรงกัน 1:1) แทนทุกช่องเล่นไฟล์เดียวกัน; `stemsSongId` กันการลบ stems ตอนเลือกเพลงเดิมซ้ำจากคลัง; waveform ต่อแทร็กแสดงจาก stem ของตัวเอง; ถ้า backend ไม่ออนไลน์ fallback กลับเป็นไฟล์เต็มเหมือนเดิม |

## Bugs Fixed (2026-07-18)
1. **`initBackingTracks()` wiping user tracks** — Called when clicking instrument play button and when loading backing track; replaced with `createBackingGains()` + canvas redraw (preserves user-added tracks)
2. **`trackCounter` reset after `loadSession()`** — `var trackCounter = 0` moved before `loadSession()` to prevent overwrite of restored counter

## Bugs Fixed (2026-08-01)
1. **Global record buttons (⏺/⏹) no-op after module refactor** — Click listeners for `#recordStartBtn`/`#recordStopBtn` were lost in the IIFE → ES-module split; rewired in `record.js init()`. Clicking ⏺ without mic now requests the mic first (`requestMic().then(startGlobalRecord)`)
2. **Piano C6 key played 523.25 Hz (C5)** — Hardcoded `523.25` replaced with `1046.50` in `buildPianoKeys()`
3. **Bounce mixdown clipped (~4.8x amplitude)** — All 6 mixer channels played the same buffer simultaneously; added `1/activeCount` gain compensation + real 3-band EQ BiquadFilters per channel in the OfflineAudioContext chain
4. **Playback stutter / heavy CPU during playhead animation** — `updatePlayhead()` re-rendered full waveform from raw samples every frame; waveforms are now rendered once to an offscreen bitmap cache (`waveCache`, invalidated on buffer change) and blitted per frame
5. **Trim buttons (ตัดหัว/ตัดท้าย) were cosmetic** — Only redrew a canvas using the shared `backingBuffer` without modifying audio; now actually creates a trimmed AudioBuffer (cut 20% head / keep 80% tail), updates all waveforms, clamps loop points, and stops playback. Duplicated trim code removed from `add-track.js` (single implementation in `audio-engine.js`)
6. **`deviceName` showed literal `&#127897;` text** — HTML entity assigned via `textContent`; replaced with real Unicode
7. **`startTrackRecord` before mic grant silently did nothing** — Now chains `requestMic().then(...)` and starts the track recording after permission
8. **AudioContext / objectURL leaks** — `drawRecordedWaveform()` created a new AudioContext per call and never revoked an unused objectURL; now reuses one lazy `decoderCtx` and dropped the objectURL
9. **Dead code removed** — `startBackingLevelMeter` (fake sine meter, never wired), `hideAllInstrumentUIs`, `initUpload` (duplicate of `ui.js`), `setSongs`/`getSongs`, unused imports in `app.js` (incl. `removeSong`, `loadSongs`, `restoreTrackState`, `startGlobalRecord`, trim aliases), unused `backingLevelAnims`
10. **XSS hardening** — `addNewTrack()` restore path now escapes `name`/`icon` from localStorage before `innerHTML`
11. **No microphone selection** — Recording always used the system-default mic. Added `#micSelect` dropdown to the record-bar (populated via `enumerateDevices()` on grant + `devicechange` events), `requestMic(deviceId)` passes `deviceId: { exact }` to `getUserMedia`, `switchMic()` tears down the old stream/MediaRecorder and re-requests the chosen device (built-in laptop mic, USB/external mics both work). Dropdown disabled while recording
12. **Record ⏺ button dead on load** — `<button disabled>` + no auto-`requestMic` meant the button could never be clicked (the original app auto-requested the mic ~500ms after load, `app.original.js:790`, but this was lost in the module split). Now `record.init()` auto-requests the mic 500ms after load, the button is clickable from the start, and a failed/denied request keeps it clickable for retry (click = request mic → start recording)
13. **Plan Mode metronome removed** — UI (`#planMetronomeToggle`/`#planMetronomeStatus`/`#planMetronomeVol`/`#planMetronomeVolVal`), `startMetronome`/`stopMetronome` scheduler (setInterval-based; verified NOT shared with the transport clock — transport is `src.start()` + `requestAnimationFrame`/`Date.now()`, so no clock extraction was needed), its state (`metronomeEnabled`/`metronomeVolume`/`metronomeInterval`/`metronomeBeatCount`), and wiring in `app.js`/`plan-mode.js` are gone. Record-bar metronome (visual flash + click, `startMetronomeVisual`/`playMetronomeClick`) is untouched. Also fixed latent bug: `initMetronomeUI(updateBPM, ...)` passed a bare function where record.js expects `{ updateBPM }` — `bpmMinus`/`bpmPlus` would have thrown on click
14. **Loop feature removed** — UI (toggle + ตั้งจุดเริ่ม/จบ buttons), state (`loopEnabled`/`loopStart`/`loopEnd`), `src.loop` auto-seek in `startBacking`, playhead wrap in `updatePlayhead`, `setLoopStart`/`setLoopEnd`/`toggleLoop`/`updateLoopDisplay`, and `startPractice` seek-to-loopStart. Verified BEFORE deleting: `bounceMixdown` never referenced loop range (renders `backingBuffer` in full via `source.start(0)` with `OfflineAudioContext` sized to `buffer.duration`) — no bounce fix needed. Playback now always plays the song straight through with no seek-back
15. **Speed + Pitch Preserve removed** — UI (speed slider 0.5x-2x, `#planSpeedVal`, `#planPitchToggle`), `updateSpeed` (live `playbackRate.setValueAtTime`), `src.playbackRate.value = practiceSpeed` in `startBacking`, state `practiceSpeed`/`pitchPreserve`. Verified BEFORE deleting: `playbackRate` was used ONLY by those two spots — recording preview (`playRecording` uses `new Audio()`) and everything else never touched it, and no `preservesPitch`/`detune` exists anywhere (`pitchPreserve` was dead state, never read). Playback is now always 1x
16. **Key selection UI + virtual-instrument transpose** — Plan Mode gained คีย์ต้นฉบับ (placeholder, unknown = treated as C) + เปลี่ยนคีย์ dropdown (24 options); `originalKey`/`currentKey` live in state.js and persist in `platoo_session`. Transpose implemented for virtual instruments only (easiest path first): `keyNameToPitchClass`/`semitoneOffsetOf`/`applySemitoneOffset` in `utils.js`, applied via `playFreq()` in instruments.js at playback time (dataset.freq values are NOT mutated). Backing track / user tracks / recorded audio are not transposed yet

## Known Issues
- **User track audio playback not wired through Web Audio graph** (uses HTMLAudioElement / not wired at all) — play button on user tracks is still visual only
- **User track EQ/FX sliders are cosmetic** (fixed 6 tracks are wired; user tracks update DOM only)
- **Virtual instruments** (piano/guitar/bass/drums) bypass per-track FX chain (connect directly to `masterGain`)
- **All 6 fixed mixer channels play the same backing buffer when no stems are loaded** — stems now wire in per-channel via `stemBuffers` (feature #28) when the backend is up; without stems the old shared-buffer behavior remains
- **Bounce/export renders the backing buffer only** — user tracks and mic recordings are not included
- **Recordings stored as base64 in localStorage** (~3.5MB quota) — will fail silently on long takes; migrate to IndexedDB
- **Record-bar metronome** (visual flash + 🔇/🔊 click, `startMetronomeVisual`/`playMetronomeClick`) is not scheduled on the AudioContext clock so it can drift from playback
- **Transpose affects virtual instruments only** — backing track, user tracks, and recordings still play at original pitch

## Backend API (working)
- Stem separation runs **Demucs `htdemucs_6s`** (`backend/separator.py`, subprocess + move stems to `{output_dir}/{stem}.wav`; 6 stems: vocals/drums/bass/guitar/piano/other; first run downloads the model ~200MB to `~/.cache/torch`; CPU-only ≈ 3-4x song length for separation). `STEM_NAMES` lives in `separator.py` and is imported by `main.py` (single source of truth). Deps: `demucs` (torch CPU). Python 3.13 OK. Start: `python -m uvicorn main:app --port 8001` from `backend/`.
- `POST /api/separate` — Upload audio (≤100MB), returns `{ job_id, status: "processing" }`
- `GET /api/status/{job_id}` — Check job status
- `GET /api/download/{job_id}/{stem}` — Download stem WAV (job_id must be a UUID)
- `GET /api/stems/{job_id}` — Get all stem download URLs
- Jobs capped at `MAX_JOBS` (20), older than `JOB_TTL_SECONDS` (24h) swept; `uploads/`/`output/` dirs removed with the job. Jobs are **in-memory** — restarting uvicorn wipes them (old job_ids 404; the app then needs a re-upload).
- Frontend polls `GET /api/status/{job_id}` for completion, then `GET /api/stems/{job_id}` for URLs (that endpoint has **no** `status` field — don't poll it).
