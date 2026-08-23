/* Shared building blocks every game reuses: bet controls, playing cards, message line. */
import { el, fmt, round2, wallet, shuffle, rndInt, toast } from './core.js';
import { celebrate, coinBurst, loseFx, shake } from './fx.js';

/* ---------------- bet control ---------------- */
/**
 * Bet stepper + quick buttons + primary action button.
 * Returns { node, get value, set value, lock(), unlock(), action, setAction }.
 */
export function betPanel({ min = 1, max = 5000, start = 10, label = 'BET', action = 'PLAY',
                           actionClass = 'btn-gold', onAction, extra = [] } = {}) {
  let value = clampBet(start, min, max);

  const input = el('input', { type: 'text', inputmode: 'decimal', value: fmt(value) });
  const sync = () => { input.value = fmt(value); readout.textContent = ''; };

  const setValue = (v) => { value = clampBet(v, min, max); sync(); };

  input.addEventListener('change', () => setValue(parseFloat(input.value.replace(/,/g, '')) || min));
  input.addEventListener('blur', sync);

  const stepper = el('div.stepper', {},
    el('button', { type: 'button', title: 'Halve', onclick: () => setValue(value / 2) }, '½'),
    input,
    el('button', { type: 'button', title: 'Double', onclick: () => setValue(value * 2) }, '2×'));

  const quick = el('div.quick', {},
    [1, 5, 25, 100, 500].map((v) =>
      el('button', { type: 'button', onclick: () => setValue(v) }, v)),
    el('button', { type: 'button', onclick: () => setValue(wallet.balance) }, 'MAX'));

  const readout = el('div.readout');
  const actionBtn = el('button.btn.' + actionClass + '.btn-lg', { type: 'button' }, action);
  actionBtn.addEventListener('click', () => onAction && onAction(value));

  const node = el('div.betbar', {},
    el('div.field', {}, el('label', {}, label), stepper),
    el('div.field', {}, el('label', {}, 'QUICK'), quick),
    extra,
    el('div.spacer', {}, readout),
    actionBtn);

  return {
    node, readout, actionBtn,
    get value() { return value; },
    set value(v) { setValue(v); },
    setAction(txt, cls) {
      actionBtn.textContent = txt;
      if (cls) actionBtn.className = 'btn ' + cls + ' btn-lg';
    },
    lock() { actionBtn.disabled = true; node.querySelectorAll('.stepper button,.quick button').forEach((b) => (b.disabled = true)); input.disabled = true; },
    unlock() { actionBtn.disabled = false; node.querySelectorAll('.stepper button,.quick button').forEach((b) => (b.disabled = false)); input.disabled = false; },
    /** Take the stake; shows a toast and returns false when the balance is short. */
    take() {
      if (!wallet.bet(value)) { toast('Not enough credits — use + Credits.', 'lose'); return false; }
      return true;
    },
  };
}
const clampBet = (v, min, max) => {
  v = round2(Number(v) || min);
  return Math.min(max, Math.max(min, v));
};

/* ---------------- message line ---------------- */
/**
 * Result line shared by all 56 games. Wiring the FX here means every game gets
 * celebration/loss feedback without each one re-implementing it — while each
 * game still keeps its own themed stage and bespoke animations.
 */
export function msgLine() {
  const node = el('div.msg');
  const stage = () => node.closest('.stage');
  return {
    node,
    set(text, kind = '', big = false) {
      node.className = 'msg' + (kind ? ' ' + kind : '') + (big ? ' big' : '');
      node.textContent = text;
    },
    clear() { node.className = 'msg'; node.textContent = ''; },
    /** @param {number} amount net win  @param {number} [stake] enables the tiered celebration */
    win(amount, prefix = 'WIN', stake = 0) {
      // Guard: a payout at or below the stake is not a win. Dressing one up as
      // "WIN" is the classic losses-disguised-as-wins pattern, so say plainly
      // what came back instead.
      if (amount < 0) return this.set(`Returned $${fmt(stake + amount)} of your $${fmt(stake)} stake`, 'push');
      if (amount === 0) return this.push('PUSH — stake returned');
      this.set(`${prefix} +$${fmt(amount)}`, 'win', true);
      const mult = stake > 0 ? (amount + stake) / stake : 0;
      if (mult >= 3) celebrate(stage(), amount + stake, mult);
      else coinBurst(node, 12);
    },
    lose(text = 'No win') { this.set(text, 'lose'); loseFx(stage()); },
    push(text = 'PUSH — stake returned') { this.set(text, 'push'); },
  };
}

/* ---------------- playing cards ---------------- */
export const SUITS = [
  { s: '♠', name: 'spades', red: false },
  { s: '♥', name: 'hearts', red: true },
  { s: '♦', name: 'diamonds', red: true },
  { s: '♣', name: 'clubs', red: false },
];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** Build a shuffled shoe of `decks` standard 52-card decks. */
export function newShoe(decks = 1, withJokers = 0) {
  const cards = [];
  for (let d = 0; d < decks; d++)
    for (const suit of SUITS)
      for (let r = 0; r < RANKS.length; r++)
        cards.push({ r: RANKS[r], v: r + 1, suit: suit.s, red: suit.red });
  for (let j = 0; j < withJokers; j++) cards.push({ r: 'JOKER', v: 0, suit: '★', red: false, joker: true });
  return shuffle(cards);
}
export function draw(shoe, decks = 1, jokers = 0) {
  if (!shoe.length) shoe.push(...newShoe(decks, jokers));
  return shoe.pop();
}

/** Render one card. `card === null` draws a face-down back. */
export function cardEl(card, opts = {}) {
  if (!card) return el('div.pcard.back');
  const node = el('div.pcard' + (card.red ? '.red' : '') + (opts.sel ? '.sel' : ''), {},
    el('div.r', {}, card.joker ? 'JK' : card.r),
    el('div.mid', {}, card.suit),
    el('div.s', {}, card.suit));
  return node;
}
export function renderCards(container, cards, opts = {}) {
  container.replaceChildren(...cards.map((c) => cardEl(c, opts)));
  return container;
}

/* Poker hand evaluation shared by video poker + stud games.
   Returns { rank, name } where rank 0 = high card ... 9 = royal flush. */
export const HAND_NAMES = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
  'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'];

export function evalPoker(cards) {
  const vals = cards.map((c) => (c.v === 1 ? 14 : c.v)).sort((a, b) => a - b);
  const suits = cards.map((c) => c.suit);
  const counts = {};
  for (const v of vals) counts[v] = (counts[v] || 0) + 1;
  const groups = Object.entries(counts).map(([v, n]) => ({ v: +v, n }))
    .sort((a, b) => b.n - a.n || b.v - a.v);

  const flush = cards.length === 5 && suits.every((s) => s === suits[0]);
  const uniq = [...new Set(vals)];
  let straight = uniq.length === 5 && uniq[4] - uniq[0] === 4;
  let highStraight = uniq[4];
  if (!straight && uniq.length === 5 && uniq.join() === '2,3,4,5,14') { straight = true; highStraight = 5; }

  let rank;
  if (straight && flush) rank = highStraight === 14 ? 9 : 8;
  else if (groups[0].n === 4) rank = 7;
  else if (groups[0].n === 3 && groups[1] && groups[1].n === 2) rank = 6;
  else if (flush) rank = 5;
  else if (straight) rank = 4;
  else if (groups[0].n === 3) rank = 3;
  else if (groups[0].n === 2 && groups[1] && groups[1].n === 2) rank = 2;
  else if (groups[0].n === 2) rank = 1;
  else rank = 0;

  return { rank, name: HAND_NAMES[rank], groups, high: groups[0].v, straight, flush, vals };
}

/** Compare two evaluated hands. > 0 means a wins. */
export function cmpPoker(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.min(a.groups.length, b.groups.length); i++) {
    if (a.groups[i].n !== b.groups[i].n) return b.groups[i].n - a.groups[i].n;
    if (a.groups[i].v !== b.groups[i].v) return a.groups[i].v - b.groups[i].v;
  }
  return 0;
}

/* ---------------- misc ---------------- */
export function rules(title, ...lines) {
  return el('div.rules', {}, el('h4', {}, title), ...lines.map((l) => el('div', { html: l })));
}
export function optGrid(options, onPick) {
  const wrap = el('div.optgrid');
  options.forEach((o) => {
    const b = el('button.opt', { type: 'button', dataset: { key: o.key } },
      o.label, o.sub ? el('small', {}, o.sub) : null);
    b.addEventListener('click', () => {
      [...wrap.children].forEach((c) => c.classList.remove('on'));
      b.classList.add('on');
      onPick(o.key, o);
    });
    wrap.append(b);
  });
  if (options.length) wrap.firstChild.classList.add('on');
  return wrap;
}
export const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
export const rollDie = () => rndInt(6) + 1;
