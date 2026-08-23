/* Casino table furniture: felt surfaces, betting spots, chip stacks and
   cards laid out on the layout the way they sit on a real table.
   Used by blackjack, baccarat, the stud games, war and red dog. */
import { el, fmt } from './core.js';
import { cardEl } from './ui.js';

/* ── chips ────────────────────────────────────────────────── */
/* Standard US casino denominations and their conventional colours. */
export const DENOMS = [
  { v: 5000, cls: 'd5000', label: '5K' },
  { v: 1000, cls: 'd1000', label: '1K' },
  { v: 500, cls: 'd500', label: '500' },
  { v: 100, cls: 'd100', label: '100' },
  { v: 25, cls: 'd25', label: '25' },
  { v: 5, cls: 'd5', label: '5' },
  { v: 1, cls: 'd1', label: '1' },
];

export function chipEl(denom, i = 0) {
  return el('div.chipx.' + denom.cls, {
    style: { '--i': i },
    'aria-hidden': 'true',
  }, el('span', {}, denom.label));
}

/**
 * Break `amount` into real denominations and stack them, biggest at the
 * bottom. Caps the visible pile so a huge bet does not grow off the table.
 */
export function chipStack(amount, cap = 7) {
  const wrap = el('div.chipstack');
  if (!amount || amount <= 0) return wrap;

  let left = Math.round(amount);
  const chips = [];
  for (const d of DENOMS) {
    while (left >= d.v && chips.length < 40) { chips.push(d); left -= d.v; }
  }
  if (!chips.length) chips.push(DENOMS[DENOMS.length - 1]);

  const shown = chips.slice(0, cap);
  shown.forEach((d, i) => wrap.append(chipEl(d, shown.length - 1 - i)));
  wrap.append(el('div.chip-val', {}, '$' + fmt(amount)));
  if (chips.length > cap) wrap.append(el('div.chip-more', {}, `+${chips.length - cap}`));
  wrap.style.setProperty('--stack', shown.length);
  return wrap;
}

/* ── betting spot ─────────────────────────────────────────── */
/**
 * A circle painted on the felt. `onPick` makes it selectable (baccarat,
 * side bets); leave it out for a plain display spot (blackjack main bet).
 */
export function spot(label, { sub = '', onPick = null, key = '' } = {}) {
  const stack = el('div.spot-chips');
  const node = el(onPick ? 'button.felt-spot' : 'div.felt-spot', {
    type: onPick ? 'button' : null,
    dataset: { key },
  }, stack, el('div.spot-label', {}, label), sub ? el('div.spot-sub', {}, sub) : null);
  if (onPick) node.addEventListener('click', () => onPick(key));
  node.setStack = (amount) => { stack.replaceChildren(amount > 0 ? chipStack(amount) : ''); };
  return node;
}

/* ── cards on the layout ──────────────────────────────────── */
/**
 * Lay cards out overlapping and slightly fanned, like a dealt hand pushed
 * across the felt. `cards` may contain nulls for face-down cards.
 */
export function layCards(container, cards, { fan = true } = {}) {
  const n = cards.length;
  container.replaceChildren(...cards.map((c, i) => {
    const node = cardEl(c);
    if (fan && n > 1) {
      const mid = (n - 1) / 2;
      node.style.setProperty('--rot', ((i - mid) * 3.4).toFixed(2) + 'deg');
      node.style.setProperty('--lift', (Math.abs(i - mid) * 2).toFixed(1) + 'px');
    }
    node.style.setProperty('--i', i);
    return node;
  }));
  return container;
}

/* ── the table itself ─────────────────────────────────────── */
/**
 * feltTable({ tone, print, shoe }) → a felt surface with a wooden rail,
 * optional printed rules arc and a dealing shoe in the corner.
 * Append your seats/spots to the returned `.surface`.
 */
export function feltTable({ tone = 152, print = [], shoe = true, discard = false } = {}) {
  const surface = el('div.felt-surface');
  const table = el('div.felt-table', { style: { '--felt-h': tone } },
    el('div.felt-inner', {},
      print.length ? el('div.felt-print', {}, print.map((p, i) =>
        el('div', { class: i === 0 ? 'fp-main' : 'fp-sub' }, p))) : null,
      surface));
  if (shoe) table.append(el('div.felt-shoe', { 'aria-hidden': 'true', title: 'Dealing shoe' },
    el('span.shoe-lid'), el('span.shoe-card')));
  if (discard) table.append(el('div.felt-discard', { 'aria-hidden': 'true', title: 'Discard tray' }));
  table.surface = surface;
  return table;
}

/** A named seat: a card landing zone plus a value badge. */
export function seat(label, { badge = true } = {}) {
  const cards = el('div.seat-cards');
  const val = el('div.seat-badge', { hidden: true });
  const node = el('div.felt-seat', {},
    el('div.seat-name', {}, label), cards, badge ? val : null);
  node.cards = cards;
  node.setBadge = (text, kind = '') => {
    val.hidden = text == null || text === '';
    val.textContent = text ?? '';
    val.className = 'seat-badge' + (kind ? ' ' + kind : '');
  };
  return node;
}
