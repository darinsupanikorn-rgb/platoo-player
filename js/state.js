// ─── platoo-player: Shared State ───

export const instruments = [
  { id: 'vocal', label: 'Vocal', icon: '\uD83C\uDFA4', group: 'vocal' },
  { id: 'drums', label: 'Drums', icon: '\uD83C\uDD95', group: 'drums' },
  { id: 'bass', label: 'Bass', icon: '\uD83C\uDFB8', group: 'strings' },
  { id: 'guitar', label: 'Guitar', icon: '\uD83C\uDFB8', group: 'strings' },
  { id: 'piano', label: 'Piano', icon: '\uD83C\uDFB9', group: 'keys' },
  { id: 'other', label: 'Other', icon: '\uD83C\uDFB5', group: 'other' },
];

// ─── Audio Engine State ───
export let backingAudioCtx = null;
export let masterGain = null;
export let backingSource = null;
export const backingGainNodes = {};
export const backingPanNodes = {};
export let backingBuffer = null;
export let backingIsPlaying = false;
export let backingStartOffset = 0;
export let backingStartTime = 0;
export const backingLevelAnims = {};
export let activePlayTrack = null;
export const backingDistNodes = {};
export const backingDelayNodes = {};
export const backingDelayFeedback = {};
export const backingDelayWet = {};
export const backingReverbNodes = {};
export const backingReverbWet = {};
export const backingEqBass = {};
export const backingEqMid = {};
export const backingEqTreble = {};
export let playheadAnimId = null;

// ─── Instrument State ───
export const instState = {};
export const activeOscillators = {};
export let trackCounter = 0;

// ─── Plan Mode Variables ───
export let practiceBPM = 120;
export const tapTimes = [];
export let originalKey = '';
export let currentKey = 'C Major';

// ─── Record State ───
export let mediaRecorder = null;
export const recordedChunks = [];
export let recordingStream = null;
export let recordingTimer = null;
export let recordingStartTime = null;
export let isRecording = false;
export let audioContext = null;
export let analyserNode = null;
export let animationFrame = null;
export let currentRecTrackId = null;

// ─── Metronome Visual ───
export let metronomeClickEnabled = false;
export let metroFlashInterval = null;
export let metroIndicatorEl = null;
export let bpmDisplayEl = null;

// ─── Recordings ───
export let recordings = [];

// ─── Undo/Redo ───
export const undoStack = [];
export const redoStack = [];
export const MAX_UNDO = 30;

// ─── Save/Load ───
export let saveTimeout = null;

// ─── Stem Separation ───
export const stemAudioElements = {};

// ─── Setters for state that needs controlled mutation ───
export function setBackingAudioCtx(v) { backingAudioCtx = v; }
export function setMasterGain(v) { masterGain = v; }
export function setBackingSource(v) { backingSource = v; }
export function setBackingBuffer(v) { backingBuffer = v; }
export function setBackingIsPlaying(v) { backingIsPlaying = v; }
export function setBackingStartOffset(v) { backingStartOffset = v; }
export function setBackingStartTime(v) { backingStartTime = v; }
export function setActivePlayTrack(v) { activePlayTrack = v; }
export function setPlayheadAnimId(v) { playheadAnimId = v; }
export function setTrackCounter(v) { trackCounter = v; }
export function setPracticeBPM(v) { practiceBPM = v; }
export function setOriginalKey(v) { originalKey = v; }
export function setCurrentKey(v) { currentKey = v; }
export function setMediaRecorder(v) { mediaRecorder = v; }
export function setRecordingStream(v) { recordingStream = v; }
export function setRecordingTimer(v) { recordingTimer = v; }
export function setRecordingStartTime(v) { recordingStartTime = v; }
export function setIsRecording(v) { isRecording = v; }
export function setAudioContext(v) { audioContext = v; }
export function setAnalyserNode(v) { analyserNode = v; }
export function setAnimationFrame(v) { animationFrame = v; }
export function setCurrentRecTrackId(v) { currentRecTrackId = v; }
export function setMetronomeClickEnabled(v) { metronomeClickEnabled = v; }
export function setMetroFlashInterval(v) { metroFlashInterval = v; }
export function setMetroIndicatorEl(v) { metroIndicatorEl = v; }
export function setBpmDisplayEl(v) { bpmDisplayEl = v; }
export function setRecordings(v) { recordings = v; }
export function setSaveTimeout(v) { saveTimeout = v; }

// ─── Piano State ───
export const noteMap = {
  'C2':65.41,'C#2':69.30,'D2':73.42,'D#2':77.78,'E2':82.41,'F2':87.31,
  'F#2':92.50,'G2':98.00,'G#2':103.83,'A2':110.00,'A#2':116.54,'B2':123.47,
  'C3':130.81,'C#3':138.59,'D3':146.83,'D#3':155.56,'E3':164.81,'F3':174.61,
  'F#3':185.00,'G3':196.00,'G#3':207.65,'A3':220.00,'A#3':233.08,'B3':246.94,
  'C4':261.63,'C#4':277.18,'D4':293.66,'D#4':311.13,'E4':329.63,'F4':349.23,
  'F#4':369.99,'G4':392.00,'G#4':415.30,'A4':440.00,'A#4':466.16,'B4':493.88,
  'C5':523.25,'C#5':554.37,'D5':587.33,'D#5':622.25,'E5':659.25,'F5':698.46,
  'F#5':739.99,'G5':783.99,'G#5':830.61,'A5':880.00,'A#5':932.33,'B5':987.77,
  'C6':1046.50
};
export const noteOrder = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const keyboardNoteMap = {
  'z':'C3','s':'C#3','x':'D3','d':'D#3','c':'E3','v':'F3','g':'F#3','b':'G3',
  'h':'G#3','n':'A3','j':'A#3','m':'B3','q':'C4','2':'C#4','w':'D4','3':'D#4',
  'e':'E4','r':'F4','5':'F#4','t':'G4','6':'G#4','y':'A4','7':'A#4','u':'B4',
  'i':'C5','9':'C#5','o':'D5','0':'D#5','p':'E5'
};
export const noteToKeyboardKey = {};
export const noteKeyDisplay = {};
export const activeKeyboardNotes = {};

// ─── Guitar State ───
export const guitarStrings = [
  { name: 'E4', freq: 329.63 }, { name: 'B3', freq: 246.94 },
  { name: 'G3', freq: 196.00 }, { name: 'D3', freq: 146.83 },
  { name: 'A2', freq: 110.00 }, { name: 'E2', freq: 82.41 }
];
export const guitarKeyboardMap = {};
export const guitarKeyToNote = {};
export const guitarChords = [
  { name: 'C', frets: [-1,3,2,0,1,0] }, { name: 'D', frets: [-1,-1,0,2,3,2] },
  { name: 'E', frets: [0,2,2,1,0,0] }, { name: 'F', frets: [1,3,3,2,1,1] },
  { name: 'G', frets: [3,2,0,0,0,3] }, { name: 'A', frets: [-1,0,2,2,2,0] },
  { name: 'B', frets: [-1,2,4,4,4,2] }, { name: 'Am', frets: [-1,0,2,2,1,0] },
  { name: 'Em', frets: [0,2,2,0,0,0] }, { name: 'Dm', frets: [-1,-1,0,2,3,1] },
  { name: 'C7', frets: [-1,3,2,3,1,0] }, { name: 'G7', frets: [3,2,0,0,0,1] },
  { name: 'A7', frets: [-1,0,2,0,2,0] }, { name: 'E7', frets: [0,2,0,1,0,0] },
  { name: 'D7', frets: [-1,-1,0,2,1,2] }
];
export let activeGuitarChord = null;
export let strumDown = true;
export const strumDelay = 0.008;

// ─── Bass State ───
export const bassStrings = [
  { name: 'G2', freq: 98.00 }, { name: 'D2', freq: 73.42 },
  { name: 'A1', freq: 55.00 }, { name: 'E1', freq: 41.20 }
];
export const bassKeyboardMap = {};
export const bassKeyToNote = {};
export const bassChords = [
  { name: 'C', frets: [3,3,2,0] }, { name: 'D', frets: [5,5,4,2] },
  { name: 'E', frets: [7,7,6,4] }, { name: 'F', frets: [8,8,7,5] },
  { name: 'G', frets: [10,10,9,7] }, { name: 'A', frets: [12,12,11,9] },
  { name: 'B', frets: [14,14,13,11] }
];
export let activeBassChord = null;
export let bassStrumDown = true;

// ─── Drums State ───
export const drumPads = [
  { key: 'kick', label: 'Kick', kbKey: 'A' },
  { key: 'snare', label: 'Snare', kbKey: 'S' },
  { key: 'hihat', label: 'Hi-Hat', kbKey: 'D' },
  { key: 'tom1', label: 'Tom 1', kbKey: 'F' },
  { key: 'tom2', label: 'Tom 2', kbKey: 'G' },
  { key: 'tom3', label: 'Tom 3', kbKey: 'H' },
  { key: 'ride', label: 'Ride', kbKey: 'J' },
  { key: 'crash', label: 'Crash', kbKey: 'K' },
  { key: 'clap', label: 'Clap', kbKey: 'L' }
];
export const drumsKeyToKey = {};
