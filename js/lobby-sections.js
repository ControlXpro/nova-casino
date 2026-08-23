/* Main-page furniture: daily bonus, promotions, tournaments and the
   simulated big-win leaderboard. */
import { el, clear, fmt, rnd, rndInt, pick, wallet, toast } from './core.js';
import { leaderboard, randomNames, randomFlag } from './players.js';
import { play } from './sound.js';

/* ── daily bonus ─────────────────────────────────────────── */
export function dailyBonusCard(onClaim) {
  const d = wallet.daily;
  const days = [500, 750, 1000, 1500, 2000, 3000, 5000];

  const track = el('div.bonus-track', {},
    days.map((amt, i) => {
      const done = i < d.streak % 7;
      const isNext = i === (d.day - 1);
      return el('div.bonus-day' + (done ? '.done' : '') + (isNext && d.available ? '.next' : ''), {},
        el('span.bd-n', {}, 'Day ' + (i + 1)),
        el('span.bd-amt', {}, '$' + fmt(amt).replace('.00', '')),
        done ? el('span.bd-tick', {}, '✓') : null);
    }));

  const btn = el('button.btn.btn-gold.btn-block', { type: 'button' },
    d.available ? `CLAIM $${fmt(d.amount).replace('.00', '')}` : 'CLAIMED TODAY');
  btn.disabled = !d.available;
  btn.addEventListener('click', () => {
    const got = wallet.claimDaily();
    if (got) {
      play('cashout');
      toast(`Daily bonus claimed: +${fmt(got)} play credits.`, 'win');
      onClaim?.();
    }
  });

  return el('div.panel.bonus-panel', {},
    el('div.panel-head', {},
      el('h3', {}, '🎁 Daily bonus'),
      el('span.panel-tag', {}, d.streak > 0 ? `${d.streak} day streak` : 'Start your streak')),
    track,
    btn,
    el('p.panel-note', {}, 'One claim per day. Miss a day and the streak restarts. Play credits only — they have no cash value.'));
}

/* ── promotions ──────────────────────────────────────────── */
const PROMOS = [
  { icon: '🎁', title: 'Welcome package', sub: '10,000 credits on sign-up',
    body: 'Every new account starts with a full stack. Reset any time from the sidebar.',
    tint: 'linear-gradient(140deg,#1f6dff33,transparent)' },
  { icon: '⚡', title: 'Instant top-up', sub: 'Free credits, always',
    body: 'Out of credits? Hit + in the header. There is nothing to buy — the balance is play money by design.',
    tint: 'linear-gradient(140deg,#ffc53133,transparent)' },
  { icon: '🏅', title: 'Streak rewards', sub: 'Up to 5,000 a day',
    body: 'Claim seven days running and the daily bonus climbs from 500 to 5,000 credits.',
    tint: 'linear-gradient(140deg,#2ee06a33,transparent)' },
  { icon: '🎲', title: 'Try every table', sub: '106 games unlocked',
    body: 'Nothing is gated, nothing is locked behind a deposit. The whole floor is open from minute one.',
    tint: 'linear-gradient(140deg,#8b5cf633,transparent)' },
];

export function promoCards(onGo) {
  return el('div.promo-grid', {}, PROMOS.map((p) =>
    el('div.promo-card', { style: { background: p.tint } },
      el('div.pc-icon', { 'aria-hidden': 'true' }, p.icon),
      el('div.pc-title', {}, p.title),
      el('div.pc-sub', {}, p.sub),
      el('p.pc-body', {}, p.body))));
}

/* ── tournaments ─────────────────────────────────────────── */
const TOURNEYS = [
  { id: 'reel', name: 'Reel Racer', icon: '🎰', pool: 250000, cat: 'slots',
    blurb: 'Highest single-spin multiplier across all 58 slots.' },
  { id: 'table', name: 'High Roller Tables', icon: '🃏', pool: 120000, cat: 'table',
    blurb: 'Biggest net win on blackjack, roulette and baccarat.' },
  { id: 'instant', name: 'Crash Clash', icon: '🚀', pool: 80000, cat: 'instant',
    blurb: 'Best cash-out multiplier on Crash, Limbo and Mines.' },
];

/** A stable-per-day countdown so the timer doesn't jump between renders. */
function endOfDay() {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}
function fmtLeft(ms) {
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function tournaments(onGo) {
  const wrap = el('div.tourney-grid');
  const timers = [];

  for (const t of TOURNEYS) {
    const clock = el('span.tv-clock.mono', {}, '--:--:--');
    const board = el('div.tv-board', {},
      randomNames(3).map((n, i) =>
        el('div.tv-row', {},
          el('span.tv-pos', {}, '#' + (i + 1)),
          el('span.tv-flag', { 'aria-hidden': 'true' }, randomFlag()),
          el('span.tv-name', {}, n),
          el('b.tv-pts', {}, fmt((3 - i) * (900 + rndInt(1800))).replace('.00', ' pts')))));

    const card = el('div.tourney', {},
      el('div.tv-top', {},
        el('span.tv-icon', { 'aria-hidden': 'true' }, t.icon),
        el('div', {}, el('div.tv-name-main', {}, t.name),
          el('div.tv-blurb', {}, t.blurb)),
        el('div.tv-pool', {}, el('span', {}, 'Prize pool'), el('b', {}, fmt(t.pool).replace('.00', '') + ' cr'))),
      el('div.tv-meta', {}, el('span', {}, 'Ends in'), clock, el('span.sim-tag', {}, 'SIMULATED')),
      board,
      el('button.btn.btn-brand.btn-block', { type: 'button', onclick: () => onGo(t.cat) }, 'Play ' + t.cat));
    wrap.append(card);

    const tick = () => { clock.textContent = fmtLeft(endOfDay() - Date.now()); };
    tick();
    timers.push(setInterval(tick, 1000));
  }

  wrap.stop = () => timers.forEach(clearInterval);
  return wrap;
}

/* ── simulated big-win board ─────────────────────────────── */
export function bigWinBoard(games, onGo) {
  const body = el('div.board-body');
  const rows = leaderboard(games, 8);

  rows.forEach((r, i) => {
    const row = el('button.board-row', { type: 'button', onclick: () => onGo(r.gameId) },
      el('span.br-pos' + (i < 3 ? '.top' : ''), {}, i + 1),
      el('span.br-flag', { 'aria-hidden': 'true' }, r.flag),
      el('span.br-name', {}, r.name),
      el('span.br-game', {}, r.game),
      el('span.br-mult', {}, r.mult.toFixed(2) + '×'),
      el('b.br-win', {}, '$' + fmt(r.win)));
    body.append(row);
  });

  return el('div.panel.board-panel', {},
    el('div.panel-head', {},
      el('h3', {}, '🏆 Biggest wins today'),
      el('span.sim-tag', {}, 'SIMULATED')),
    body,
    el('p.panel-note', {},
      'These names and results are generated in your browser for atmosphere — they are not real players and not real results. Your own wins appear in the strip at the top of the lobby.'));
}
