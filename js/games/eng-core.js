/* Shared furniture for the 200 themed instant games.

   Every engine here follows the same contract: it receives the root node plus
   the catalogue entry for the *specific* variant being mounted, so the same
   code powers ten visually distinct games. Anything a variant can differ on —
   art, accent colour, the nouns on the buttons — arrives through `t`, never
   through a branch inside the engine.                                        */
import { el, fmt, rnd, rndInt, shuffle, sleep, wallet, round2 } from '../core.js';
import { msgLine } from '../ui.js';
import { play } from '../sound.js';

/** House edge shared by every engine, matching the rest of the site. */
export const EDGE = 0.99;

/** A fair multiplier for a 1-in-`odds` shot, with the house edge applied. */
export const fairMult = (odds) => round2(EDGE * odds);

/**
 * The scene every new game plays inside: the game's own Higgsfield key art as
 * a backdrop, with a dark scrim so foreground pieces stay readable on it.
 */
export function scene(t, ...kids) {
  const art = el('div.eng-art', {
    'aria-hidden': 'true',
    style: { backgroundImage: `url("art/scene/${t.id}.webp")` },
  });
  return el('div.eng-scene', { style: { '--accent': t.accent } },
    art, el('div.eng-scrim', { 'aria-hidden': 'true' }),
    el('div.eng-layer', {}, ...kids));
}

/** A read-out that sits over the scene — multiplier, step count, timer. */
export function readout(label, value = '—') {
  const v = el('div.eng-val', {}, value);
  const node = el('div.eng-readout', {}, el('div.eng-lab', {}, label), v);
  return { node, set: (x) => { v.textContent = x; }, el: v };
}

/** Horizontal strip of past results, newest first. */
export function historyRow() {
  const node = el('div.history');
  const items = [];
  return {
    node,
    push(text, kind) {
      items.unshift({ text, kind });
      items.length = Math.min(items.length, 14);
      node.replaceChildren(...items.map((i) => el('span.hist-chip' + (i.kind ? '.' + i.kind : ''), {}, i.text)));
    },
  };
}

/**
 * A ladder of multipliers for "advance or cash out" games.
 *
 * Each step survives with probability `p`, so the fair multiplier after n
 * steps is (1/p)^n. Applying the edge once at the end — rather than per step —
 * keeps the advertised RTP flat across the ladder instead of punishing players
 * who go deep.
 */
export function ladderMults(steps, p) {
  const out = [];
  for (let i = 1; i <= steps; i++) out.push(round2(EDGE * Math.pow(1 / p, i)));
  return out;
}

/** Pick `k` distinct indices below `n`, unbiased. */
export function pickDistinct(n, k) {
  const all = shuffle([...Array(n).keys()]);
  return new Set(all.slice(0, k));
}

/** Settle a round: pay, narrate and log. `payout` is total returned, not profit. */
export function settle({ id, stake, payout, msg, winLabel, loseLabel }) {
  if (payout > 0) wallet.pay(payout);
  if (payout > stake) msg.win(payout - stake, winLabel || 'WIN', stake);
  else if (payout === stake) msg.push(`${winLabel || 'PUSH'} — stake returned`);
  else if (payout > 0) msg.set(`Returned ${fmt(payout)} of your ${fmt(stake)} stake`, 'push');
  else msg.lose(loseLabel || 'No win this round');
  wallet.logResult(id, stake, payout);
}

/** A row of choice buttons built from the variant's own vocabulary. */
export function choices(words, onPick, { cls = '' } = {}) {
  const row = el('div.eng-choices');
  const nodes = words.map((w, i) => {
    const b = el('button.eng-choice' + cls, { type: 'button' }, el('span', {}, w));
    b.addEventListener('click', () => onPick(i, b));
    row.append(b);
    return b;
  });
  return {
    node: row, nodes,
    select: (i) => nodes.forEach((n, j) => n.classList.toggle('on', i === j)),
    lock: (v) => nodes.forEach((n) => { n.disabled = v; }),
    reset: () => nodes.forEach((n) => { n.className = 'eng-choice' + cls; n.disabled = false; }),
  };
}

export { el, fmt, rnd, rndInt, shuffle, sleep, wallet, round2, msgLine, play };
