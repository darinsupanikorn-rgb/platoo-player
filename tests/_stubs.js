// ─── platoo-player: Minimal DOM / WebAudio stubs ───
// Lets the real ES modules run inside Node so logic can be verified
// without a browser. Not a full DOM implementation - only what the app uses.

const VOID_TAGS = new Set(['input', 'br', 'img', 'meta', 'link', 'hr']);

function encodeEntities(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const TAG_ATTR_RE = /<([a-zA-Z0-9]+)((?:\s+[a-zA-Z0-9-]+(?:="[^"]*")?)*?)\s*\/?>/g;
const ATTR_RE = /([a-zA-Z0-9-]+)(?:\s*=\s*"([^"]*)")?/g;

// Register every element that carries an id, with its real tag name and
// boolean/primitive attributes (disabled, hidden, value, checked) from HTML.
function registerIdsFromHtml(doc, html) {
  let tm;
  while ((tm = TAG_ATTR_RE.exec(html))) {
    const attrs = {};
    let am;
    while ((am = ATTR_RE.exec(tm[2]))) attrs[am[1]] = am[2] !== undefined ? am[2] : '';
    if (attrs.id === undefined) continue;
    const el = new ElementStub(tm[1], doc);
    el.id = attrs.id;
    if (attrs.disabled !== undefined) el.disabled = true;
    if (attrs.hidden !== undefined) el.hidden = true;
    if (attrs.value !== undefined) el.value = attrs.value;
    if (attrs.checked !== undefined) el.checked = true;
    doc._register(el);
  }
}

class ClassListStub {
  constructor() { this._s = new Set(); }
  add(...c) { c.forEach(x => this._s.add(x)); }
  remove(...c) { c.forEach(x => this._s.delete(x)); }
  contains(c) { return this._s.has(c); }
  toggle(c, force) {
    if (force === undefined) {
      if (this._s.has(c)) this._s.delete(c); else this._s.add(c);
    } else if (force) this._s.add(c); else this._s.delete(c);
  }
  toString() { return [...this._s].join(' '); }
}

const ctx2d = {
  fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
  fillRect() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
  stroke() {}, fill() {}, arc() {}, closePath() {}, setTransform() {},
  drawImage() { ctx2d.drawCount = (ctx2d.drawCount || 0) + 1; }
};

function parseHtml(root, html) {
  root.children = [];
  const re = /<(\/?)([a-zA-Z0-9]+)((?:\s+[a-zA-Z0-9-]+(?:="[^"]*")?)*?)\s*\/?>/g;
  const stack = [{ el: root, text: '' }];
  let last = 0;
  let m;
  while ((m = re.exec(html))) {
    const text = html.slice(last, m.index);
    if (text) stack[stack.length - 1].text += text;
    last = re.lastIndex;
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (closing) {
      if (stack.length > 1) {
        const top = stack.pop();
        if (top) top.el.textContent = top.text;
        if (stack.length) stack[stack.length - 1].el.appendChild(top.el);
      }
      continue;
    }
    const el = new ElementStub(tag, root.doc || root);
    const attrRe = /([a-zA-Z0-9-]+)(?:\s*=\s*"([^"]*)")?/g;
    let am;
    while ((am = attrRe.exec(m[3]))) {
      const name = am[1];
      const val = am[2] !== undefined ? am[2] : '';
      if (name === 'class') el.className = val;
      else if (name === 'id') { el.id = val; if ((root.doc || root)._register) (root.doc || root)._register(el); }
      else if (name.startsWith('data-')) el.dataset[name.slice(5)] = val;
      else if (name === 'value') el.value = val;
      else if (name === 'width') el.width = parseInt(val, 10);
      else if (name === 'height') el.height = parseInt(val, 10);
      else el.attrs[name] = val;
    }
    if (VOID_TAGS.has(tag) || /\/>$/.test(m[0])) {
      stack[stack.length - 1].el.appendChild(el);
    } else {
      stack.push({ el, text: '' });
    }
  }
  const tail = html.slice(last);
  if (tail) stack[stack.length - 1].text += tail;
  while (stack.length > 1) {
    const top = stack.pop();
    top.el.textContent = top.text;
    stack[stack.length - 1].el.appendChild(top.el);
  }
  stack[0].el.textContent = stack[0].text;
}

function matchSeg(el, seg) {
  let rest = seg;
  const tm = rest.match(/^[a-zA-Z][a-zA-Z0-9]*/);
  if (tm) {
    if (el.tagName !== tm[0].toUpperCase()) return false;
    rest = rest.slice(tm[0].length);
  }
  while (rest.length) {
    if (rest[0] === '.') {
      const mm = rest.match(/^\.([a-zA-Z0-9_-]+)/);
      if (!mm || !el.classList.contains(mm[1])) return false;
      rest = rest.slice(mm[0].length);
    } else if (rest[0] === '[') {
      const mm = rest.match(/^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]/);
      if (!mm) return false;
      const val = el.dataset[mm[1]] !== undefined ? el.dataset[mm[1]] : el.attrs[mm[1]];
      if (mm[2] !== undefined ? String(val) !== mm[2] : (val === undefined || val === '')) return false;
      rest = rest.slice(mm[0].length);
    } else {
      return false;
    }
  }
  return true;
}

function descendants(root, out) {
  root.children.forEach(c => { out.push(c); descendants(c, out); });
  return out;
}

function queryAll(root, sel) {
  const segs = sel.trim().split(/\s+/);
  const pool = root.isDoc ? [...root._reg.values()] : descendants(root, []);
  if (segs.length === 1) return pool.filter(el => matchSeg(el, segs[0]));
  const last = segs[segs.length - 1];
  const prev = segs.slice(0, -1);
  return pool.filter(el => {
    if (!matchSeg(el, last)) return false;
    let n = el.parentNode;
    let pi = prev.length - 1;
    while (n && pi >= 0) {
      if (matchSeg(n, prev[pi])) pi--;
      n = n.parentNode;
    }
    return pi < 0;
  });
}

class ElementStub {
  constructor(tagName, doc) {
    this.tagName = String(tagName).toUpperCase();
    this.doc = doc;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attrs = {};
    this.style = {};
    this.classList = new ClassListStub();
    this.listeners = {};
    this.textContent = '';
    this._htmlSet = undefined;
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.width = 0;
    this.height = 0;
    this.id = '';
  }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  dispatch(t, ev) {
    const event = Object.assign({
      type: t, target: this,
      preventDefault() {}, stopPropagation() {},
      clientX: 0, clientY: 0, touches: [],
      key: '', ctrlKey: false, metaKey: false, shiftKey: false, repeat: false
    }, ev || {});
    (this.listeners[t] || []).forEach(fn => fn.call(this, event));
  }
  click() { this.dispatch('click'); }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    c.parentNode = null;
    return c;
  }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this); }
  querySelector(sel) { return queryAll(this, sel)[0] || null; }
  querySelectorAll(sel) { return queryAll(this, sel); }
  closest(sel) { let n = this; while (n) { if (matchSeg(n, sel)) return n; n = n.parentNode; } return null; }
  getContext() { return ctx2d; }
  set innerHTML(v) { this._htmlSet = String(v); parseHtml(this, this._htmlSet); }
  get innerHTML() { return this._htmlSet !== undefined ? this._htmlSet : encodeEntities(this.textContent); }
  set className(v) { this.classList = new ClassListStub(); String(v || '').split(/\s+/).filter(Boolean).forEach(x => this.classList.add(x)); }
  get className() { return this.classList.toString(); }
}

class DocStub {
  constructor() {
    this.tagName = 'HTML';
    this.isDoc = true;
    this.body = new ElementStub('body', this);
    this._reg = new Map();
    this._anchors = [];
  }
  _register(el) { this._reg.set(el.id, el); }
  register(el, id) { el.id = id; el.doc = this; this._register(el); return el; }
  getElementById(id) { return this._reg.get(id) || null; }
  createElement(tag) {
    const el = new ElementStub(tag, this);
    if (tag === 'a') {
      el.href = '';
      el.download = '';
      const origClick = el.click.bind(el);
      el.click = () => { el._clicked = true; origClick(); };
      this._anchors.push(el);
    }
    return el;
  }
  querySelector(sel) { return queryAll(this, sel)[0] || null; }
  querySelectorAll(sel) { return queryAll(this, sel); }
  addEventListener() {}
  removeEventListener() {}
}

function makeBuffer(ch, len, sr) {
  const channels = [];
  for (let c = 0; c < ch; c++) channels.push(new Float32Array(len));
  return {
    numberOfChannels: ch,
    length: len,
    sampleRate: sr,
    get duration() { return len / sr; },
    getChannelData(c) { return channels[c]; }
  };
}

function gainNode() {
  return {
    gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    connect() {}, disconnect() {}
  };
}

class AudioContextStub {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = { connect() {} };
    this.gains = [];
    this.sources = [];
    this.oscillators = [];
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  createGain() { const n = gainNode(); this.gains.push(n); return n; }
  createStereoPanner() { return { pan: { value: 0 }, connect() {}, disconnect() {} }; }
  createWaveShaper() { return { curve: null, connect() {}, disconnect() {} }; }
  createDelay() { return { delayTime: { value: 0 }, connect() {}, disconnect() {} }; }
  createConvolver() { return { buffer: null, connect() {}, disconnect() {} }; }
  createBiquadFilter() {
    const f = { type: '', frequency: { value: 0 }, Q: { value: 0 }, gain: { value: 0 }, connect() {}, disconnect() {} };
    (this.biquads = this.biquads || []).push(f);
    return f;
  }
  createBufferSource() {
    const s = {
      buffer: null, playbackRate: { value: 1, setValueAtTime() {} },
      loop: false, loopStart: 0, loopEnd: 0,
      connect() {}, disconnect() {}, start() {}, stop() {}
    };
    this.sources.push(s);
    return s;
  }
  createOscillator() {
    const o = {
      type: '', frequency: { value: 0, exponentialRampToValueAtTime() {} },
      connect() {}, start() {}, stop() {}
    };
    this.oscillators.push(o);
    return o;
  }
  createBuffer(ch, len, sr) { return makeBuffer(ch, len, sr); }
  createMediaStreamSource() { return { connect() {} }; }
  createAnalyser() {
    return {
      fftSize: 256, frequencyBinCount: 128,
      connect() {}, getByteFrequencyData() {}, getByteTimeDomainData() {}
    };
  }
  decodeAudioData(buf, ok) { if (ok) ok(makeBuffer(2, 4410, 44100)); }
}

class OfflineAudioContextStub extends AudioContextStub {
  constructor(ch, len, sr) { super(); this.length = len; globalThis._offlineContexts.push(this); }
  startRendering() { return Promise.resolve(makeBuffer(2, 1000, 44100)); }
}

class MediaRecorderStub {
  constructor(stream, opts) {
    this.stream = stream;
    this.mimeType = (opts && opts.mimeType) || 'audio/webm';
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
  }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; if (this.onstop) this.onstop(); }
  static isTypeSupported() { return true; }
}

class FileReaderStub {
  readAsArrayBuffer() { if (this.onload) this.onload({ target: { result: {} } }); }
  readAsDataURL() { if (this.onloadend) this.onloadend({ target: { result: 'data:audio/webm;base64,AAAA' } }); }
}

class BlobStub {
  constructor(parts, opts) {
    this.parts = parts || [];
    this.size = (parts || []).reduce((s, p) => s + (p && p.byteLength !== undefined ? p.byteLength : (p ? p.length : 0)), 0);
    this.type = (opts && opts.type) || '';
  }
}

function mkStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    clear: () => m.clear(),
    _m: m
  };
}

function setup(globalObj = globalThis) {
  const doc = new DocStub();
  globalObj.document = doc;
  globalObj.window = {
    AudioContext: AudioContextStub,
    webkitAudioContext: AudioContextStub,
    OfflineAudioContext: OfflineAudioContextStub,
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener() {}, removeEventListener() {}
  };
  globalObj.OfflineAudioContext = OfflineAudioContextStub;
  globalObj._offlineContexts = [];
  const gumCalls = [];
  Object.defineProperty(globalObj, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        _gumCalls: gumCalls,
        getUserMedia: async (constraints) => {
          gumCalls.push(JSON.parse(JSON.stringify(constraints || {})));
          const devId = constraints && constraints.audio && constraints.audio.deviceId
            ? constraints.audio.deviceId.exact : null;
          const label = devId === 'usb-mic' ? 'USB Microphone'
            : devId === 'builtin-mic' ? 'Internal Mic' : 'Test Mic';
          return {
            getAudioTracks: () => [{ label }],
            getTracks: () => [{ label, stop() {} }]
          };
        },
        enumerateDevices: async () => [
          { kind: 'audioinput', deviceId: 'builtin-mic', label: 'Internal Mic' },
          { kind: 'audioinput', deviceId: 'usb-mic', label: 'USB Microphone' }
        ],
        addEventListener() {},
        removeEventListener() {}
      }
    }
  });
  globalObj.localStorage = mkStorage();
  globalObj.MediaRecorder = MediaRecorderStub;
  globalObj.FileReader = FileReaderStub;
  globalObj.Blob = BlobStub;
  if (typeof globalObj.URL === 'function') {
    globalObj.URL.createObjectURL = () => 'blob:mock';
    globalObj.URL.revokeObjectURL = () => {};
  } else {
    globalObj.URL = { createObjectURL: () => 'blob:mock', revokeObjectURL() {} };
  }
  globalObj.alert = () => {};
  globalObj.requestAnimationFrame = () => 1;
  globalObj.cancelAnimationFrame = () => {};
  return { doc };
}

export {
  setup, DocStub, ElementStub, makeBuffer, AudioContextStub,
  OfflineAudioContextStub, ctx2d, encodeEntities, registerIdsFromHtml
};
