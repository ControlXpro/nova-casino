/* Nova Casino — effects layer.
   Particle bursts, win overlays, counters, shakes and ripples.
   Built on the Web Animations API so everything runs on transform/opacity
   (compositor-friendly, no layout thrash). Honours prefers-reduced-motion. */
import { el, fmt, rnd, rndInt, pick } from './core.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* one shared fixed layer for all particles */
let layer = null;
function fxLayer() {
  if (!layer) {
    layer = el('div.fx-layer', { 'aria-hidden': 'true' });
    document.body.append(layer);
  }
  return layer;
}
const centerOf = (node) => {
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
};

/**
 * Remove `node` once `anim` ends — with a hard timer fallback.
 * In a backgrounded tab the compositor is throttled and `anim.finished` may
 * never settle, which would otherwise leak every particle we ever spawned.
 */
function cleanUp(node, anim, maxMs) {
  let done = false;
  const kill = () => { if (!done) { done = true; node.remove(); } };
  anim.finished.then(kill, kill);
  setTimeout(kill, maxMs + 400);
}

/* ── particle bursts ─────────────────────────────────────── */
const COINS = ['🪙', '💰', '💎', '✨', '⭐'];
const CONFETTI = ['#ffc531', '#1f6dff', '#2ee06a', '#ff4d6a', '#8b5cf6', '#3ad8ff'];

/** Coins and sparkles erupting from an element. */
export function coinBurst(anchor, count = 22) {
  if (reduced() || !anchor?.isConnected) return;
  const { x, y } = centerOf(anchor);
  const host = fxLayer();
  for (let i = 0; i < count; i++) {
    const p = el('span.fx-coin', {}, pick(COINS));
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.fontSize = 13 + rndInt(16) + 'px';
    host.append(p);

    const ang = (-Math.PI / 2) + (rnd() - 0.5) * 2.2;
    const dist = 90 + rnd() * 190;
    const dx = Math.cos(ang) * dist;
    const peak = -Math.abs(Math.sin(ang) * dist) - 40;
    const dur = 780 + rnd() * 620;

    const a = p.animate([
      { transform: 'translate(-50%,-50%) translate(0,0) rotate(0deg) scale(.4)', opacity: 0 },
      { transform: `translate(-50%,-50%) translate(${dx * .5}px,${peak}px) rotate(${rnd() * 240 - 120}deg) scale(1)`, opacity: 1, offset: .32 },
      { transform: `translate(-50%,-50%) translate(${dx}px,${170 + rnd() * 90}px) rotate(${rnd() * 520 - 260}deg) scale(.85)`, opacity: 0 },
    ], { duration: dur, easing: 'cubic-bezier(.25,.6,.4,1)' });
    cleanUp(p, a, dur);
  }
}

/** Paper confetti raining from the top of an element's box. */
export function confetti(anchor, count = 46) {
  if (reduced() || !anchor?.isConnected) return;
  const { r } = centerOf(anchor);
  const host = fxLayer();
  for (let i = 0; i < count; i++) {
    const p = el('span.fx-conf');
    const w = 5 + rndInt(6);
    p.style.cssText += `left:${r.left + rnd() * r.width}px;top:${r.top - 12}px;
      width:${w}px;height:${w * (1 + rnd())}px;background:${pick(CONFETTI)};
      border-radius:${rnd() > .5 ? '50%' : '2px'}`;
    host.append(p);
    const dur = 1500 + rnd() * 1100, delay = rnd() * 260;
    const a = p.animate([
      { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${(rnd() - .5) * 190}px, ${r.height + 190}px) rotate(${rnd() * 900 - 450}deg)`, opacity: 0 },
    ], { duration: dur, easing: 'cubic-bezier(.2,.6,.5,1)', delay });
    cleanUp(p, a, dur + delay);
  }
}

/* ── shake ───────────────────────────────────────────────── */
export function shake(node, strength = 8) {
  if (reduced() || !node) return;
  node.animate([
    { transform: 'translateX(0)' }, { transform: `translateX(${-strength}px)` },
    { transform: `translateX(${strength * .8}px)` }, { transform: `translateX(${-strength * .5}px)` },
    { transform: `translateX(${strength * .3}px)` }, { transform: 'translateX(0)' },
  ], { duration: 400, easing: 'ease-out' });
}

/* ── number count-up ─────────────────────────────────────── */
export function countUp(node, to, { from = 0, ms = 800, prefix = '', suffix = '' } = {}) {
  if (!node) return;
  if (reduced()) { node.textContent = prefix + fmt(to) + suffix; return; }
  const t0 = performance.now();
  let settled = false;
  const finish = () => { if (!settled) { settled = true; node.textContent = prefix + fmt(to) + suffix; } };
  const step = (now) => {
    if (settled) return;
    const t = Math.min(1, (now - t0) / ms);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = prefix + fmt(from + (to - from) * eased) + suffix;
    if (t < 1) requestAnimationFrame(step); else settled = true;
  };
  requestAnimationFrame(step);
  setTimeout(finish, ms + 250);   // rAF is throttled in background tabs
}

/* ── big-win overlay ─────────────────────────────────────── */
const TIERS = [
  { at: 50, label: 'LEGENDARY WIN', cls: 'legendary', conf: 120, coins: 60 },
  { at: 20, label: 'MEGA WIN', cls: 'mega', conf: 90, coins: 44 },
  { at: 8, label: 'BIG WIN', cls: 'big', conf: 60, coins: 30 },
  { at: 3, label: 'NICE WIN', cls: 'nice', conf: 0, coins: 20 },
];

/**
 * Full-stage celebration. `mult` decides the tier; anything under 3x
 * just gets a coin puff so ordinary wins do not feel spammy.
 */
export function celebrate(stage, amount, mult) {
  if (!stage?.isConnected) return;
  const tier = TIERS.find((t) => mult >= t.at);
  if (!tier) { coinBurst(stage, 10); return; }

  coinBurst(stage, tier.coins);
  if (tier.conf) confetti(stage, tier.conf);

  const amt = el('div.wb-amount', {}, '0.00');
  const card = el('div.wb-card', {},
    el('div.wb-rays', { 'aria-hidden': 'true' }),
    el('div.wb-label', {}, tier.label),
    amt,
    el('div.wb-mult', {}, `${mult.toFixed(2)}× your stake`));
  const wrap = el('div.winbar.' + tier.cls, { role: 'status' }, card);
  stage.append(wrap);

  countUp(amt, amount, { ms: reduced() ? 0 : 900, prefix: '$' });

  const hold = tier.at >= 20 ? 2600 : 1900;
  setTimeout(() => {
    const a = wrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-in' });
    cleanUp(wrap, a, 320);
  }, hold);
}

/* ── press ripple (delegated, applies to every .btn) ─────── */
export function installRipple() {
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest?.('.btn, .opt, .tile, .chip-btn, .card');
    if (!btn || btn.disabled || reduced()) return;
    const r = btn.getBoundingClientRect();
    const ink = el('span.ink');
    const size = Math.max(r.width, r.height) * 2.2;
    ink.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left}px;top:${e.clientY - r.top}px`;
    const pos = getComputedStyle(btn).position;
    if (pos === 'static') btn.style.position = 'relative';
    btn.append(ink);
    const a = ink.animate([
      { transform: 'translate(-50%,-50%) scale(0)', opacity: .5 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 },
    ], { duration: 560, easing: 'cubic-bezier(.2,.7,.3,1)' });
    cleanUp(ink, a, 560);
  }, { passive: true });
}

/* ── loss feedback ───────────────────────────────────────── */
export function loseFx(stage) {
  if (!stage || reduced()) return;
  shake(stage, 5);
  stage.animate([
    { boxShadow: '0 0 0 0 rgba(255,77,106,0)' },
    { boxShadow: '0 0 0 3px rgba(255,77,106,.42)' },
    { boxShadow: '0 0 0 0 rgba(255,77,106,0)' },
  ], { duration: 520, easing: 'ease-out' });
}
