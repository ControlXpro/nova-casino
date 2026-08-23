/* Nova Casino — core: RNG, wallet, DOM helpers.
   Play-money only. No server, no payments, no persistence beyond localStorage. */

/* ---------------- RNG ---------------- */
const cryptoObj = globalThis.crypto;
const pool = new Uint32Array(64);
let poolIdx = pool.length;

function nextU32() {
  if (poolIdx >= pool.length) { cryptoObj.getRandomValues(pool); poolIdx = 0; }
  return pool[poolIdx++];
}
/** Uniform float in [0,1). */
export function rnd() { return nextU32() / 4294967296; }
/** Uniform integer in [0,n). Rejection-sampled so it is unbiased. */
export function rndInt(n) {
  if (n <= 0) return 0;
  const limit = Math.floor(4294967296 / n) * n;
  let v; do { v = nextU32(); } while (v >= limit);
  return v % n;
}
export function pick(arr) { return arr[rndInt(arr.length)]; }
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rndInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
/** Pick an index from an array of weights. */
export function weighted(weights) {
  let total = 0;
  for (const w of weights) total += w;
  let r = rnd() * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
}

/* ---------------- money ---------------- */
export const fmt = (n) =>
  Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtx = (n) => Number(n).toFixed(2) + 'x';

const KEY_BASE = 'nova.casino.v1';
const START = 10000;
let profile = 'guest';
const keyFor = (p) => `${KEY_BASE}:${p}`;

const fresh = () => ({ balance: START, wagered: 0, returned: 0, rounds: 0, recent: [] });
const state = { ...fresh(), ageOk: false };

/* the age acknowledgement is device-wide, not per account */
try { state.ageOk = localStorage.getItem('nova.age.v1') === '1'; } catch { /* ignore */ }

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const { ageOk, ...rest } = state;
      localStorage.setItem(keyFor(profile), JSON.stringify(rest));
    } catch { /* quota */ }
  }, 250);
}

/** Point the wallet at a profile's own saved balance. */
function loadProfile(id) {
  profile = id || 'guest';
  Object.assign(state, fresh());
  try {
    const raw = localStorage.getItem(keyFor(profile));
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch { /* corrupt storage — start fresh */ }
  emit('up');
}

const listeners = new Set();
export function onWallet(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(dir) { for (const fn of listeners) fn(state, dir); }

export const wallet = {
  get balance() { return state.balance; },
  get stats() { return { wagered: state.wagered, returned: state.returned, rounds: state.rounds }; },
  get ageOk() { return state.ageOk; },
  get profile() { return profile; },
  acceptAge() {
    state.ageOk = true;
    try { localStorage.setItem('nova.age.v1', '1'); } catch { /* ignore */ }
  },
  useProfile(id) { loadProfile(id); },

  can(amount) { return amount > 0 && state.balance >= amount - 1e-9; },

  /** Take a stake off the balance. Returns false if it cannot be covered. */
  bet(amount) {
    amount = round2(amount);
    if (!this.can(amount)) return false;
    state.balance = round2(state.balance - amount);
    state.wagered = round2(state.wagered + amount);
    state.rounds++;
    save(); emit('down');
    return true;
  },

  /** Credit a payout (total return, stake included). */
  pay(amount) {
    amount = round2(amount);
    if (amount <= 0) return 0;
    state.balance = round2(state.balance + amount);
    state.returned = round2(state.returned + amount);
    save(); emit('up');
    return amount;
  },

  /** Refund a stake without counting it as a win (e.g. a push). */
  refund(amount) {
    amount = round2(amount);
    state.balance = round2(state.balance + amount);
    state.wagered = round2(state.wagered - amount);
    save(); emit('up');
  },

  topUp(amount = 5000) {
    state.balance = round2(state.balance + amount);
    save(); emit('up');
  },

  logResult(gameId, stake, payout) {
    state.recent.unshift({ g: gameId, s: stake, p: payout });
    if (state.recent.length > 40) state.recent.length = 40;
    save();
  },
  get recent() { return state.recent; },

  reset() {
    state.balance = START; state.wagered = 0; state.returned = 0;
    state.rounds = 0; state.recent = [];
    save(); emit('up');
  },
};

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/* ---------------- DOM helpers ---------------- */
/** el('div.foo#bar', {attrs}, ...children) */
export function el(spec, props, ...kids) {
  let tag = 'div', id = '', cls = [];
  const m = String(spec).match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
  if (m) {
    if (m[1]) tag = m[1];
    for (const t of (m[2] || '').match(/[.#][\w-]+/g) || []) {
      if (t[0] === '.') cls.push(t.slice(1)); else id = t.slice(1);
    }
  } else tag = spec;

  const node = document.createElement(tag);
  if (cls.length) node.className = cls.join(' ');
  if (id) node.id = id;

  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    kids.unshift(props); props = null;
  }
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'style' && typeof v === 'object') setStyle(node, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else node.setAttribute(k, v === true ? '' : v);
    }
  }
  add(node, kids);
  return node;
}
/* CSS custom properties must go through setProperty — assigning them onto
   `style` as plain keys is silently ignored. */
function setStyle(node, obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (k.startsWith('--')) node.style.setProperty(k, String(v));
    else node.style[k] = v;
  }
}
function add(node, kids) {
  for (const k of kids.flat(4)) {
    if (k == null || k === false) continue;
    node.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- toasts ---------------- */
export function toast(text, kind = '') {
  const host = document.getElementById('toasts');
  if (!host) return;
  const t = el('div.toast' + (kind ? '.' + kind : ''), { text });
  host.append(t);
  setTimeout(() => {
    t.style.transition = 'opacity .3s, transform .3s';
    t.style.opacity = '0'; t.style.transform = 'translateX(24px)';
    setTimeout(() => t.remove(), 320);
  }, 2600);
}
