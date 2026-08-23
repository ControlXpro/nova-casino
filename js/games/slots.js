/* Data-driven 5x3 / 20-line slot engine + 28 themed titles.
   Every title runs one of three shared math models, exactly like a real studio
   ships many skins over a handful of maths. */
import { el, clear, fmt, rnd, rndInt, weighted, sleep, wallet, toast } from '../core.js';
import { betPanel, msgLine, rules } from '../ui.js';

/* 20 fixed paylines, row index per reel */
const LINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 1, 2, 1], [1, 2, 1, 0, 1], [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2], [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2],
  [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 2, 0, 2, 0], [2, 0, 2, 0, 2], [0, 0, 2, 0, 0],
];
const REELS = 5, ROWS = 3, WILD = 6, SCAT = 7;

/* Three shared math models. `calib` is a flat payout scalar fitted by
   simulation (see tools/rtp.mjs) so each model lands on its stated RTP. */
export const MODELS = {
  low: {
    label: 'Low', rtp: 96.1, calib: 2.4159,
    weights: [20, 18, 16, 13, 10, 7, 4.0, 3.0],
    pays: [[2, 6, 15], [2, 8, 20], [3, 10, 25], [5, 15, 40], [8, 25, 75], [12, 40, 120], [15, 60, 200]],
    scatter: [2, 5, 20], freeSpins: 8, fsMult: 2,
  },
  med: {
    label: 'Medium', rtp: 95.5, calib: 2.1700,
    weights: [22, 19, 16, 12, 9, 6, 3.5, 2.5],
    pays: [[2, 5, 12], [2, 8, 22], [4, 12, 30], [6, 20, 60], [10, 35, 110], [20, 60, 220], [25, 90, 350]],
    scatter: [3, 8, 30], freeSpins: 10, fsMult: 3,
  },
  high: {
    label: 'High', rtp: 94.8, calib: 2.3857,
    weights: [24, 20, 16, 11, 8, 5, 2.6, 2.0],
    pays: [[2, 5, 10], [2, 7, 20], [3, 12, 35], [5, 22, 80], [12, 45, 160], [25, 90, 400], [40, 150, 800]],
    scatter: [4, 12, 50], freeSpins: 12, fsMult: 5,
  },
};

/* ---------------- pure math (also used by tools/rtp.mjs) ---------------- */
export function spinGrid(model) {
  const grid = [];
  for (let r = 0; r < REELS; r++) {
    const col = [];
    for (let y = 0; y < ROWS; y++) col.push(weighted(model.weights));
    grid.push(col);
  }
  return grid;
}

/** Evaluate one grid. bet = total stake for the spin. */
export function evaluate(grid, model, bet, mult = 1) {
  const lineBet = bet / LINES.length;
  const wins = [];
  let total = 0;

  for (let li = 0; li < LINES.length; li++) {
    const line = LINES[li];
    let base = -1, count = 0;
    for (let r = 0; r < REELS; r++) {
      const s = grid[r][line[r]];
      if (s === SCAT) break;
      if (base === -1) { base = s; count = 1; continue; }
      if (s === base || s === WILD || base === WILD) {
        if (base === WILD && s !== WILD) base = s;   // wilds lead into a paying symbol
        count++;
      } else break;
    }
    if (base >= 0 && count >= 3) {
      const pay = model.pays[base][count - 3] * lineBet * model.calib * mult;
      if (pay > 0) {
        total += pay;
        wins.push({ line: li, sym: base, count, pay, cells: line.slice(0, count).map((y, r) => [r, y]) });
      }
    }
  }

  let scatters = 0;
  for (let r = 0; r < REELS; r++) for (let y = 0; y < ROWS; y++) if (grid[r][y] === SCAT) scatters++;
  let scatterPay = 0;
  if (scatters >= 3) {
    scatterPay = model.scatter[Math.min(scatters, 5) - 3] * bet * model.calib * mult;
    total += scatterPay;
  }
  return { total, wins, scatters, scatterPay, freeSpins: scatters >= 3 ? model.freeSpins : 0 };
}

/* ---------------- themes ---------------- */
const T = (id, name, model, bg, syms, wild, scatter, tags = []) =>
  ({ id, name, model, bg, syms: [...syms, wild, scatter], tags });

export const SLOT_THEMES = [
  T('book-of-sunrise', 'Book of Sunrise', 'high', '#2a1a4d', ['📜', '🪶', '🐍', '🦅', '🐈', '👑'], '🌅', '📖', ['hot']),
  T('neon-fruits', 'Neon Fruits', 'low', '#161b3d', ['🍒', '🍋', '🍊', '🍉', '🍇', '🔔'], '⭐', '💎'),
  T('dragons-hoard', 'Dragon’s Hoard', 'high', '#3a1520', ['🗡️', '🛡️', '🏹', '💰', '🔮', '🐉'], '🔥', '🏆', ['hot']),
  T('pharaohs-gold', 'Pharaoh’s Gold', 'med', '#3a2c10', ['🪲', '🏺', '👁️', '🐫', '🧿', '🤴'], '🔺', '💠'),
  T('wild-buffalo', 'Wild Buffalo', 'med', '#2b2417', ['🦌', '🐺', '🦅', '🐃', '🏔️', '🌄'], '🦬', '💰'),
  T('sweet-cluster', 'Sweet Cluster', 'med', '#3a1638', ['🍬', '🍭', '🧁', '🍩', '🍫', '🍰'], '🌈', '🍯', ['hot']),
  T('pirates-bounty', 'Pirate’s Bounty', 'med', '#12283a', ['🧭', '⚓', '🗺️', '🦜', '💣', '🏴‍☠️'], '⚔️', '💎'),
  T('aztec-sun', 'Aztec Sun', 'high', '#2e2410', ['🗿', '🌽', '🐆', '🦎', '🪶', '🌞'], '🔆', '🏵️'),
  T('wolf-moon', 'Wolf Moon', 'med', '#141d2e', ['🌲', '🦌', '🦉', '🐗', '🐻', '🌕'], '🐺', '❄️'),
  T('diamond-sevens', 'Diamond Sevens', 'low', '#241436', ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'], '🃏', '💰'),
  T('gates-of-fortune', 'Gates of Fortune', 'high', '#1c2440', ['💍', '⌛', '🏛️', '⚡', '👑', '⚱️'], '🌟', '🔱', ['hot']),
  T('lucky-koi', 'Lucky Koi', 'med', '#331420', ['🎋', '🏮', '🍥', '🐢', '🐉', '🐟'], '🀄', '🧧'),
  T('space-miners', 'Space Miners', 'high', '#101a33', ['🔩', '⚙️', '🛰️', '🪐', '🚀', '👽'], '🌌', '☄️', ['new']),
  T('viking-fury', 'Viking Fury', 'high', '#1f2733', ['🪓', '🛶', '🐏', '🦌', '⚡', '🧔'], '🔨', '🛡️'),
  T('safari-king', 'Safari King', 'med', '#2c2a12', ['🦓', '🦒', '🐘', '🦏', '🐆', '🦁'], '🌍', '📸'),
  T('mystic-fairy', 'Mystic Fairy', 'low', '#231a3d', ['🍄', '🦋', '🌸', '🐞', '🕯️', '🧚'], '✨', '🔮'),
  T('cash-vault', 'Cash Vault', 'high', '#12291f', ['🪙', '💵', '💳', '🔐', '💼', '🏦'], '💎', '🧨', ['new']),
  T('wild-west-gold', 'Wild West Gold', 'med', '#33220f', ['🌵', '🐎', '🤠', '🔫', '🚂', '⭐'], '🎯', '💰'),
  T('joker-bells', 'Joker Bells', 'low', '#2b1030', ['🍀', '🍒', '🔔', '💎', '⭐', '🎩'], '🃏', '🎁'),
  T('ocean-riches', 'Ocean Riches', 'med', '#0e2536', ['🐚', '🐠', '🦀', '🐙', '🦈', '🧜'], '🌊', '🗝️'),
  T('samurai-blade', 'Samurai Blade', 'high', '#2d1418', ['🎎', '🏯', '🌸', '🥷', '🗡️', '👺'], '☯️', '🎴'),
  T('voodoo-nights', 'Voodoo Nights', 'high', '#1d1030', ['🕯️', '🪄', '🦇', '🕷️', '💀', '🧙'], '🔯', '⚗️'),
  T('bonanza-mine', 'Bonanza Mine', 'high', '#2a1f14', ['⛏️', '🪨', '🧨', '🚋', '💎', '⛰️'], '💰', '🔔'),
  T('frozen-fortune', 'Frozen Fortune', 'low', '#12283a', ['❄️', '🧊', '🐧', '🦭', '🐻‍❄️', '🏔️'], '💠', '🎁'),
  T('cleopatras-eye', 'Cleopatra’s Eye', 'med', '#332a0f', ['🐍', '🏺', '🪭', '👁️', '🐈‍⬛', '👸'], '🔺', '🌟'),
  T('retro-vegas', 'Retro Vegas', 'low', '#301433', ['🍒', '🍇', '🔔', '🎰', '💵', '🎲'], '⭐', '🎫'),
  T('reel-fisher', 'Reel Fisher', 'med', '#123028', ['🪱', '🎣', '🥾', '🦆', '🐸', '🐟'], '🚤', '💵', ['new']),
  T('fire-and-ice', 'Fire & Ice Reels', 'high', '#2b1526', ['🔥', '🧊', '🌪️', '⚡', '🌋', '☄️'], '🌗', '💫'),
];

/* ---------------- playable UI ---------------- */
function mountSlot(theme) {
  return function mount(root) {
    const model = MODELS[theme.model];
    const cells = [];               // cells[reel][row]
    let busy = false;

    const reelsWrap = el('div.reels', {
      style: { gridTemplateColumns: `repeat(${REELS}, auto)` },
    });
    for (let r = 0; r < REELS; r++) {
      const col = el('div.reel');
      cells[r] = [];
      for (let y = 0; y < ROWS; y++) {
        const sym = el('span.sym', {}, theme.syms[rndInt(6)]);
        const cell = el('div.cellw', {}, sym);
        cells[r][y] = { cell, sym };
        col.append(cell);
      }
      reelsWrap.append(col);
    }

    const machine = el('div.slot-machine', {
      style: { background: `linear-gradient(160deg, ${theme.bg}, #0b0d1c)` },
    }, reelsWrap);

    const banner = el('div.freespin-banner', { hidden: true });
    const msg = msgLine();

    const paytable = el('div.paytable', {},
      theme.syms.map((s, i) => {
        const pay = i === SCAT
          ? `${model.scatter[2]}x`
          : `${Math.round(model.pays[i][2] * model.calib)}x`;
        return el('div.pt', {}, el('span', {}, s),
          i === WILD ? 'WILD' : i === SCAT ? 'SCAT' : '×5',
          el('b', {}, pay));
      }));

    const bp = betPanel({
      start: 20, min: 0.2, max: 2000, action: 'SPIN',
      onAction: () => doSpin(),
    });

    async function animateReveal(grid) {
      for (let r = 0; r < REELS; r++) for (let y = 0; y < ROWS; y++) {
        cells[r][y].cell.classList.add('spin');
        cells[r][y].cell.classList.remove('hit');
      }
      const churn = setInterval(() => {
        for (let r = 0; r < REELS; r++) for (let y = 0; y < ROWS; y++)
          if (cells[r][y].cell.classList.contains('spin'))
            cells[r][y].sym.textContent = theme.syms[rndInt(8)];
      }, 70);

      for (let r = 0; r < REELS; r++) {
        await sleep(190);
        for (let y = 0; y < ROWS; y++) {
          cells[r][y].cell.classList.remove('spin');
          cells[r][y].sym.textContent = theme.syms[grid[r][y]];
        }
      }
      clearInterval(churn);
    }

    function highlight(res) {
      for (const w of res.wins) for (const [r, y] of w.cells) cells[r][y].cell.classList.add('hit');
      if (res.scatters >= 3)
        for (let r = 0; r < REELS; r++) for (let y = 0; y < ROWS; y++)
          if (theme.syms[SCAT] === cells[r][y].sym.textContent) cells[r][y].cell.classList.add('hit');
    }

    async function runSpin(bet, mult) {
      const grid = spinGrid(model);
      await animateReveal(grid);
      const res = evaluate(grid, model, bet, mult);
      highlight(res);
      return res;
    }

    async function doSpin() {
      if (busy) return;
      const bet = bp.value;
      if (!bp.take()) return;
      busy = true; bp.lock(); banner.hidden = true; msg.clear();

      let res = await runSpin(bet, 1);
      let total = res.total;

      if (res.freeSpins) {
        let left = res.freeSpins;
        banner.hidden = false;
        for (let i = 0; i < res.freeSpins; i++) {
          banner.textContent = `🎁 FREE SPINS  ${i + 1}/${res.freeSpins}  ·  ${model.fsMult}× MULTIPLIER`;
          msg.set(`Free spin ${i + 1} — running total +${fmt(total)}`, 'push');
          await sleep(450);
          const fs = await runSpin(bet, model.fsMult);
          total += fs.total;
          if (fs.freeSpins && left < 40) { left += 5; }
          await sleep(250);
        }
        banner.textContent = `🎁 FREE SPINS COMPLETE  ·  +${fmt(total)}`;
      }

      if (total > 0) {
        wallet.pay(total);
        const x = total / bet;
        msg.win(total, x >= 20 ? 'MEGA WIN' : x >= 8 ? 'BIG WIN' : 'WIN');
        if (x >= 20) toast(`${theme.name}: ${x.toFixed(1)}× hit!`, 'win');
      } else {
        msg.lose('No win — spin again');
      }
      wallet.logResult(theme.id, bet, total);
      busy = false; bp.unlock();
    }

    root.append(
      machine, banner, msg.node, bp.node, paytable,
      rules('HOW IT PAYS',
        `<b>5 reels · 3 rows · 20 fixed paylines.</b> Lines pay left to right from reel 1, 3 or more matching symbols.`,
        `<b>${theme.syms[WILD]} Wild</b> substitutes for every symbol except the scatter and pays on its own line combinations.`,
        `<b>${theme.syms[SCAT]} Scatter</b> pays anywhere on the reels. 3 or more awards <code>${model.freeSpins} free spins</code> at a <code>${model.fsMult}×</code> multiplier, retriggerable.`,
        `Volatility <code>${model.label}</code> · Theoretical RTP <code>${model.rtp}%</code> · line bet = total bet ÷ 20.`,
        `Results come from <code>crypto.getRandomValues</code>. Credits are virtual and have no cash value.`));
  };
}

/* Export one game descriptor per theme. */
export const slotGames = SLOT_THEMES.map((t) => ({
  id: t.id,
  name: t.name,
  cat: 'slots',
  icon: t.syms[5],
  art: `linear-gradient(160deg, ${t.bg}, #0b0d1c)`,
  rtp: MODELS[t.model].rtp,
  vol: MODELS[t.model].label,
  tags: t.tags,
  mount: mountSlot(t),
}));
