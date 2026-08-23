/* Nova Casino — procedural sound.
   Every effect is synthesised with the Web Audio API at runtime: oscillators,
   noise bursts and envelopes. Nothing is downloaded, so the whole sound design
   costs zero bytes and works offline.

   Browsers block audio until a user gesture, so the context stays suspended
   until the first interaction. */

const KEY = 'nova.sound.v1';
let ctx = null;
let master = null;
let enabled = true;
let unlocked = false;

try { enabled = localStorage.getItem(KEY) !== 'off'; } catch { /* ignore */ }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** Called on the first pointer/key event — browsers require a gesture. */
export function unlock() {
  if (unlocked) return;
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  unlocked = true;
}

export const sound = {
  get enabled() { return enabled; },
  toggle() {
    enabled = !enabled;
    try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* ignore */ }
    if (enabled) { unlock(); play('click'); }
    return enabled;
  },
};

/* ── synthesis helpers ─────────────────────────────────────── */
function env(node, { a = 0.004, d = 0.12, peak = 1, t0 = 0 } = {}) {
  const c = ac(), t = c.currentTime + t0;
  node.gain.cancelScheduledValues(t);
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  return t + a + d;
}

/** A single pitched blip. */
function tone(freq, { type = 'sine', dur = 0.12, peak = 0.6, t0 = 0, slideTo = null, q = null } = {}) {
  const c = ac(); if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  const t = c.currentTime + t0;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);

  let last = g;
  if (q) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = q;
    g.connect(f); last = f;
  }
  osc.connect(g); last.connect(master);
  const end = env(g, { d: dur, peak, t0 });
  osc.start(t); osc.stop(end + 0.02);
}

let noiseBuf = null;
function noise({ dur = 0.12, peak = 0.4, t0 = 0, hp = 0, lp = 12000 } = {}) {
  const c = ac(); if (!c) return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const g = c.createGain();
  const lpf = c.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = lp;
  const hpf = c.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = hp;
  src.connect(hpf); hpf.connect(lpf); lpf.connect(g); g.connect(master);
  const t = c.currentTime + t0;
  const end = env(g, { a: 0.002, d: dur, peak, t0 });
  src.start(t); src.stop(end + 0.02);
}

/* ── the kit ───────────────────────────────────────────────── */
const KIT = {
  click:      () => tone(620, { type: 'square', dur: 0.04, peak: 0.16, q: 2600 }),
  hover:      () => tone(880, { type: 'sine', dur: 0.03, peak: 0.06 }),

  /* felt games */
  cardDeal:   () => { noise({ dur: 0.09, peak: 0.3, hp: 1800, lp: 9000 }); },
  cardFlip:   () => { noise({ dur: 0.06, peak: 0.26, hp: 2400 }); tone(340, { dur: 0.05, peak: 0.1 }); },
  chip:       () => { tone(1500, { type: 'triangle', dur: 0.05, peak: 0.22 });
                      noise({ dur: 0.05, peak: 0.16, hp: 3000, t0: 0.01 }); },
  chipStack:  () => { for (let i = 0; i < 3; i++)
                        tone(1300 + i * 180, { type: 'triangle', dur: 0.05, peak: 0.14, t0: i * 0.045 }); },
  shuffle:    () => { for (let i = 0; i < 6; i++)
                        noise({ dur: 0.05, peak: 0.12, hp: 2200, t0: i * 0.05 }); },

  /* reels */
  reelTick:   () => tone(1100, { type: 'square', dur: 0.02, peak: 0.07, q: 3000 }),
  reelStop:   () => { tone(180, { type: 'sine', dur: 0.13, peak: 0.34, slideTo: 90 });
                      noise({ dur: 0.05, peak: 0.14, hp: 800 }); },

  /* wheels + dice */
  wheelTick:  () => tone(1700, { type: 'square', dur: 0.015, peak: 0.06 }),
  diceRoll:   () => { for (let i = 0; i < 5; i++)
                        noise({ dur: 0.05, peak: 0.2, hp: 1200, lp: 6000, t0: i * 0.06 }); },

  /* outcomes */
  winSmall:   () => { [660, 880].forEach((f, i) =>
                        tone(f, { type: 'triangle', dur: 0.16, peak: 0.3, t0: i * 0.07 })); },
  winBig:     () => { [523, 659, 784, 1047].forEach((f, i) =>
                        tone(f, { type: 'triangle', dur: 0.3, peak: 0.34, t0: i * 0.08 })); },
  winMega:    () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
                        tone(f, { type: 'sawtooth', dur: 0.45, peak: 0.22, t0: i * 0.075, q: 5000 }));
                      [1047, 1319].forEach((f, i) =>
                        tone(f, { type: 'sine', dur: 0.9, peak: 0.2, t0: 0.5 + i * 0.05 })); },
  lose:       () => { tone(300, { type: 'sawtooth', dur: 0.28, peak: 0.22, slideTo: 110, q: 1400 }); },
  cashout:    () => { [784, 1047, 1319].forEach((f, i) =>
                        tone(f, { type: 'sine', dur: 0.2, peak: 0.3, t0: i * 0.06 })); },
  coin:       () => { tone(1760, { type: 'triangle', dur: 0.1, peak: 0.22 });
                      tone(2637, { type: 'triangle', dur: 0.12, peak: 0.14, t0: 0.04 }); },

  /* instant games */
  gem:        () => tone(1400, { type: 'sine', dur: 0.14, peak: 0.26, slideTo: 2100 }),
  explode:    () => { noise({ dur: 0.4, peak: 0.5, lp: 1600 });
                      tone(90, { type: 'sawtooth', dur: 0.34, peak: 0.4, slideTo: 40 }); },
  tickUp:     () => tone(700, { type: 'square', dur: 0.02, peak: 0.05 }),
  whoosh:     () => noise({ dur: 0.3, peak: 0.2, hp: 400, lp: 3000 }),
};

/** Fire an effect by name. Silent when muted or before the first gesture. */
export function play(name) {
  if (!enabled || !unlocked) return;
  const c = ac();
  if (!c || c.state !== 'running') return;
  try { KIT[name]?.(); } catch { /* never let audio break a game */ }
}

/** A repeating tick used while reels/wheels are in motion. */
export function ticker(name = 'reelTick', everyMs = 90) {
  if (!enabled || !unlocked) return () => {};
  const t = setInterval(() => play(name), everyMs);
  return () => clearInterval(t);
}

/* first gesture unlocks audio (guarded so the module also imports under Node,
   which the RTP tooling relies on) */
if (typeof addEventListener === 'function') {
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
    addEventListener(ev, unlock, { once: true, passive: true });
  }
}
