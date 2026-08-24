/* Instant / arcade-style games: crash, mines, plinko, dice, limbo, wheel,
   coin flip, scratch card, tower, penalty shootout, rock-paper-scissors. */
import { el, clear, fmt, fmtx, rnd, rndInt, pick, shuffle, sleep, wallet, round2, weighted, toast } from '../core.js';
import { betPanel, msgLine, rules, optGrid } from '../ui.js';
import { play, ticker } from '../sound.js';
import { penalty } from './penalty.js';

const G = (o) => o;
const EDGE = 0.99;   // 1% house edge on the provably-fair style games

/* ============================================================ CRASH */
function crash(root) {
  const id = 'crash';
  let live = false, stake = 0, mult = 1, crashAt = 0, raf = 0, t0 = 0, cashed = false;
  let stopFlight = null;
  const history = [];

  const canvas = el('canvas');
  const multEl = el('div.crash-mult', {}, '1.00×');
  const stateEl = el('div.crash-state', {}, 'READY');
  const sky = el('div.crash-sky.drift', {
    'aria-hidden': 'true',
    style: { backgroundImage: 'url("art/_space.webp")' },
  });
  const rocket = el('div.rocket', {
    'aria-hidden': 'true',
    style: { backgroundImage: 'url("art/_rocket.webp")' },
  });
  const boom = el('div.boom', {
    'aria-hidden': 'true',
    style: { backgroundImage: 'url("art/_boom.webp")' },
  });
  const box = el('div.crash-box', {}, sky, canvas, rocket, boom, stateEl, multEl);

  /** Fly the rocket along the same curve the canvas draws. */
  function flyTo(progress) {
    const x = 6 + progress * 74;              // % across
    const y = 6 + progress * 64;              // % up
    rocket.style.left = x + '%';
    rocket.style.bottom = y + '%';
    rocket.style.transform = `rotate(${-6 - progress * 6}deg)`;
  }
  const histRow = el('div.history', { style: { marginTop: '10px' } });
  const msg = msgLine();

  const autoInput = el('input', { type: 'text', inputmode: 'decimal', value: '2.00' });
  const auto = el('div.field', {}, el('label', {}, 'AUTO CASH OUT'),
    el('div.stepper', {}, el('button', { type: 'button', onclick: () => bump(-0.1) }, '−'), autoInput,
      el('button', { type: 'button', onclick: () => bump(0.1) }, '+')));
  const bump = (d) => { autoInput.value = Math.max(1.01, (parseFloat(autoInput.value) || 2) + d).toFixed(2); };

  const bp = betPanel({ start: 25, min: 1, max: 2000, action: 'BET', onAction: go, extra: [auto] });

  function rollCrash() {
    if (rnd() < 0.01) return 1.00;                 // 1% instant bust = the house edge
    return Math.max(1, Math.floor(100 * EDGE / (1 - rnd())) / 100);
  }
  function draw() {
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth * devicePixelRatio;
    const h = canvas.height = canvas.clientHeight * devicePixelRatio;
    ctx.clearRect(0, 0, w, h);
    const span = Math.max(2, mult);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= 100; i++) {
      const p = i / 100;
      const m = 1 + (mult - 1) * p;
      ctx.lineTo(p * w, h - ((m - 1) / (span - 1 || 1)) * h * 0.86);
    }
    ctx.strokeStyle = cashed ? '#3ddc84' : '#f5c451';
    ctx.lineWidth = 3 * devicePixelRatio;
    ctx.stroke();
    ctx.lineTo(w, h); ctx.closePath();
    ctx.fillStyle = cashed ? 'rgba(61,220,132,.12)' : 'rgba(245,196,81,.10)';
    ctx.fill();
  }
  function tick() {
    const dt = (performance.now() - t0) / 1000;
    mult = Math.max(1, Math.round(Math.pow(1.0718, dt * 10) * 100) / 100);
    if (mult >= crashAt) return bust();
    multEl.textContent = fmtx(mult);
    flyTo(Math.min(1, Math.log(mult) / Math.log(24)));
    const autoAt = parseFloat(autoInput.value) || 0;
    if (!cashed && autoAt >= 1.01 && mult >= autoAt) return cashOut();
    draw();
    raf = requestAnimationFrame(tick);
  }
  function go() {
    if (live) { if (!cashed) cashOut(); return; }
    stake = bp.value;
    if (!bp.take()) return;
    live = true; cashed = false; mult = 1; crashAt = rollCrash();
    stateEl.textContent = 'IN FLIGHT'; multEl.style.color = 'var(--accent, var(--gold))';
    box.classList.add('flying'); box.classList.remove('busted');
    boom.classList.remove('go');
    rocket.style.transition = 'none'; flyTo(0);
    void rocket.offsetWidth; rocket.style.transition = '';
    stopFlight = ticker('tickUp', 220);
    msg.clear(); bp.setAction('CASH OUT', 'btn-green'); bp.lock(); bp.actionBtn.disabled = false;
    t0 = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function cashOut() {
    if (!live || cashed) return;
    cashed = true;
    const payout = round2(stake * mult);
    wallet.pay(payout);
    multEl.style.color = 'var(--win)'; play('cashout');
    msg.win(payout - stake, `Cashed out at ${fmtx(mult)} ·`, stake);
    wallet.logResult(id, stake, payout);
  }
  function bust() {
    cancelAnimationFrame(raf);
    live = false;
    mult = crashAt; multEl.textContent = fmtx(crashAt);
    stateEl.textContent = 'CRASHED';
    box.classList.remove('flying'); box.classList.add('busted');
    stopFlight?.(); stopFlight = null; play('explode');
    // detonate where the rocket actually is
    boom.style.left = rocket.style.left || '20%';
    boom.style.bottom = rocket.style.bottom || '20%';
    boom.classList.remove('go'); void boom.offsetWidth; boom.classList.add('go');
    if (!cashed) { multEl.style.color = 'var(--lose)'; msg.lose(`Crashed at ${fmtx(crashAt)}`); wallet.logResult(id, stake, 0); }
    draw();
    history.unshift(crashAt); if (history.length > 12) history.pop();
    clear(histRow);
    for (const h of history) histRow.append(el('div.hnum', {
      style: { background: h >= 10 ? '#f5c451' : h >= 2 ? '#177a4a' : '#b3243c', color: h >= 10 ? '#1b1400' : '#fff', width: '44px' },
    }, fmtx(h)));
    bp.setAction('BET', 'btn-gold'); bp.unlock();
  }

  root.append(box, histRow, msg.node, bp.node,
    rules('CRASH',
      `The multiplier climbs from <code>1.00×</code>. Cash out before it crashes and you keep <code>stake × multiplier</code>.`,
      `The crash point is drawn the moment you bet, from <code>0.99 ÷ (1 − r)</code> with a flat 1% instant-bust chance — a <code>99%</code> theoretical return.`,
      `<b>Auto cash out</b> pulls you out automatically at your chosen multiplier.`,
      `Half of all rounds crash below <code>2×</code>. There is no pattern to read in the history strip.`));
}

/* ============================================================ MINES */
function mines(root) {
  const id = 'mines';
  let live = false, stake = 0, bombs = 3, field = [], picked = 0;
  const grid = el('div.tiles', { style: { gridTemplateColumns: 'repeat(5, auto)' } });
  const tiles = [];
  const msg = msgLine();
  const infoEl = el('div.readout');

  const multAt = (k) => {
    if (k === 0) return 1;
    let m = EDGE;
    for (let i = 0; i < k; i++) m *= (25 - i) / (25 - bombs - i);
    return Math.round(m * 100) / 100;
  };
  function info() {
    infoEl.textContent = live
      ? `${picked} safe · current ${fmtx(multAt(picked))} · next ${fmtx(multAt(picked + 1))}`
      : `${bombs} mines in 25 tiles · first pick pays ${fmtx(multAt(1))}`;
    btnOut.textContent = `CASH OUT ${fmt(round2(stake * multAt(picked)))}`;
  }

  const countSel = optGrid([1, 3, 5, 10, 24].map((n) => ({ key: String(n), label: `${n} 💣`, sub: n === 24 ? '24.75×' : '' })),
    (k) => { if (!live) { bombs = +k; info(); } });

  const bp = betPanel({ start: 25, min: 1, max: 2000, action: 'START', onAction: go });
  const btnOut = el('button.btn.btn-gold.btn-lg', { type: 'button', onclick: cashOut }, 'CASH OUT');
  btnOut.hidden = true;

  for (let i = 0; i < 25; i++) {
    const t = el('button.tile', { type: 'button' }, '');
    t.addEventListener('click', () => reveal(i));
    tiles.push(t); grid.append(t);
  }
  function reset() {
    tiles.forEach((t) => { t.className = 'tile'; t.textContent = ''; });
  }
  function go() {
    if (live) return;
    stake = bp.value;
    if (!bp.take()) return;
    reset();
    field = shuffle([...Array(25)].map((_, i) => i)).slice(0, bombs);
    picked = 0; live = true;
    bp.lock(); btnOut.hidden = false; msg.set('Pick a tile', 'push'); info();
  }
  function reveal(i) {
    if (!live || tiles[i].classList.contains('done')) return;
    if (field.includes(i)) {
      tiles[i].className = 'tile bomb done'; tiles[i].textContent = '💣'; play('explode');
      for (const b of field) if (b !== i) { tiles[b].className = 'tile bomb done dim'; tiles[b].textContent = '💣'; }
      msg.lose(`Hit a mine after ${picked} safe pick${picked === 1 ? '' : 's'}`);
      wallet.logResult(id, stake, 0);
      end();
    } else {
      tiles[i].className = 'tile gem done'; tiles[i].textContent = '💎'; play('gem');
      picked++;
      info();
      msg.set(`${picked} safe · ${fmtx(multAt(picked))} banked`, 'win');
      if (picked === 25 - bombs) cashOut();
    }
  }
  function cashOut() {
    if (!live || picked === 0) { if (picked === 0) toast('Reveal at least one tile first.'); return; }
    const payout = round2(stake * multAt(picked));
    wallet.pay(payout);
    msg.win(payout - stake, `Cashed out at ${fmtx(multAt(picked))} ·`, stake);
    wallet.logResult(id, stake, payout);
    for (const b of field) { tiles[b].className = 'tile bomb done dim'; tiles[b].textContent = '💣'; }
    end();
  }
  function end() {
    live = false; btnOut.hidden = true; bp.unlock();
    tiles.forEach((t) => t.classList.add('done'));
  }

  info();
  root.append(grid, infoEl, msg.node,
    el('div', { style: { marginTop: '14px' } }, countSel),
    el('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' } }, bp.node, btnOut),
    rules('MINES',
      `Choose how many mines hide in the 5×5 grid, then reveal tiles one at a time. Every safe tile raises the multiplier.`,
      `Cash out whenever you like. Hitting a mine ends the round and loses the stake.`,
      `Multipliers are the exact inverse odds with a <code>1%</code> edge: <code>0.99 × C(25,k) ÷ C(25−m,k)</code>.`,
      `24 mines means one tile is safe — a single pick pays <code>24.75×</code>.`));
}

/* ============================================================ PLINKO */
const PLINKO_ROWS = 16;
/* Three risk profiles over the same 16-row board. Each is a real binomial
   payout table returning ~99%; only the variance differs. */
const PLINKO_PAYS = {
  medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
};
function plinko({ id = 'plinko', risk = 'medium' }) {
  return function mount(root) {
  const PLINKO_PAY = PLINKO_PAYS[risk];
  let busy = false;
  const canvas = el('canvas');
  const orb = el('div.pl-orb', { 'aria-hidden': 'true' });
  const box = el('div.plinko-box.scene', {}, canvas, orb);
  const buckets = el('div.buckets', {}, PLINKO_PAY.map((m) =>
    el('div.bk', { style: { color: m >= 10 ? '#f5c451' : m >= 1 ? '#eef1ff' : '#8d93b8' } }, m + '×')));
  const msg = msgLine();
  const bp = betPanel({ start: 25, min: 1, max: 1000, action: 'DROP', onAction: drop });

  function pegs(w, h) {
    const out = [];
    for (let r = 0; r < PLINKO_ROWS; r++) {
      const n = r + 3;
      const y = 22 + (r / PLINKO_ROWS) * (h - 60);
      for (let i = 0; i < n; i++) out.push({ x: w / 2 + (i - (n - 1) / 2) * (w / (PLINKO_ROWS + 4)), y });
    }
    return out;
  }
  /* Pegs are drawn as lit chrome studs; the ball itself is a DOM sprite so it
     can carry a real glow and trail. `hitRow` flashes the row just struck. */
  let hitRow = -1;
  function render(ball) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth * devicePixelRatio;
    const h = canvas.height = canvas.clientHeight * devicePixelRatio;
    ctx.clearRect(0, 0, w, h);

    const R = 3.2 * devicePixelRatio;
    let row = 0, seen = 0, n = 3;
    for (const p of pegs(w, h)) {
      const lit = row === hitRow;
      const g = ctx.createRadialGradient(p.x - R * .4, p.y - R * .4, R * .15, p.x, p.y, R * 1.6);
      g.addColorStop(0, lit ? '#fff8e0' : '#e8edff');
      g.addColorStop(.55, lit ? '#ffc531' : '#8c97c4');
      g.addColorStop(1, lit ? 'rgba(255,197,49,.15)' : 'rgba(60,70,110,.25)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, lit ? R * 1.35 : R, 0, 7); ctx.fill();
      if (++seen >= n) { seen = 0; n++; row++; }
    }

    if (ball) {
      orb.style.opacity = '1';
      orb.style.left = (ball.x / devicePixelRatio) + 'px';
      orb.style.top = (ball.y / devicePixelRatio) + 'px';
    } else {
      orb.style.opacity = '0';
    }
  }
  async function drop() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); msg.clear();
    [...buckets.children].forEach((b) => b.classList.remove('flash'));

    const path = [];
    let slot = 0;
    for (let r = 0; r < PLINKO_ROWS; r++) { const right = rndInt(2); slot += right; path.push(right); }

    const w = canvas.clientWidth * devicePixelRatio, h = canvas.clientHeight * devicePixelRatio;
    const step = w / (PLINKO_ROWS + 4);
    let x = w / 2, y = 8;
    for (let r = 0; r < PLINKO_ROWS; r++) {
      const ty = 22 + ((r + 1) / PLINKO_ROWS) * (h - 60);
      const tx = x + (path[r] ? step / 2 : -step / 2);
      for (let f = 0; f < 5; f++) {
        x += (tx - x) * 0.55; y += (ty - y) * 0.55;
        render({ x, y }); await sleep(16);
      }
      x = tx; y = ty;
      hitRow = r; render({ x, y }); play('tickUp');
    }
    hitRow = -1;
    render({ x, y: h - 22 });
    await sleep(120);
    render(null);

    const mult = PLINKO_PAY[slot];
    buckets.children[slot].classList.add('flash'); play('coin');
    const payout = round2(stake * mult);
    if (payout > 0) wallet.pay(payout);
    if (payout > stake) msg.win(payout - stake, `${mult}× bucket ·`, stake);
    else if (payout === stake) msg.push(`${mult}× — stake back`);
    else msg.lose(`${mult}× bucket — lost ${fmt(stake - payout)}`);
    wallet.logResult(id, stake, payout);
    busy = false; bp.unlock();
  }

  render(null);
  root.append(box, buckets, msg.node, bp.node,
    rules('PLINKO — ' + risk.toUpperCase() + ' RISK',
      `A ball drops through <b>16 rows of pegs</b>, bouncing left or right at each one with equal probability.`,
      `Where it lands is a binomial distribution — the centre is by far the most likely, which is why it pays <code>0.3×</code>.`,
      `Edge buckets pay <code>${PLINKO_PAY[0]}×</code> but land roughly once in <code>65,536</code> drops.`,
      `Theoretical return <code>99.0%</code> across the whole board.`));
  };
}

/* ============================================================ DICE */
function diceGame(root) {
  const id = 'dice';
  let target = 50, over = true, busy = false;
  const resultEl = el('div.dice-result', {}, '—');
  const feltBg = el('div.dice-felt', { 'aria-hidden': 'true' });
  const rail = el('div.slider-rail');
  const range = el('input', { type: 'range', min: 2, max: 98, value: 50, step: 1 });
  const scale = el('div.scale', {}, ['0', '25', '50', '75', '100'].map((s) => el('span', {}, s)));
  const msg = msgLine();
  const stats = el('div.readout');

  const dirBtn = el('button.btn', { type: 'button', onclick: () => { over = !over; sync(); } }, 'ROLL OVER');
  const bp = betPanel({
    start: 25, min: 1, max: 2000, action: 'ROLL', onAction: roll,
    extra: [el('div.field', {}, el('label', {}, 'DIRECTION'), dirBtn)],
  });

  const chance = () => (over ? 100 - target : target);
  const payout = () => Math.max(1.01, Math.round((100 * EDGE / chance()) * 10000) / 10000);

  function sync() {
    target = +range.value;
    dirBtn.textContent = over ? `ROLL OVER ${target}` : `ROLL UNDER ${target}`;
    const pct = target + '%';
    rail.style.background = over
      ? `linear-gradient(90deg, var(--lose) 0 ${pct}, var(--win) ${pct} 100%)`
      : `linear-gradient(90deg, var(--win) 0 ${pct}, var(--lose) ${pct} 100%)`;
    stats.innerHTML = `win chance <b>${chance().toFixed(2)}%</b> · pays <b>${payout().toFixed(4)}×</b>`;
  }
  range.addEventListener('input', sync);

  async function roll() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock();
    const mult = payout();
    for (let i = 0; i < 10; i++) { resultEl.textContent = (rnd() * 100).toFixed(2); await sleep(45); }
    const v = Math.round(rnd() * 10000) / 100;
    resultEl.textContent = v.toFixed(2);
    const won = over ? v > target : v < target;
    resultEl.style.color = won ? 'var(--win)' : 'var(--lose)';
    const pay = won ? round2(stake * mult) : 0;
    if (pay) { wallet.pay(pay); msg.win(pay - stake, `${v.toFixed(2)} ${over ? '>' : '<'} ${target} ·`, stake); }
    else msg.lose(`${v.toFixed(2)} — ${over ? 'not over' : 'not under'} ${target}`);
    wallet.logResult(id, stake, pay);
    busy = false; bp.unlock();
  }

  sync();
  root.append(el('div.dice-scene', {}, feltBg, resultEl),
    el('div.slider-wrap', {}, rail, range, scale), stats, msg.node, bp.node,
    rules('DICE',
      `A number from <code>0.00</code> to <code>100.00</code> is rolled. Set your threshold and pick a side.`,
      `The payout is always <code>99 ÷ win chance</code>, so a 2% shot pays <code>49.5×</code> and a 95% shot pays <code>1.04×</code>.`,
      `Every setting has the same <code>1%</code> house edge — only the variance changes.`,
      `Rolls use <code>crypto.getRandomValues</code>; past results carry no information.`));
}

/* ============================================================ LIMBO */
function limbo(root) {
  const id = 'limbo';
  let busy = false;
  const resultEl = el('div.lb-value', {}, '—');
  const bar = el('div.lb-bar', { 'aria-hidden': 'true' });
  const marker = el('div.lb-target', { 'aria-hidden': 'true' });
  const sky = el('div.lb-scene', {}, bar, marker, resultEl);
  const msg = msgLine();
  const stats = el('div.readout');
  const targetInput = el('input', { type: 'text', inputmode: 'decimal', value: '2.00' });
  const target = () => Math.min(1000000, Math.max(1.01, parseFloat(targetInput.value) || 2));
  /* Height on the gauge is logarithmic — 1x sits at the floor, 100x near the top. */
  const heightFor = (m) => Math.max(0, Math.min(100, Math.log(Math.max(1, m)) / Math.log(100) * 100));
  const sync = () => {
    targetInput.value = target().toFixed(2);
    stats.innerHTML = `win chance <b>${(EDGE / target() * 100).toFixed(4)}%</b> · pays <b>${target().toFixed(2)}×</b>`;
    marker.style.bottom = heightFor(target()) + '%';
    marker.dataset.v = target().toFixed(2) + 'x';
  };
  targetInput.addEventListener('change', sync);
  const bump = (f) => { targetInput.value = (target() * f).toFixed(2); sync(); };

  const bp = betPanel({
    start: 25, min: 1, max: 2000, action: 'PLAY', onAction: play,
    extra: [el('div.field', {}, el('label', {}, 'TARGET MULTIPLIER'),
      el('div.stepper', {}, el('button', { type: 'button', onclick: () => bump(0.5) }, '½'),
        targetInput, el('button', { type: 'button', onclick: () => bump(2) }, '2×')))],
  });

  async function play() {
    if (busy) return;
    const stake = bp.value, t = target();
    if (!bp.take()) return;
    busy = true; bp.lock();
    bar.classList.add('rising');
    for (let i = 0; i < 10; i++) {
      const step = 1 + rnd() * 5;
      resultEl.textContent = fmtx(step);
      bar.style.height = heightFor(step) + '%';
      await sleep(45);
    }
    const r = Math.max(1, Math.floor(100 * EDGE / (1 - rnd())) / 100);
    resultEl.textContent = fmtx(r);
    bar.style.height = heightFor(r) + '%';
    bar.classList.remove('rising');
    const won = r >= t;
    bar.classList.toggle('won', won);
    bar.classList.toggle('lost', !won);
    resultEl.style.color = won ? 'var(--win)' : 'var(--lose)';
    const pay = won ? round2(stake * t) : 0;
    if (pay) { wallet.pay(pay); msg.win(pay - stake, `${fmtx(r)} cleared ${fmtx(t)} ·`, stake); }
    else msg.lose(`${fmtx(r)} fell short of ${fmtx(t)}`);
    wallet.logResult(id, stake, pay);
    busy = false; bp.unlock();
  }

  sync();
  root.append(sky, stats, msg.node, bp.node,
    rules('LIMBO',
      `Set a target multiplier. A random multiplier is generated — if it lands at or above your target, you win that multiple.`,
      `The result is drawn from <code>0.99 ÷ (1 − r)</code>, the same curve that drives Crash, but resolved instantly.`,
      `Win chance is always <code>99 ÷ target</code>. A <code>100×</code> target hits about once in 101 plays.`,
      `Theoretical return <code>99%</code> at every target.`));
}

/* ============================================================ WHEEL */
const WHEEL_SEG = [0, 1.2, 1.5, 1.2, 0, 1.9, 1.2, 1.5, 0, 1.2, 2.0, 0];
function wheelGame(root) {
  const id = 'wheel';
  let busy = false, rotation = 0;
  const seg = 360 / WHEEL_SEG.length;
  const stops = WHEEL_SEG.map((m, i) => {
    const c = m === 0 ? '#2b2f52' : m >= 2 ? '#f5c451' : m >= 1.5 ? '#7b5bff' : '#3ddc84';
    return `${c} ${(i * seg).toFixed(3)}deg ${((i + 1) * seg).toFixed(3)}deg`;
  }).join(',');
  const disc = el('div.fw', { style: { background: `conic-gradient(${stops})` } });
  const wrap = el('div.fw-wrap', {}, el('div.fw-ptr', {}, '▼'), disc);
  const legend = el('div.paytable', {},
    [...new Set(WHEEL_SEG)].sort((a, b) => a - b).map((m) =>
      el('div.pt', {},
        el('span', { style: { width: '14px', height: '14px', borderRadius: '4px', background: m === 0 ? '#2b2f52' : m >= 2 ? '#f5c451' : m >= 1.5 ? '#7b5bff' : '#3ddc84' } }),
        `${WHEEL_SEG.filter((x) => x === m).length}/12`, el('b', {}, m + '×'))));
  const msg = msgLine();
  const bp = betPanel({ start: 25, min: 1, max: 2000, action: 'SPIN', onAction: spin });

  async function spin() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); msg.clear();
    const idx = rndInt(WHEEL_SEG.length);
    rotation += 360 * 5 + (360 - (idx * seg + seg / 2));
    disc.style.transform = `rotate(${rotation}deg)`;
    await sleep(4500);
    const mult = WHEEL_SEG[idx];
    const payout = round2(stake * mult);
    if (payout > 0) wallet.pay(payout);
    if (payout > stake) msg.win(payout - stake, `${mult}× ·`, stake);
    else if (payout === stake) msg.push(`${mult}× — stake back`);
    else msg.lose(`${mult}× — no win`);
    wallet.logResult(id, stake, payout);
    busy = false; bp.unlock();
  }

  root.append(wrap, msg.node, bp.node, legend,
    rules('WHEEL OF FORTUNE',
      `Twelve equal segments. Four are blanks, the rest pay between <code>1.2×</code> and <code>2×</code> your stake.`,
      `Every segment is exactly <code>30°</code> — the landing pocket is chosen first, the animation just shows it.`,
      `Theoretical return <code>97.5%</code>.`));
}

/* ============================================================ COIN FLIP */
function coinFlip(root) {
  const id = 'coin-flip';
  let side = 'heads', busy = false;
  const face = el('div.coin-face.heads');
  const coin = el('div.coin3d-wrap', {}, face);
  const msg = msgLine();
  const picker = optGrid([
    { key: 'heads', label: '👑 HEADS', sub: '1.98×' },
    { key: 'tails', label: '🦅 TAILS', sub: '1.98×' },
  ], (k) => { side = k; });
  const bp = betPanel({ start: 25, min: 1, max: 5000, action: 'FLIP', onAction: flip });

  async function flip() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); msg.clear();
    play('whoosh');
    face.classList.add('flipping');
    for (let i = 0; i < 12; i++) {
      face.className = 'coin-face flipping ' + (i % 2 ? 'heads' : 'tails');
      await sleep(70);
    }
    const res = rndInt(2) ? 'heads' : 'tails';
    face.className = 'coin-face landed ' + res;
    play('coin');
    setTimeout(() => { face.className = 'coin-face ' + res; }, 640);
    const payout = res === side ? round2(stake * 1.98) : 0;
    if (payout) { wallet.pay(payout); msg.win(payout - stake, `${res.toUpperCase()} ·`, stake); }
    else msg.lose(`${res.toUpperCase()} — you called ${side}`);
    wallet.logResult(id, stake, payout);
    busy = false; bp.unlock();
  }
  root.append(coin, msg.node, el('div', { style: { marginTop: '16px' } }, picker), bp.node,
    rules('COIN FLIP',
      `A true 50/50 call paying <code>1.98×</code> — the cleanest bet on the site.`,
      `House edge <code>1%</code>. No streaks, no memory: each flip is independent.`));
}

/* ============================================================ SCRATCH CARD */
const SC_PRIZES = [2, 5, 10, 25, 100, 500];
const SC_WEIGHTS = [0.68, 0.22, 0.07, 0.022, 0.006, 0.002];
const SC_SYMS = ['🍒', '🔔', '⭐', '💎', '👑', '🎰', '🍀', '💰'];
const SC_CARDS = {
  'scratch-gold': { label: 'SCRATCH GOLD', chance: 0.177, prizes: SC_PRIZES, weights: SC_WEIGHTS,
    syms: SC_SYMS, top: 500 },
  'scratch-diamonds': { label: 'DIAMOND SCRATCH', chance: 0.132, prizes: [3, 8, 20, 60, 250, 1500],
    weights: [0.66, 0.23, 0.07, 0.028, 0.009, 0.003],
    syms: ['💎', '💍', '🔷', '🔶', '✨', '👑', '🥇', '🪙'], top: 1500 },
  'scratch-lucky7': { label: 'LUCKY SEVENS', chance: 0.245, prizes: [1.5, 3, 7, 20, 77, 777],
    weights: [0.62, 0.26, 0.09, 0.024, 0.005, 0.001],
    syms: ['7️⃣', '🍒', '🔔', '🍋', '⭐', '🎰', '🍀', '💵'], top: 777 },
};
function scratch({ id }) {
  const CFG = SC_CARDS[id];
  return function mount(root) {
  let busy = false, layout = [], revealed = 0, prize = 0, winSym = null, currentStake = 0;
  const grid = el('div.scratch-grid.foil');
  const msg = msgLine();
  const cellEls = [];
  for (let i = 0; i < 9; i++) {
    const c = el('div.sc', {}, '?');
    c.addEventListener('click', () => reveal(i));
    cellEls.push(c); grid.append(c);
  }
  const bp = betPanel({ start: 10, min: 1, max: 500, action: 'BUY CARD', onAction: buy });
  const btnAll = el('button.btn', { type: 'button', onclick: revealAll }, 'REVEAL ALL');
  btnAll.hidden = true;

  function buy() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); btnAll.hidden = false; msg.set('Scratch the panels', 'push');
    revealed = 0;

    const isWin = rnd() < CFG.chance;
    prize = 0; winSym = null;
    const syms = shuffle([...CFG.syms]);
    layout = [];
    if (isWin) {
      prize = CFG.prizes[weighted(CFG.weights)];
      winSym = syms[0];
      layout = [winSym, winSym, winSym];
      // fill the rest with at most two of any other symbol
      const others = syms.slice(1);
      for (let i = 0; i < 6; i++) layout.push(others[i % 3]);
      layout = shuffle(layout);
    } else {
      const others = syms.slice(0, 4);
      layout = [others[0], others[0], others[1], others[1], others[2], others[2], others[3], others[3], others[0]];
      // guarantee no triple
      const counts = {};
      layout.forEach((s) => (counts[s] = (counts[s] || 0) + 1));
      for (const [s, n] of Object.entries(counts)) if (n >= 3) layout[layout.lastIndexOf(s)] = syms[5];
      layout = shuffle(layout);
    }
    cellEls.forEach((c) => { c.className = 'sc'; c.textContent = '?'; });
    currentStake = stake;
  }

  function reveal(i) {
    if (!busy || cellEls[i].classList.contains('rev')) return;
    cellEls[i].classList.add('rev'); play('cardFlip');
    cellEls[i].textContent = layout[i];
    if (++revealed === 9) settle();
  }
  function revealAll() { for (let i = 0; i < 9; i++) reveal(i); }
  function settle() {
    btnAll.hidden = true;
    const payout = round2(currentStake * prize);
    if (payout > 0) {
      cellEls.forEach((c, i) => { if (layout[i] === winSym) c.classList.add('wincell'); });
      wallet.pay(payout);
      msg.win(payout - currentStake, `Three ${winSym} — ${prize}× ·`, currentStake);
    } else msg.lose('No three matching symbols');
    wallet.logResult(id, currentStake, payout);
    busy = false; bp.unlock();
  }

  root.append(grid, msg.node,
    el('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' } }, bp.node, btnAll),
    rules(CFG.label,
      `Buy a card and scratch nine panels. <b>Three matching symbols</b> anywhere on the card wins.`,
      `Prizes run from <code>${CFG.prizes[0]}×</code> up to the top prize of <code>${CFG.top}×</code>.`,
      `Roughly <b>1 card in ${(1 / CFG.chance).toFixed(1)}</b> is a winner. The prize is decided when you buy — scratching only reveals it.`,
      `Theoretical return <code>94%</code>.`));
  };
}

/* ============================================================ TOWER */
function tower(root) {
  const id = 'tower';
  const LEVELS = 8;
  let live = false, stake = 0, level = 0, safeIdx = [];
  const grid = el('div.tw-grid');
  const scene = el('div.tw-scene', {}, el('div.tw-prize', { 'aria-hidden': 'true' }), grid);
  const rows = [];
  const msg = msgLine();
  const info = el('div.readout');
  const bp = betPanel({ start: 25, min: 1, max: 2000, action: 'START CLIMB', onAction: go });
  const btnOut = el('button.btn.btn-gold.btn-lg', { type: 'button', onclick: cashOut }, 'CASH OUT');
  btnOut.hidden = true;

  const multAt = (lv) => Math.round(EDGE * Math.pow(1.5, lv) * 100) / 100;

  for (let r = LEVELS - 1; r >= 0; r--) {
    const row = [];
    const rowEl = el('div.tw-row');
    for (let c = 0; c < 3; c++) {
      const t = el('button.tw-door', { type: 'button', 'aria-label': `Level ${r + 1}, door ${c + 1}` });
      t.addEventListener('click', () => step(r, c));
      row[c] = t; rowEl.append(t);
    }
    rows[r] = row;
    grid.append(rowEl);
  }
  function paint() {
    rows.forEach((row, r) => row.forEach((t) => {
      t.classList.toggle('dim', live && r !== level);
      t.classList.toggle('now', live && r === level);
    }));
    scene.style.setProperty('--climb', live ? Math.min(level, LEVELS) : 0);
    info.textContent = live
      ? `level ${level + 1}/${LEVELS} · banked ${fmtx(multAt(level))} · next ${fmtx(multAt(level + 1))}`
      : `Each level: 2 of 3 doors are safe · ${fmtx(multAt(1))} per step, up to ${fmtx(multAt(LEVELS))}`;
    btnOut.textContent = `CASH OUT ${fmt(round2(stake * multAt(level)))}`;
  }
  function go() {
    if (live) return;
    stake = bp.value;
    if (!bp.take()) return;
    rows.forEach((row) => row.forEach((t) => { t.className = 'tw-door'; }));
    safeIdx = Array.from({ length: LEVELS }, () => rndInt(3));   // index of the BOMB
    level = 0; live = true; bp.lock(); btnOut.hidden = false;
    msg.set('Pick a door on the bottom row', 'push'); paint();
  }
  function step(r, c) {
    if (!live || r !== level) return;
    if (c === safeIdx[r]) {
      rows[r].forEach((t, i) => { t.className = 'tw-door done ' + (i === safeIdx[r] ? 'trap' : 'safe'); });
      msg.lose(`Trapdoor on level ${r + 1}`);
      wallet.logResult(id, stake, 0);
      return end();
    }
    rows[r][c].className = 'tw-door safe done'; play('gem');
    level++;
    if (level >= LEVELS) return cashOut();
    msg.set(`Level ${level} cleared — ${fmtx(multAt(level))}`, 'win');
    paint();
  }
  function cashOut() {
    if (!live || level === 0) { if (level === 0) toast('Clear a level first.'); return; }
    const payout = round2(stake * multAt(level));
    wallet.pay(payout);
    msg.win(payout - stake, `Cashed out on level ${level} at ${fmtx(multAt(level))} ·`, stake);
    wallet.logResult(id, stake, payout);
    end();
  }
  function end() {
    live = false; btnOut.hidden = true; bp.unlock();
    rows.forEach((row) => row.forEach((t) => t.classList.remove('dim', 'now')));
    paint();
  }

  paint();
  root.append(scene, info, msg.node,
    el('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' } }, bp.node, btnOut),
    rules('TOWER',
      `Climb eight levels. Each level has three doors — <b>two are safe, one is a trapdoor</b>.`,
      `Every cleared level multiplies your stake by <code>1.5×</code>. Reaching the top pays <code>${fmtx(multAt(LEVELS))}</code>.`,
      `Cash out at any level. One wrong door loses everything.`,
      `Theoretical return <code>99%</code> at every cash-out point.`));
}

/* ============================================================ ROCK PAPER SCISSORS */
function rps(root) {
  const id = 'rps';
  let busy = false;
  const MOVES = [{ k: 'rock', e: '✊' }, { k: 'paper', e: '✋' }, { k: 'scissors', e: '✌️' }];
  const you = el('div.rps-hand.me.rock');
  const them = el('div.rps-hand.rock');
  const arena = el('div.rps-arena', {}, you, el('div.rps-vs', {}, 'VS'), them);
  const msg = msgLine();
  let choice = 'rock';
  const picker = optGrid(MOVES.map((m) => ({ key: m.k, label: `${m.e} ${m.k.toUpperCase()}`, sub: 'win 1.94×' })), (k) => { choice = k; });
  const bp = betPanel({ start: 25, min: 1, max: 2000, action: 'THROW', onAction: play });

  async function play() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); msg.clear();
    you.classList.add('shaking'); them.classList.add('shaking');
    for (let i = 0; i < 9; i++) {
      them.className = 'rps-hand shaking ' + MOVES[i % 3].k;
      you.className = 'rps-hand me shaking ' + MOVES[(i + 1) % 3].k;
      await sleep(80);
    }
    const mine = MOVES.find((m) => m.k === choice);
    const theirs = MOVES[rndInt(3)];
    you.className = 'rps-hand me ' + mine.k;
    them.className = 'rps-hand ' + theirs.k;
    play('click');
    const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    let payout = 0;
    if (mine.k === theirs.k) { payout = stake; wallet.pay(payout); msg.push(`Both ${mine.k} — push`); }
    else if (beats[mine.k] === theirs.k) { payout = round2(stake * 1.94); wallet.pay(payout); msg.win(payout - stake, `${mine.k} beats ${theirs.k} ·`, stake); }
    else msg.lose(`${theirs.k} beats ${mine.k}`);
    wallet.logResult(id, stake, payout);
    busy = false; bp.unlock();
  }
  root.append(arena, msg.node, el('div', { style: { marginTop: '14px' } }, picker), bp.node,
    rules('ROCK PAPER SCISSORS',
      `The house throws at random — no reading, no patterns.`,
      `A win pays <code>1.94×</code>, a tie returns your stake, a loss takes it.`,
      `Theoretical return <code>98%</code>.`));
}

/* ============================================================ exports */
export const instantGames = [
  G({ id: 'crash', name: 'Crash', cat: 'instant', icon: '🚀', art: 'linear-gradient(160deg,#121c3d,#0b0d1c)', rtp: 99.0, vol: 'High', tags: ['hot'], mount: crash }),
  G({ id: 'mines', name: 'Mines', cat: 'instant', icon: '💣', art: 'linear-gradient(160deg,#123d33,#0b0d1c)', rtp: 99.0, vol: 'High', tags: ['hot'], mount: mines }),
  G({ id: 'plinko', name: 'Plinko', cat: 'instant', icon: '🔺', art: 'linear-gradient(160deg,#2a1d52,#0b0d1c)', rtp: 99.0, vol: 'High', mount: plinko({ id: 'plinko' }) }),
  G({ id: 'plinko-low', name: 'Plinko Low Risk', cat: 'instant', icon: '🔻', art: 'linear-gradient(160deg,#123d33,#0b0d1c)', rtp: 99.0, vol: 'Low', mount: plinko({ id: 'plinko-low', risk: 'low' }) }),
  G({ id: 'plinko-high', name: 'Plinko High Risk', cat: 'instant', icon: '🔺', art: 'linear-gradient(160deg,#4d1236,#0b0d1c)', rtp: 99.0, vol: 'High', tags: ['hot'], mount: plinko({ id: 'plinko-high', risk: 'high' }) }),
  G({ id: 'dice', name: 'Dice', cat: 'instant', icon: '🎲', art: 'linear-gradient(160deg,#3d1230,#0b0d1c)', rtp: 99.0, vol: 'Medium', mount: diceGame }),
  G({ id: 'limbo', name: 'Limbo', cat: 'instant', icon: '📈', art: 'linear-gradient(160deg,#12303d,#0b0d1c)', rtp: 99.0, vol: 'High', mount: limbo }),
  G({ id: 'wheel', name: 'Wheel of Fortune', cat: 'instant', icon: '🎡', art: 'linear-gradient(160deg,#3d2c12,#0b0d1c)', rtp: 97.5, vol: 'Low', mount: wheelGame }),
  G({ id: 'coin-flip', name: 'Coin Flip', cat: 'instant', icon: '🪙', art: 'linear-gradient(160deg,#3d3312,#0b0d1c)', rtp: 99.0, vol: 'Low', mount: coinFlip }),
  G({ id: 'scratch-gold', name: 'Scratch Gold', cat: 'lottery', icon: '🎫', art: 'linear-gradient(160deg,#4d2a12,#0b0d1c)', rtp: 94.0, vol: 'High', mount: scratch({ id: 'scratch-gold' }) }),
  G({ id: 'scratch-diamonds', name: 'Diamond Scratch', cat: 'lottery', icon: '💎', art: 'linear-gradient(160deg,#123a4d,#0b0d1c)', rtp: 94.0, vol: 'High', tags: ['new'], mount: scratch({ id: 'scratch-diamonds' }) }),
  G({ id: 'scratch-lucky7', name: 'Lucky Sevens', cat: 'lottery', icon: '7️⃣', art: 'linear-gradient(160deg,#4d1224,#0b0d1c)', rtp: 94.0, vol: 'Medium', mount: scratch({ id: 'scratch-lucky7' }) }),
  G({ id: 'tower', name: 'Tower', cat: 'instant', icon: '🗼', art: 'linear-gradient(160deg,#1d2a52,#0b0d1c)', rtp: 99.0, vol: 'High', tags: ['new'], mount: tower }),
  G({ id: 'penalty', name: 'Penalty Shootout', cat: 'instant', icon: '⚽', art: 'linear-gradient(160deg,#123d1d,#0b0d1c)', rtp: 99.0, vol: 'Medium', tags: ['hot'], mount: penalty }),
  G({ id: 'rps', name: 'Rock Paper Scissors', cat: 'instant', icon: '✊', art: 'linear-gradient(160deg,#4d1236,#0b0d1c)', rtp: 98.0, vol: 'Low', mount: rps }),
];
