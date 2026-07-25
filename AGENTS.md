# Platoo Player — AGENTS.md

## Project Overview
Platoo Player is a Thai-language web-based DAW-style music app. Users can upload songs, record multi-track audio, play virtual instruments (piano, guitar, bass, drums), apply effects, and export mixdowns.

## Tech Stack
- **Frontend:** HTML5, CSS3, Vanilla JS (IIFE pattern, no frameworks)
- **Audio:** Web Audio API (AudioContext, MediaRecorder, AnalyserNode, WaveShaper, Convolver, Delay)
- **Storage:** localStorage (songs, recordings, session)
- **No build step** — served via `python -m http.server`
- **Backend (blocked):** Python FastAPI (port 8001) for stem separation

## Project Structure
```
platoo player/
├── index.html              # Main HTML (Thai UI) ~470 lines
├── css/style.css           # All styles ~2617 lines
├── js/app.js               # All JS ~3234 lines
├── assets/songs/           # Uploaded song files
├── backend/                # Stem separation (blocked by Smart App Control)
│   ├── __init__.py
│   ├── main.py             # FastAPI server (port 8001)
│   ├── separator.py        # Wrapper for Demucs
│   ├── requirements.txt
│   └── uploads/
└── AGENTS.md               # This file
```

## Conventions
- **Language:** Thai UI, English code/comments (minimal)
- **JS:** IIFE, `const`/`let` OK, template literals OK, ES5-safe patterns
- **CSS:** Dark theme (`#000`, `#111`, `#ccc`), BEM-like naming
- **IDs:** camelCase (e.g. `uploadZone`)
- **Classes:** kebab-case (e.g. `backing-track`)
- **No external dependencies** — fully self-contained
- **No unit tests**

## How to Run
```powershell
python -m http.server 5500
```
Then open http://127.0.0.1:5500

## Features (All Completed)
| # | Feature | Details |
|---|---------|---------|
| 1 | Dashboard + Upload | Upload MP3/WAV/M4A, list songs, remove, localStorage persistence |
| 2 | Sidebar + Navigation | Logo, 3 tabs (Dashboard, Plan Mode, Record), Instrument list |
| 3 | Instrument Detail | Vocal → lyrics textarea; others → notation editor |
| 4 | Record Bar | Device name, timer, level meter, ⏺/⏹ buttons |
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
| 21 | Plan Mode | BPM slider + tap tempo, metronome click (1000Hz/800Hz), Loop (start/end), Speed (0.5x-2.0x), Pitch preserve |
| 22 | Visual Metronome | Flashing LED (blue on beat 1, gray on 2-4) in record bar; BPM +/- 5 |
| 23 | Click Track Toggle | 🔇/🔊 toggle in record bar; shared BPM with Plan Mode |
| 24 | Keyboard Shortcut Overlay | Press `?` to show all shortcuts in a modal |
| 25 | Undo/Redo | Snapshot-based, 30 steps, Ctrl+Z/Ctrl+Shift+Z+Y, buttons ↩/↪ |
| 26 | Instrument Effects | Per-track FX button → panel with Reverb/Delay/Distortion sliders |
| 27 | Audio Rewire | Fixed instruments changed from serial to parallel routing + MasterGain |

## Bugs Fixed (2026-07-18)
1. **`initBackingTracks()` wiping user tracks** — Called when clicking instrument play button and when loading backing track; replaced with `createBackingGains()` + canvas redraw (preserves user-added tracks)
2. **`trackCounter` reset after `loadSession()`** — `var trackCounter = 0` moved before `loadSession()` to prevent overwrite of restored counter

## Known Issues
- **Stem separation backend blocked** — Windows Smart App Control blocks numpy/torch/tensorflow `.pyd` files. User must disable Smart App Control and reinstall packages
- **No file size limit** for upload (no client-side validation)
- **User track audio playback** not wired through Web Audio graph (uses HTMLAudioElement)
- **Virtual instruments** (piano/guitar/bass/drums) bypass per-track FX chain (connect directly to destination)
- **EQ sliders** are cosmetic (not connected to audio graph)

## Backend API (Blocked)
- `POST /api/separate` — Upload audio, returns `{ job_id, status: "processing" }`
- `GET /api/status/{job_id}` — Check job status
- `GET /api/download/{job_id}/{stem}` — Download stem WAV
- `GET /api/stems/{job_id}` — Get all stem download URLs
