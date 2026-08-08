// ─── platoo-player: Auto Key Detection ───
// Chromagram (STFT peak-picking, 12 pitch classes) + Krumhansl-Schmuckler
// correlation against the 24 major/minor key profiles. Pure DSP functions
// are Node-testable; analyzeFile() is the browser path (decode + detect).

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl & Kessler (1982) key profiles, indexed from the tonic
const KS_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KS_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// Analysis config
const FRAME_SIZE = 2048;          // FFT size
const HOP_SIZE = 1024;            // 50% overlap
const MIN_FREQ = 50;              // Hz — below: rumble/noise
const MAX_FREQ = 4200;            // Hz — above: cymbals/harmonic haze
const PEAK_RATIO = 0.05;          // a peak must exceed 5% of frame max
const MAX_SAMPLES = 44100 * 60;   // analyze at most the first 60 s

// Minimum gap between the best and second-best candidate correlations for
// the detection to be considered confident (relative major/minor pairs
// score very close, e.g. A Minor vs C Major).
const CONFIDENCE_DELTA = 0.02;

// Precomputed profile stats (mean / std) for Pearson correlation
const PROFILE_STATS = {
  major: { mean: avg(KS_MAJOR), std: std(KS_MAJOR, avg(KS_MAJOR)) },
  minor: { mean: avg(KS_MINOR), std: std(KS_MINOR, avg(KS_MINOR)) }
};

function avg(a) {
  var s = 0;
  for (var i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
}

function std(a, m) {
  var s = 0;
  for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
  return Math.sqrt(s / a.length);
}

// ─── Radix-2 FFT (in place, length must be a power of 2) ───
function fft(re, im) {
  var n = re.length;
  for (var i = 1, j = 0; i < n; i++) {
    var bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      var tr = re[i]; re[i] = re[j]; re[j] = tr;
      tr = im[i]; im[i] = im[j]; im[j] = tr;
    }
  }
  for (var len = 2; len <= n; len <<= 1) {
    var ang = -2 * Math.PI / len;
    var wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (var i = 0; i < n; i += len) {
      var curRe = 1, curIm = 0;
      for (var k = 0; k < len / 2; k++) {
        var uRe = re[i + k], uIm = im[i + k];
        var vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        var vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe; im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe; im[i + k + len / 2] = uIm - vIm;
        var nRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nRe;
      }
    }
  }
}

function hannWindow(n) {
  var w = new Float32Array(n);
  for (var i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
  }
  return w;
}

// ─── Chromagram: fold spectral peaks into 12 pitch classes ───
// mono: Float32Array PCM samples. Returns Float32Array(12) normalized so the
// loudest pitch class = 1, or null when there is no usable audio.
export function computeChromagram(mono, sampleRate) {
  var N = FRAME_SIZE;
  var hop = HOP_SIZE;
  var maxLen = Math.min(mono.length, MAX_SAMPLES);
  var binMin = Math.max(1, Math.floor(MIN_FREQ * N / sampleRate));
  var binMax = Math.min(N / 2 - 1, Math.ceil(MAX_FREQ * N / sampleRate));
  if (maxLen < N || binMax <= binMin) return null;

  var chroma = new Float32Array(12);
  var re = new Float32Array(N);
  var im = new Float32Array(N);
  var win = hannWindow(N);
  var mags = new Float32Array(N / 2);
  var energy = 0;

  for (var start = 0; start + N <= maxLen; start += hop) {
    var frameMax = 0;
    for (var i = 0; i < N; i++) {
      var v = mono[start + i] * win[i];
      re[i] = v;
      im[i] = 0;
      var a = v < 0 ? -v : v;
      if (a > frameMax) frameMax = a;
    }
    if (frameMax < 1e-4) continue;

    fft(re, im);

    var maxMag = 0;
    for (var k = binMin; k <= binMax; k++) {
      var m = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      mags[k] = m;
      if (m > maxMag) maxMag = m;
    }
    energy += maxMag;
    if (maxMag < 1e-4) continue;

    var threshold = maxMag * PEAK_RATIO;
    for (var k = binMin + 1; k < binMax; k++) {
      if (mags[k] <= mags[k - 1] || mags[k] < mags[k + 1] || mags[k] <= threshold) continue;
      var freq = k * sampleRate / N;
      var midi = 69 + 12 * Math.log2(freq / 440);
      var pc = ((Math.round(midi) % 12) + 12) % 12;
      chroma[pc] += mags[k];
    }
  }

  if (!(energy > 0)) return null;

  var maxC = 0;
  for (var i = 0; i < 12; i++) if (chroma[i] > maxC) maxC = chroma[i];
  if (!(maxC > 0)) return null;
  for (var i = 0; i < 12; i++) chroma[i] /= maxC;
  return chroma;
}

// ─── Krumhansl-Schmuckler: best of 24 rotations ───
// chroma: Float32Array(12) from computeChromagram().
// Returns { key, tonic, mode, correlation, scores } or null.
export function detectKey(chroma) {
  if (!chroma) return null;
  var total = 0;
  for (var i = 0; i < 12; i++) total += chroma[i];
  if (!(total > 0)) return null;
  var meanC = total / 12;
  var varC = 0;
  for (var i = 0; i < 12; i++) varC += (chroma[i] - meanC) * (chroma[i] - meanC);
  if (!(varC > 0)) return null;
  var sC = Math.sqrt(varC);

  var scores = [];
  var best = null;
  var secondBest = null;
  var bestRaw = -Infinity;
  var secondRaw = -Infinity;
  var modes = [['Major', KS_MAJOR, PROFILE_STATS.major], ['Minor', KS_MINOR, PROFILE_STATS.minor]];
  for (var tonic = 0; tonic < 12; tonic++) {
    for (var m = 0; m < modes.length; m++) {
      var mode = modes[m][0];
      var profile = modes[m][1];
      var ps = modes[m][2];
      var num = 0;
      for (var i = 0; i < 12; i++) {
        num += (chroma[(i + tonic) % 12] - meanC) * (profile[i] - ps.mean);
      }
      var raw = num / (sC * ps.std);
      var c = Math.max(-1, Math.min(1, raw));
      scores.push({ key: NOTE_NAMES[tonic] + ' ' + mode, tonic: tonic, mode: mode, correlation: c });
      if (raw > bestRaw) {
        secondBest = best;
        secondRaw = bestRaw;
        best = scores[scores.length - 1];
        bestRaw = raw;
      } else if (raw > secondRaw) {
        secondBest = scores[scores.length - 1];
        secondRaw = raw;
      }
    }
  }
  var confident = !secondBest || best.correlation - secondBest.correlation >= CONFIDENCE_DELTA;
  return {
    key: best.key,
    tonic: best.tonic,
    mode: best.mode,
    correlation: best.correlation,
    confident: confident,
    scores: scores
  };
}

// ─── One-shot: PCM samples -> key name ───
export function detectKeyFromSamples(mono, sampleRate) {
  return detectKey(computeChromagram(mono, sampleRate || 44100));
}

// ─── Browser path: File -> detected key (or null) ───
let decoderCtx = null;

export async function analyzeFile(file) {
  try {
    if (!decoderCtx) {
      decoderCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    var ab = file.arrayBuffer
      ? await file.arrayBuffer()
      : await new Response(file).arrayBuffer();
    var buffer = await decoderCtx.decodeAudioData(ab);
    if (!buffer || typeof buffer.getChannelData !== 'function') return null;
    var channels = buffer.numberOfChannels || 1;
    var n = Math.min(buffer.length, MAX_SAMPLES);
    var mono = new Float32Array(n);
    var d0 = buffer.getChannelData(0);
    for (var i = 0; i < n; i++) mono[i] = d0[i];
    if (channels > 1) {
      var d1 = buffer.getChannelData(1);
      for (var i = 0; i < n; i++) mono[i] = (mono[i] + d1[i]) * 0.5;
    }
    return detectKeyFromSamples(mono, buffer.sampleRate || 44100);
  } catch (e) {
    return null;
  }
}
