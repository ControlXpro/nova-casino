/* Table & lottery games: European + American roulette, sic bo, craps, keno, bingo. */
import { el, clear, fmt, sleep, rndInt, shuffle, wallet, round2, toast } from '../core.js';
import { betPanel, msgLine, rules, optGrid, DICE_FACES, rollDie } from '../ui.js';
import { play, ticker } from '../sound.js';

const G = (o) => o;

/* ============================================================ ROULETTE */
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const EU_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const US_ORDER = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];

const colorOf = (n) => (n === 0 || n === '00' ? 'green' : RED.has(n) ? 'red' : 'black');

function roulette({ id, order, american, laPartage = false, lightning = false }) {
  return function mount(root) {
    const bets = new Map();
    let spinning = false, rotation = 0;
    const history = [];

    /* --- wheel --- */
    const seg = 360 / order.length;
    const stops = order.map((n, i) => {
      const c = colorOf(n) === 'red' ? '#b3243c' : colorOf(n) === 'green' ? '#177a4a' : '#1c1c28';
      return `${c} ${(i * seg).toFixed(3)}deg ${((i + 1) * seg).toFixed(3)}deg`;
    }).join(',');
    const inner = el('div.wheel-inner', { style: { background: `conic-gradient(${stops})` } });
    const hub = el('div.wheel-hub', {}, '—');
    const ball = el('div.wheel-ball');
    const wheel = el('div.wheel', {}, el('div.wheel-ptr', {}, '▼'), inner, hub, ball);
    let ballTurns = 0;

    /* --- board --- */
    const board = el('div.rt-board');
    const chipFor = (key) => {
      const amt = bets.get(key);
      return amt ? el('span.chip', {}, fmt(amt).replace('.00', '')) : null;
    };
    const cells = new Map();
    function cell(n, extraCls = '') {
      const c = el('div.rn.' + colorOf(n) + extraCls, { dataset: { k: 'n:' + n } }, String(n));
      c.addEventListener('click', () => place('n:' + n));
      cells.set('n:' + n, c);
      return c;
    }
    if (american) {
      // 0 and 00 share a full-width header row above the 12x3 number block
      board.style.gridTemplateColumns = 'repeat(12, minmax(28px,1fr))';
      const z = cell(0), dz = cell('00');
      z.style.gridColumn = 'span 6'; dz.style.gridColumn = 'span 6';
      board.append(z, dz);
    } else {
      // single zero sits to the left, spanning all three rows
      const zero = cell(0);
      zero.style.gridRow = 'span 3';
      zero.style.height = 'auto';
      board.append(zero);
    }
    // rows: top 3,6..36 / mid 2,5..35 / bottom 1,4..34
    for (const startN of [3, 2, 1]) {
      for (let i = 0; i < 12; i++) board.append(cell(startN + i * 3));
    }

    const OUTSIDE = [
      { k: 'd1', label: '1st 12', pay: 3 }, { k: 'd2', label: '2nd 12', pay: 3 }, { k: 'd3', label: '3rd 12', pay: 3 },
      { k: 'low', label: '1–18', pay: 2 }, { k: 'even', label: 'EVEN', pay: 2 },
      { k: 'red', label: '🔴 RED', pay: 2 }, { k: 'black', label: '⚫ BLACK', pay: 2 },
      { k: 'odd', label: 'ODD', pay: 2 }, { k: 'high', label: '19–36', pay: 2 },
      { k: 'c1', label: 'Col 1', pay: 3 }, { k: 'c2', label: 'Col 2', pay: 3 }, { k: 'c3', label: 'Col 3', pay: 3 },
    ];
    const outside = el('div.rt-outside');
    for (const o of OUTSIDE) {
      const b = el('button.ob', { type: 'button' }, o.label);
      b.addEventListener('click', () => place(o.k));
      cells.set(o.k, b);
      outside.append(b);
    }

    const msg = msgLine();
    const histRow = el('div.history');
    const totalOut = el('div.readout');
    const luckyRow = el('div.lucky-row');
    let lucky = new Map();          // number -> multiplier, lightning only

    function rollLucky() {
      lucky = new Map();
      if (!lightning) return;
      const pool = shuffle(order.filter((n) => n !== 0 && n !== '00'));
      const n = 1 + rndInt(5);
      const mults = [50, 100, 150, 200, 300, 400, 500];
      for (let i = 0; i < n; i++) lucky.set(pool[i], mults[rndInt(mults.length)]);
      clear(luckyRow);
      luckyRow.append(el('span.lucky-tag', {}, 'LUCKY NUMBERS'));
      for (const [num, m] of lucky) luckyRow.append(el('div.lucky', {}, `${num}`, el('b', {}, `${m}x`)));
    }

    const bp = betPanel({
      start: 5, min: 1, max: 500, label: 'CHIP', action: 'SPIN', onAction: spin,
      extra: [el('div.field', {}, el('label', {}, 'BOARD'),
        el('div.quick', {},
          el('button', { type: 'button', onclick: clearBets }, 'CLEAR'),
          el('button', { type: 'button', onclick: rebet }, 'REBET')))],
    });

    let lastBets = null;
    function place(key) {
      if (spinning) return;
      play('chip');
      const chip = bp.value;
      if (!wallet.bet(chip)) { toast('Not enough credits.', 'lose'); return; }
      bets.set(key, round2((bets.get(key) || 0) + chip));
      paintChips();
    }
    function clearBets() {
      if (spinning) return;
      let sum = 0; for (const v of bets.values()) sum += v;
      if (sum) wallet.refund(sum);
      bets.clear(); paintChips();
    }
    function rebet() {
      if (spinning || !lastBets) return;
      let sum = 0; for (const v of lastBets.values()) sum += v;
      if (!wallet.bet(sum)) { toast('Not enough credits.', 'lose'); return; }
      bets.clear();
      for (const [k, v] of lastBets) bets.set(k, v);
      paintChips();
    }
    function paintChips() {
      for (const [k, node] of cells) {
        node.querySelector('.chip')?.remove();
        const c = chipFor(k);
        if (c) node.append(c);
      }
      let sum = 0; for (const v of bets.values()) sum += v;
      totalOut.innerHTML = `on the table <b>${fmt(sum)}</b> across ${bets.size} spot${bets.size === 1 ? '' : 's'}`;
    }

    function wins(key, n) {
      if (key.startsWith('n:')) return key.slice(2) === String(n);
      if (n === 0 || n === '00') return false;
      switch (key) {
        case 'red': return RED.has(n);
        case 'black': return !RED.has(n);
        case 'odd': return n % 2 === 1;
        case 'even': return n % 2 === 0;
        case 'low': return n <= 18;
        case 'high': return n >= 19;
        case 'd1': return n <= 12;
        case 'd2': return n >= 13 && n <= 24;
        case 'd3': return n >= 25;
        case 'c1': return n % 3 === 1;
        case 'c2': return n % 3 === 2;
        case 'c3': return n % 3 === 0;
      }
      return false;
    }
    const payFor = (key) => {
      if (key.startsWith('n:')) return 36;
      return ['d1', 'd2', 'd3', 'c1', 'c2', 'c3'].includes(key) ? 3 : 2;
    };

    async function spin() {
      if (spinning) return;
      let staked = 0; for (const v of bets.values()) staked += v;
      if (staked <= 0) { toast('Place a chip on the board first.'); return; }
      spinning = true; bp.lock(); msg.clear();
      lastBets = new Map(bets);

      const idx = rndInt(order.length);
      const n = order[idx];
      const target = 360 * 6 + (360 - (idx * seg + seg / 2));
      rotation += target;
      inner.style.transform = `rotate(${rotation}deg)`;
      // ball counter-rotates, then settles into the winning pocket
      ballTurns -= 360 * 9 + (idx * seg + seg / 2);
      ball.style.transform = `rotate(${ballTurns}deg) translateY(-88px)`;
      hub.textContent = '…';
      hub.classList.remove('landed');
      const stopTick = ticker('wheelTick', 85);
      await sleep(4100);
      stopTick();
      hub.textContent = String(n);
      hub.classList.add('landed');
      hub.style.background = colorOf(n) === 'red' ? 'linear-gradient(140deg,#e34a63,#8e1a2e)'
        : colorOf(n) === 'green' ? 'linear-gradient(140deg,#3ddc84,#117a48)' : 'linear-gradient(140deg,#4a4a63,#15151f)';
      hub.style.color = '#fff';

      let payout = 0; const hits = [];
      for (const [k, amt] of bets) {
        if (!wins(k, n)) {
          // French rule: even-money bets get half back when zero lands
          if (laPartage && n === 0 && ['red', 'black', 'odd', 'even', 'low', 'high'].includes(k)) {
            payout += amt / 2;
            hits.push(k + ' (la partage)');
          }
          continue;
        }
        const boost = lightning && k.startsWith('n:') && lucky.has(n) ? lucky.get(n) + 1 : payFor(k);
        payout += amt * boost;
        hits.push(k.startsWith('n:')
          ? `straight ${k.slice(2)}${boost !== 36 ? ` @ ${boost - 1}x` : ''}`
          : k);
      }
      if (payout > 0) wallet.pay(payout);
      const net = payout - staked;
      const label = `${n} ${colorOf(n).toUpperCase()}`;
      if (net > 0) msg.win(net, `${label} · ${hits.join(', ')} ·`, staked);
      else if (net === 0) msg.push(`${label} — break even`);
      else msg.lose(`${label} — ${hits.length ? hits.join(', ') : 'no winning bets'}`);
      wallet.logResult(id, staked, payout);

      history.unshift(n); if (history.length > 14) history.pop();
      clear(histRow);
      for (const h of history) {
        const c = colorOf(h);
        histRow.append(el('div.hnum', {
          style: { background: c === 'red' ? '#b3243c' : c === 'green' ? '#177a4a' : '#1c1c28' },
        }, String(h)));
      }
      bets.clear(); paintChips();
      rollLucky();
      spinning = false; bp.unlock();
    }

    paintChips();
    rollLucky();
    root.append(el('div.roulette-wrap', {}, wheel, luckyRow, histRow, board, outside),
      msg.node, totalOut, bp.node,
      rules(lightning ? 'LIGHTNING ROULETTE'
        : laPartage ? 'FRENCH ROULETTE'
          : american ? 'AMERICAN ROULETTE' : 'EUROPEAN ROULETTE',
        `Set the chip size, then click numbers or outside boxes to stack chips. Chips are taken from your balance as you place them.`,
        `Straight up <code>35:1</code> · dozens and columns <code>2:1</code> · red/black, odd/even, high/low <code>1:1</code>.`,
        american
          ? `A double-zero wheel: 38 pockets including <code>0</code> and <code>00</code>. House edge <code>5.26%</code>.`
          : `A single-zero wheel: 37 pockets. House edge <code>2.70%</code> — the better of the two.`,
        laPartage
          ? `<b>La partage:</b> when zero lands, every even-money bet gets <b>half the stake back</b>. That halves the house edge on those bets to <code>1.35%</code>.`
          : lightning
            ? `Before each spin, <b>1 to 5 lucky numbers</b> are struck with a multiplier from <code>50x</code> to <code>500x</code>. A straight-up bet on a struck number pays that multiplier instead of 35:1 — the trade is that straight-up wins on ordinary numbers still pay 35:1 while the extra risk is funded by the multiplier round.`
            : `<b>CLEAR</b> returns unspun chips. <b>REBET</b> repeats your last layout.`,
        `<b>CLEAR</b> returns unspun chips. <b>REBET</b> repeats your last layout.`));
  };
}

/* ============================================================ SIC BO */
function sicBo({ id = 'sic-bo', label = 'SIC BO — THREE DICE' } = {}) {
  return function mount(root) {
  let choice = 'big', busy = false;
  const cubes = el('div.cubes', {}, [0, 1, 2].map(() => el('div.cube', {}, '?')));
  const felt = el('div.dice-table', {}, cubes);
  const msg = msgLine();
  const totalOut = el('div.readout');

  const OPTS = [
    { key: 'big', label: 'BIG', sub: '11–17 · 1:1' },
    { key: 'small', label: 'SMALL', sub: '4–10 · 1:1' },
    { key: 'odd', label: 'ODD', sub: '1:1' },
    { key: 'even', label: 'EVEN', sub: '1:1' },
    { key: 'anytriple', label: 'ANY TRIPLE', sub: '30:1' },
    ...[1, 2, 3, 4, 5, 6].map((n) => ({ key: 'triple' + n, label: `TRIPLE ${n}`, sub: '180:1' })),
    ...[1, 2, 3, 4, 5, 6].map((n) => ({ key: 'single' + n, label: `SINGLE ${n}`, sub: '1/2/3 : 1' })),
    ...[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((t) => ({ key: 'sum' + t, label: `SUM ${t}`, sub: SUM_PAY[t] + ':1' })),
  ];
  const picker = optGrid(OPTS, (k) => { choice = k; });
  const bp = betPanel({ start: 25, min: 1, max: 1000, action: 'ROLL', onAction: roll });

  async function roll() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); msg.clear();
    play('diceRoll');
    [...cubes.children].forEach((c) => c.classList.add('roll'));
    for (let i = 0; i < 8; i++) {
      [...cubes.children].forEach((c) => { c.textContent = DICE_FACES[rndInt(6)]; });
      await sleep(70);
    }
    const dice = [rollDie(), rollDie(), rollDie()];
    [...cubes.children].forEach((c, i) => { c.textContent = DICE_FACES[dice[i] - 1]; c.classList.remove('roll'); });
    const sum = dice[0] + dice[1] + dice[2];
    const triple = dice[0] === dice[1] && dice[1] === dice[2];
    totalOut.textContent = `dice ${dice.join(' · ')} = ${sum}${triple ? ' (triple)' : ''}`;

    let mult = 0;
    if (choice === 'big') mult = !triple && sum >= 11 && sum <= 17 ? 2 : 0;
    else if (choice === 'small') mult = !triple && sum >= 4 && sum <= 10 ? 2 : 0;
    else if (choice === 'odd') mult = !triple && sum % 2 === 1 ? 2 : 0;
    else if (choice === 'even') mult = !triple && sum % 2 === 0 ? 2 : 0;
    else if (choice === 'anytriple') mult = triple ? 31 : 0;
    else if (choice.startsWith('triple')) mult = triple && dice[0] === +choice.slice(6) ? 181 : 0;
    else if (choice.startsWith('single')) {
      const n = +choice.slice(6), c = dice.filter((d) => d === n).length;
      mult = c ? 1 + c : 0;
    } else if (choice.startsWith('sum')) {
      const t = +choice.slice(3);
      mult = sum === t ? 1 + SUM_PAY[t] : 0;
    }
    const payout = round2(stake * mult);
    if (payout > 0) { wallet.pay(payout); msg.win(payout - stake, `${sum} — ${choice.toUpperCase()} ·`, stake); }
    else msg.lose(`${sum} — ${choice.toUpperCase()} loses`);
    wallet.logResult(id, stake, payout);
    busy = false; bp.unlock();
  }

  root.append(felt, totalOut, msg.node, el('div', { style: { marginTop: '14px' } }, picker), bp.node,
    rules(label,
      `Pick a wager, roll three dice. <b>Big</b> (11–17) and <b>Small</b> (4–10) pay 1:1 but lose to any triple.`,
      `<b>Single number</b> pays 1:1, 2:1 or 3:1 depending on how many dice show it.`,
      `<b>Specific triple</b> pays 180:1 · <b>any triple</b> 30:1 · totals pay on a ladder from 6:1 to 60:1.`,
      `House edge varies by bet from <code>2.8%</code> (big/small) to <code>~16%</code> (specific triple).`));
  };
}
const SUM_PAY = { 4: 60, 5: 30, 6: 17, 7: 12, 8: 8, 9: 6, 10: 6, 11: 6, 12: 6, 13: 8, 14: 12, 15: 17, 16: 30, 17: 60 };

/* ============================================================ CRAPS */
function craps({ id = 'craps', label = 'CRAPS — LINE BETS' } = {}) {
  return function mount(root) {
  let point = null, busy = false, lineStake = 0, sideChoice = 'pass';
  const cubes = el('div.cubes', {}, [0, 1].map(() => el('div.cube', {}, '?')));
  const felt = el('div.dice-table', {}, cubes);
  const msg = msgLine();
  const pointOut = el('div.readout');
  const picker = optGrid([
    { key: 'pass', label: 'PASS LINE', sub: 'edge 1.41%' },
    { key: 'dont', label: "DON'T PASS", sub: 'edge 1.36%' },
    { key: 'field', label: 'FIELD', sub: 'one roll' },
  ], (k) => { if (!point) sideChoice = k; else toast('Finish the current point first.'); });
  const bp = betPanel({ start: 25, min: 1, max: 2000, action: 'ROLL', onAction: roll });

  async function animate() {
    [...cubes.children].forEach((c) => c.classList.add('roll'));
    for (let i = 0; i < 7; i++) {
      [...cubes.children].forEach((c) => { c.textContent = DICE_FACES[rndInt(6)]; });
      await sleep(65);
    }
    const dice = [rollDie(), rollDie()];
    [...cubes.children].forEach((c, i) => { c.textContent = DICE_FACES[dice[i] - 1]; c.classList.remove('roll'); });
    return dice;
  }

  async function roll() {
    if (busy) return;
    busy = true; bp.lock();
    if (point === null) {
      lineStake = bp.value;
      if (!bp.take()) { busy = false; bp.unlock(); return; }
    }
    const dice = await animate();
    const sum = dice[0] + dice[1];

    if (sideChoice === 'field') {
      const mult = sum === 2 ? 3 : sum === 12 ? 4 : [3, 4, 9, 10, 11].includes(sum) ? 2 : 0;
      const payout = round2(lineStake * mult);
      if (payout > 0) { wallet.pay(payout); msg.win(payout - lineStake, `${sum} pays ${mult - 1}:1 ·`, lineStake); }
      else msg.lose(`${sum} — field loses`);
      wallet.logResult(id, lineStake, payout);
      return end();
    }

    if (point === null) {
      if (sum === 7 || sum === 11) return settle(sideChoice === 'pass', sum, `natural ${sum}`);
      if (sum === 2 || sum === 3) return settle(sideChoice === 'dont', sum, `craps ${sum}`);
      if (sum === 12) {
        if (sideChoice === 'dont') { wallet.refund(lineStake); msg.push('12 — bar twelve, push'); wallet.logResult(id, lineStake, lineStake); return end(); }
        return settle(false, sum, 'craps 12');
      }
      point = sum;
      pointOut.textContent = `POINT IS ${point} — roll it again before a 7`;
      msg.set(`Point established: ${point}`, 'push');
      return end(true);
    }

    if (sum === point) return settle(sideChoice === 'pass', sum, `hit the point ${point}`);
    if (sum === 7) return settle(sideChoice === 'dont', sum, 'seven out');
    msg.set(`${sum} — roll again (point ${point})`, 'push');
    end(true);
  }

  function settle(playerWins, sum, why) {
    const payout = playerWins ? lineStake * 2 : 0;
    if (payout) { wallet.pay(payout); msg.win(payout - lineStake, `${why} ·`, lineStake); }
    else msg.lose(`${why} — ${sideChoice === 'pass' ? 'pass' : "don't pass"} loses`);
    wallet.logResult(id, lineStake, payout);
    point = null; pointOut.textContent = 'come-out roll';
    end();
  }
  function end(keepLocked = false) {
    busy = false; bp.unlock();
    bp.setAction(point ? 'ROLL AGAIN' : 'ROLL', point ? 'btn-green' : 'btn-gold');
    if (keepLocked) { /* stake stays live across the point */ }
  }

  pointOut.textContent = 'come-out roll';
  root.append(felt, pointOut, msg.node, el('div', { style: { marginTop: '14px' } }, picker), bp.node,
    rules(label,
      `<b>Come-out roll:</b> 7 or 11 wins the pass line, 2/3/12 loses it. Anything else becomes the <b>point</b>.`,
      `Once a point is set, keep rolling: hitting the point wins, rolling a <code>7</code> loses. Your stake stays live — no extra credits are taken.`,
      `<b>Don't Pass</b> is the mirror bet; 12 is barred and pushes. <b>Field</b> is a single-roll bet: 3·4·9·10·11 pay 1:1, 2 pays 2:1, 12 pays 3:1.`,
      `House edge: pass <code>1.41%</code> · don't pass <code>1.36%</code> · field <code>2.78%</code>.`));
  };
}

/* ============================================================ KENO */
/* Cleopatra Keno: flatter mid-tiers, much fatter top end. */
const CLEO_KENO_PAY = {
  1: [0, 3], 2: [0, 0, 13], 3: [0, 0, 1, 44], 4: [0, 0, 1, 4, 110],
  5: [0, 0, 0, 2, 18, 380], 6: [0, 0, 0, 1, 6, 60, 1000],
  7: [0, 0, 0, 0, 2, 14, 130, 2000], 8: [0, 0, 0, 0, 1, 7, 50, 400, 5500],
  9: [0, 0, 0, 0, 1, 4, 18, 130, 1100, 12000],
  10: [0, 0, 0, 0, 0, 2, 12, 50, 280, 1500, 20000],
};

/* Power Keno trades the small consolation prizes for much steeper top ends. */
const POWER_KENO_PAY = {
  1: [0, 3], 2: [0, 0, 14], 3: [0, 0, 1, 46], 4: [0, 0, 0, 5, 120],
  5: [0, 0, 0, 2, 20, 420], 6: [0, 0, 0, 0, 7, 70, 1200],
  7: [0, 0, 0, 0, 2, 16, 160, 2500], 8: [0, 0, 0, 0, 0, 8, 60, 500, 7000],
  9: [0, 0, 0, 0, 0, 5, 22, 160, 1400, 15000],
  10: [0, 0, 0, 0, 0, 2, 14, 60, 350, 2000, 25000],
};
const KENO_PAY = {
  1: [0, 3], 2: [0, 0, 12], 3: [0, 0, 1, 42], 4: [0, 0, 1, 4, 100],
  5: [0, 0, 0, 2, 15, 300], 6: [0, 0, 0, 1, 5, 50, 800],
  7: [0, 0, 0, 0, 2, 12, 100, 1500], 8: [0, 0, 0, 0, 1, 6, 40, 300, 4000],
  9: [0, 0, 0, 0, 1, 4, 15, 100, 800, 8000],
  10: [0, 0, 0, 0, 0, 2, 10, 40, 200, 1000, 10000],
};
function keno({ id, pay = KENO_PAY, label = 'KENO' }) {
  return function mount(root) {
  const picks = new Set();
  let busy = false;
  const grid = el('div.tiles', { style: { gridTemplateColumns: 'repeat(10, auto)' } });
  const tiles = [];
  for (let n = 1; n <= 80; n++) {
    const t = el('button.tile.small', { type: 'button' }, String(n));
    t.addEventListener('click', () => {
      if (busy) return;
      if (picks.has(n)) { picks.delete(n); t.classList.remove('pick'); }
      else if (picks.size < 10) { picks.add(n); t.classList.add('pick'); }
      else toast('10 numbers is the maximum.');
      info();
    });
    tiles[n] = t; grid.append(t);
  }
  const msg = msgLine();
  const out = el('div.readout');
  const payRow = el('div.paytable');
  const drum = el('div.kn-drum', { 'aria-hidden': 'true' });
  const drawnRow = el('div.kn-drawn');
  const machine = el('div.kn-machine', {}, drum, drawnRow);
  const bp = betPanel({
    start: 10, min: 1, max: 1000, action: 'DRAW', onAction: play,
    extra: [el('div.field', {}, el('label', {}, 'PICKS'), el('div.quick', {},
      el('button', { type: 'button', onclick: quick }, 'QUICK PICK'),
      el('button', { type: 'button', onclick: clearPicks }, 'CLEAR')))],
  });

  function info() {
    out.textContent = `${picks.size}/10 numbers selected`;
    clear(payRow);
    const tbl = pay[picks.size];
    if (!tbl) return;
    tbl.forEach((m, hits) => {
      if (!m) return;
      payRow.append(el('div.pt', {}, `${hits} hits`, el('b', {}, m + '×')));
    });
  }
  function quick() {
    if (busy) return;
    clearPicks();
    const bag = shuffle([...Array(80)].map((_, i) => i + 1));
    for (let i = 0; i < 8; i++) { picks.add(bag[i]); tiles[bag[i]].classList.add('pick'); }
    info();
  }
  function clearPicks() {
    if (busy) return;
    for (const n of picks) tiles[n].classList.remove('pick');
    picks.clear();
    tiles.forEach((t) => t && t.classList.remove('hit', 'dim'));
    info();
  }

  async function play() {
    if (busy) return;
    if (!picks.size) { toast('Pick 1 to 10 numbers first.'); return; }
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); msg.clear();
    tiles.forEach((t) => t && t.classList.remove('hit', 'dim'));

    clear(drawnRow);
    drum.classList.add('spinning');
    const drawn = shuffle([...Array(80)].map((_, i) => i + 1)).slice(0, 20);
    let hits = 0;
    for (const n of drawn) {
      const hit = picks.has(n);
      tiles[n].classList.add(hit ? 'hit' : 'dim');
      if (hit) { hits++; play('gem'); } else play('tickUp');
      drawnRow.append(el('div.kn-ball' + (hit ? '.hit' : ''), {}, String(n)));
      drawnRow.scrollLeft = drawnRow.scrollWidth;
      await sleep(110);
    }
    drum.classList.remove('spinning');

    const mult = pay[picks.size][hits] || 0;
    const payout = round2(stake * mult);
    if (payout > stake) { wallet.pay(payout); msg.win(payout - stake, `${hits}/${picks.size} hits — ${mult}× ·`, stake); }
    else if (payout > 0) { wallet.pay(payout); msg.push(`${hits}/${picks.size} hits — ${mult}× returns your stake`); }
    else msg.lose(`${hits}/${picks.size} hits — no prize`);
    wallet.logResult(id, stake, payout);
    busy = false; bp.unlock();
  }

  info();
  root.append(machine, grid, out, msg.node, bp.node, payRow,
    rules(label,
      `Pick <b>1 to 10</b> numbers from 80, then 20 are drawn. The more you pick, the steeper the ladder.`,
      `Green tiles are your hits, dim tiles are drawn numbers you missed. The paytable below updates with your selection.`,
      `Top prize: <code>10 of 10 = 10,000×</code> your stake.`,
      `Keno carries a high house edge by design — typically <code>20–30%</code>. It is a lottery, not a table game.`));
  };
}

/* ============================================================ BINGO 75 */
function bingo({ id, max = 75, calls = 30, label = 'BINGO 75' }) {
  return function mount(root) {
  let busy = false, card = [], marks = [];
  const cardWrap = el('div.bingo-card');
  const calledRow = el('div.called');
  const cage = el('div.bg-cage', { 'aria-hidden': 'true' });
  const hall = el('div.bg-hall', {}, cage);
  const msg = msgLine();
  const bp = betPanel({ start: 25, min: 1, max: 1000, action: 'BUY CARD & PLAY', onAction: play });

  function newCard() {
    card = []; marks = [];
    for (let c = 0; c < 5; c++) {
      const per = max / 5;
      const pool = shuffle([...Array(per)].map((_, i) => c * per + i + 1)).slice(0, 5);
      card.push(pool); marks.push([false, false, false, false, false]);
    }
    marks[2][2] = true;
    paint();
  }
  function paint() {
    clear(cardWrap);
    for (const h of (max === 90 ? ['1', '2', '3', '4', '5'] : ['B', 'I', 'N', 'G', 'O'])) cardWrap.append(el('div.bh', {}, h));
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const free = r === 2 && c === 2;
      cardWrap.append(el('div.bcell' + (free ? '.free' : marks[c][r] ? '.mark' : ''), {},
        free ? '★' : String(card[c][r])));
    }
  }
  function score() {
    let lines = 0;
    for (let r = 0; r < 5; r++) if ([0, 1, 2, 3, 4].every((c) => marks[c][r])) lines++;
    for (let c = 0; c < 5; c++) if ([0, 1, 2, 3, 4].every((r) => marks[c][r])) lines++;
    if ([0, 1, 2, 3, 4].every((i) => marks[i][i])) lines++;
    if ([0, 1, 2, 3, 4].every((i) => marks[i][4 - i])) lines++;
    const corners = marks[0][0] && marks[4][0] && marks[0][4] && marks[4][4];
    const full = marks.every((col) => col.every(Boolean));
    return { lines, corners, full };
  }

  async function play() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); msg.clear();
    newCard(); clear(calledRow);

    const balls = shuffle([...Array(max)].map((_, i) => i + 1)).slice(0, calls);
    cage.classList.add('spinning');
    for (const b of balls) {
      const col = Math.floor((b - 1) / (max / 5));
      const row = card[col].indexOf(b);
      if (row >= 0) marks[col][row] = true;
      [...calledRow.children].forEach((n) => n.classList.remove('new'));
      calledRow.append(el('div.cball.lotto.new', {}, String(b)));
      play('tickUp');
      paint();
      await sleep(90);
    }
    cage.classList.remove('spinning');
    const s = score();
    let mult = 0, note = `No pattern in ${calls} balls`;
    if (s.full) { mult = 60; note = 'FULL HOUSE!'; }
    else if (s.lines >= 2) { mult = 6; note = `${s.lines} lines`; }
    else if (s.lines === 1) { mult = 2; note = '1 line'; }
    else if (s.corners) { mult = 3; note = 'Four corners'; }
    const payout = round2(stake * mult);
    if (payout > 0) { wallet.pay(payout); msg.win(payout - stake, note + ' ·', stake); }
    else msg.lose(note);
    wallet.logResult(id, stake, payout);
    busy = false; bp.unlock();
  }

  newCard();
  root.append(hall, cardWrap, calledRow, msg.node, bp.node,
    rules(label,
      `You buy one 5×5 card with a free centre star. <b>${calls} of ${max} balls</b> are called.`,
      `Pays: any single line (row, column or diagonal) <code>2×</code> · four corners <code>3×</code> · two or more lines <code>6×</code> · full house <code>60×</code>.`,
      `Numbers are drawn without replacement across ${max} balls, five columns of ${max / 5}.`,
      `Best pattern found pays — prizes do not stack.`));
  };
}

/* ============================================================ exports */
export const tableGames = [
  G({ id: 'roulette-eu', name: 'European Roulette', cat: 'table', icon: '🎡', art: 'linear-gradient(160deg,#3d1220,#0b0d1c)', rtp: 97.3, vol: 'Medium', tags: ['hot'], mount: roulette({ id: 'roulette-eu', order: EU_ORDER, american: false }) }),
  G({ id: 'roulette-us', name: 'American Roulette', cat: 'table', icon: '🎡', art: 'linear-gradient(160deg,#1a2c4d,#0b0d1c)', rtp: 94.7, vol: 'Medium', mount: roulette({ id: 'roulette-us', order: US_ORDER, american: true }) }),
  G({ id: 'roulette-fr', name: 'French Roulette', cat: 'table', icon: '🎡', art: 'linear-gradient(160deg,#2a1240,#0b0d1c)', rtp: 98.6, vol: 'Medium', tags: ['new'], mount: roulette({ id: 'roulette-fr', order: EU_ORDER, american: false, laPartage: true }) }),
  G({ id: 'roulette-lightning', name: 'Lightning Roulette', cat: 'table', icon: '⚡', art: 'linear-gradient(160deg,#3d1250,#0b0d1c)', rtp: 97.1, vol: 'High', tags: ['hot'], mount: roulette({ id: 'roulette-lightning', order: EU_ORDER, american: false, lightning: true }) }),
  G({ id: 'roulette-speed', name: 'Speed Roulette', cat: 'table', icon: '⚡', art: 'linear-gradient(160deg,#3d122a,#0b0d1c)', rtp: 97.3, vol: 'Medium', mount: roulette({ id: 'roulette-speed', order: EU_ORDER, american: false }) }),
  G({ id: 'roulette-auto', name: 'Auto Roulette', cat: 'table', icon: '🎡', art: 'linear-gradient(160deg,#12303d,#0b0d1c)', rtp: 97.3, vol: 'Medium', mount: roulette({ id: 'roulette-auto', order: EU_ORDER, american: false }) }),
  G({ id: 'roulette-lightning-x', name: 'Lightning Roulette X', cat: 'table', icon: '⚡', art: 'linear-gradient(160deg,#2a0f50,#0b0d1c)', rtp: 97.1, vol: 'High', tags: ['hot'], mount: roulette({ id: 'roulette-lightning-x', order: US_ORDER, american: true, lightning: true }) }),
  G({ id: 'roulette-fr-gold', name: 'French Roulette Gold', cat: 'table', icon: '🇫🇷', art: 'linear-gradient(160deg,#3d2a12,#0b0d1c)', rtp: 98.6, vol: 'Medium', mount: roulette({ id: 'roulette-fr-gold', order: EU_ORDER, american: false, laPartage: true }) }),
  G({ id: 'sic-bo-super', name: 'Super Sic Bo', cat: 'table', icon: '🎲', art: 'linear-gradient(160deg,#4d1a12,#0b0d1c)', rtp: 97.2, vol: 'High', mount: sicBo({ id: 'sic-bo-super', label: 'SUPER SIC BO' }) }),
  G({ id: 'craps-express', name: 'Craps Express', cat: 'table', icon: '🎲', art: 'linear-gradient(160deg,#123d33,#0b0d1c)', rtp: 98.6, vol: 'Medium', mount: craps({ id: 'craps-express', label: 'CRAPS EXPRESS' }) }),
  G({ id: 'sic-bo', name: 'Sic Bo', cat: 'table', icon: '🎲', art: 'linear-gradient(160deg,#4d1230,#0b0d1c)', rtp: 97.2, vol: 'High', mount: sicBo({ id: 'sic-bo' }) }),
  G({ id: 'craps', name: 'Craps', cat: 'table', icon: '🎲', art: 'linear-gradient(160deg,#123d2a,#0b0d1c)', rtp: 98.6, vol: 'Medium', mount: craps({ id: 'craps' }) }),
  G({ id: 'keno', name: 'Keno', cat: 'lottery', icon: '🔢', art: 'linear-gradient(160deg,#2a1d52,#0b0d1c)', rtp: 92.0, vol: 'High', mount: keno({ id: 'keno' }) }),
  G({ id: 'keno-power', name: 'Power Keno', cat: 'lottery', icon: '⚡', art: 'linear-gradient(160deg,#3d1d6b,#0b0d1c)', rtp: 91.0, vol: 'High', tags: ['new'], mount: keno({ id: 'keno-power', pay: POWER_KENO_PAY, label: 'POWER KENO' }) }),
  G({ id: 'bingo-75', name: 'Bingo 75', cat: 'lottery', icon: '🎱', art: 'linear-gradient(160deg,#4d3312,#0b0d1c)', rtp: 93.0, vol: 'Medium', mount: bingo({ id: 'bingo-75' }) }),
  G({ id: 'roulette-vip', name: 'VIP Roulette', cat: 'table', icon: '💎', art: 'linear-gradient(160deg,#2a1240,#0b0d1c)', rtp: 97.3, vol: 'Medium', mount: roulette({ id: 'roulette-vip', order: EU_ORDER, american: false }) }),
  G({ id: 'roulette-double-zero', name: 'Vegas Roulette', cat: 'table', icon: '🎡', art: 'linear-gradient(160deg,#3d1a12,#0b0d1c)', rtp: 94.7, vol: 'Medium', mount: roulette({ id: 'roulette-double-zero', order: US_ORDER, american: true }) }),
  G({ id: 'sic-bo-lightning', name: 'Lightning Sic Bo', cat: 'table', icon: '⚡', art: 'linear-gradient(160deg,#2a1250,#0b0d1c)', rtp: 97.2, vol: 'High', mount: sicBo({ id: 'sic-bo-lightning', label: 'LIGHTNING SIC BO' }) }),
  G({ id: 'craps-vegas', name: 'Vegas Craps', cat: 'table', icon: '🎲', art: 'linear-gradient(160deg,#1a3d24,#0b0d1c)', rtp: 98.6, vol: 'Medium', mount: craps({ id: 'craps-vegas', label: 'VEGAS CRAPS' }) }),
  G({ id: 'keno-mega', name: 'Mega Keno', cat: 'lottery', icon: '🔢', art: 'linear-gradient(160deg,#3d1d52,#0b0d1c)', rtp: 91.0, vol: 'High', mount: keno({ id: 'keno-mega', pay: POWER_KENO_PAY, label: 'MEGA KENO' }) }),
  G({ id: 'keno-cleo', name: 'Cleopatra Keno', cat: 'lottery', icon: '👸', art: 'linear-gradient(160deg,#4d3d12,#0b0d1c)', rtp: 91.5, vol: 'High', mount: keno({ id: 'keno-cleo', pay: CLEO_KENO_PAY, label: 'CLEOPATRA KENO' }) }),
  G({ id: 'keno-classic', name: 'Classic Keno', cat: 'lottery', icon: '🔢', art: 'linear-gradient(160deg,#1d3352,#0b0d1c)', rtp: 92.0, vol: 'High', mount: keno({ id: 'keno-classic', label: 'CLASSIC KENO' }) }),
  G({ id: 'bingo-30', name: 'Speed Bingo 30', cat: 'lottery', icon: '⚡', art: 'linear-gradient(160deg,#4d2a12,#0b0d1c)', rtp: 92.8, vol: 'High', mount: bingo({ id: 'bingo-30', max: 75, calls: 20, label: 'SPEED BINGO 30' }) }),
  G({ id: 'bingo-80', name: 'Bingo 80', cat: 'lottery', icon: '🎱', art: 'linear-gradient(160deg,#123d3d,#0b0d1c)', rtp: 92.6, vol: 'Medium', mount: bingo({ id: 'bingo-80', max: 80, calls: 34, label: 'BINGO 80' }) }),
  G({ id: 'bingo-90', name: 'Bingo 90', cat: 'lottery', icon: '🎱', art: 'linear-gradient(160deg,#123d4d,#0b0d1c)', rtp: 92.5, vol: 'Medium', mount: bingo({ id: 'bingo-90', max: 90, calls: 40, label: 'BINGO 90' }) }),
];
