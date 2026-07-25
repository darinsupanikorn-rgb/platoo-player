# Platoo Player 🎵

เว็บแอปสตูดิโอทำเพลงภาษาไทย — อัปโหลด อัดเสียง เล่นเครื่องดนตรี ใส่เอฟเฟกต์ และส่งออกเพลง

## ฟีเจอร์ทั้งหมด

### 🎛️ Dashboard
- อัปโหลด MP3/WAV/M4A (สูงสุด 100MB)
- จัดการรายการเพลง (ลบ, ดูขนาด, วันที่)
- Stem separation (ต้องการ backend)

### 🎹 เครื่องดนตรีเสมือน
- **เปียโน** — 4 Octaves + C6, คีย์บอร์ดลัด (ZXCVBNM+QWERTYUI+เลข)
- **กีตาร์** — 6 สาย × 13 เฟรต, คอร์ด 15 แบบ, Strumming effect
- **เบส** — 4 สาย × 13 เฟรต, Power chords 7 แบบ
- **กลอง** — 9 แพด (Kick, Snare, Hi-Hat, Tom×3, Ride, Crash, Clap)

### 🎙️ อัดเสียง
- อัดแบบ Per-track (กด R ที่แทร็ก)
- Real-time waveform ขณะอัด
- ระดับเสียงแบบ Visual meter

### 🎚️ มิกเซอร์
- 6 Instrument tracks (Vocal, Drums, Bass, Guitar, Piano, Other)
- Volume / Pan / 3-band EQ / Mute / Solo
- **FX ต่อแทร็ก:** Reverb, Delay, Distortion
- Waveform + Playhead animation
- ลากเปลี่ยนลำดับแทร็ก (Drag & Drop)

### ⏯️ Plan Mode
- BPM ปรับได้ (40-240) + Tap Tempo
- Metronome พร้อม Visual Flash
- Loop (ตั้งจุดเริ่ม-จบ)
- Speed (0.5x-2.0x) + Pitch preserve

### 💾 เซสชัน
- Auto-save ลง localStorage
- Save/Load เซสชัน
- Undo/Redo (30 steps, Ctrl+Z/Y)

### 📦 Export
- Bounce รวมทุกแทร็ก → ดาวน์โหลด mixdown.wav

## วิธีรัน

```powershell
python -m http.server 5500
```

เปิด `http://127.0.0.1:5500`

## เทคโนโลยี

| ส่วน | สิ่งที่ใช้ |
|------|-----------|
| Frontend | HTML5, CSS3, Vanilla JS (IIFE) |
| Audio | Web Audio API, MediaRecorder, AnalyserNode |
| Storage | localStorage |
| Backend | Python FastAPI (port 8001) — สำหรับ Stem separation |

## โครงสร้างโปรเจกต์

```
platoo player/
├── index.html          # UI หลัก
├── css/style.css       # สไตล์ทั้งหมด
├── js/app.js           # JS ทั้งหมด (IIFE)
├── assets/songs/       # ไฟล์เพลงที่อัปโหลด
├── backend/            # Stem separation API
└── AGENTS.md           # บันทึกสถานะโปรเจกต์
```