/* Instant-game engines B: streak, wheelx, dig, ladder, catch,
   safe, burst, draw, trail, fuse. */
import {
  el, fmt, rnd, rndInt, shuffle, sleep, round2, msgLine, play,
  EDGE, fairMult, scene, readout, historyRow, ladderMults, pickDistinct, settle, choices,
} from './eng-core.js';
import { betPanel, rules } from '../ui.js';
import { coinBurst as burst } from '../fx.js';

const pct = (x) => (x * 100).toFixed(1) + '%';

/* ═══════════════════════════════════════════ 11. STREAK
   Call the next reading higher or lower than the current one. Because the
   current value is known, the odds are known too — and they are shown. */
export const streak = (t) => (root) => {
  const FACES = 13;                   // readings 1..13
  let live = false, stake = 0, run = 0, mult = 1, cur = 7;

  const dial = el('div.streak-dial', {}, el('span.streak-n', {}, '7'));
  const nextEl = el('div.streak-next', { 'aria-hidden': 'true' });
  const stageEl = el('div.streak-stage', {}, dial, nextEl);
  const multEl = readout('MULTIPLIER', '1.00×');
  const msg = msgLine();
  const hist = historyRow();

  const hiBtn = el('button.btn.btn-green', { type: 'button' }, 'HIGHER');
  const loBtn = el('button.btn.btn-red', { type: 'button' }, 'LOWER');
  hiBtn.addEventListener('click', () => call(1));
  loBtn.addEventListener('click', () => call(-1));
  const bp = betPanel({ start: 25, min: 1, action: 'START', onAction: start,
    extra: [el('div.field', {}, el('label', {}, 'CALL'), el('div.eng-pair', {}, hiBtn, loBtn))] });

  /* Ties go to the house on both calls, which is where part of the edge
     comes from — so quote the strict probability, not a rounded-up one. */
  const pHigher = () => (FACES - cur) / FACES;
  const pLower = () => (cur - 1) / FACES;

  function paint() {
    dial.firstChild.textContent = String(cur);
    multEl.set(mult.toFixed(2) + '×');
    hiBtn.textContent = `HIGHER ${(EDGE / pHigher()).toFixed(2)}×`;
    loBtn.textContent = `LOWER ${pLower() > 0 ? (EDGE / pLower()).toFixed(2) + '×' : '—'}`;
    hiBtn.disabled = !live || pHigher() === 0;
    loBtn.disabled = !live || pLower() === 0;
  }

  function start() {
    if (live) return;
    stake = bp.value;
    if (!bp.take()) return;
    live = true; run = 0; mult = 1; cur = 1 + rndInt(FACES);
    bp.lock(); bp.setAction('CASH OUT', 'btn-green'); bp.actionBtn.disabled = true;
    paint();
    msg.set(`Showing ${cur} — call the next reading`, 'push');
  }

  async function call(dir) {
    if (!live) return;
    hiBtn.disabled = loBtn.disabled = true;
    const p = dir > 0 ? pHigher() : pLower();
    const next = 1 + rndInt(FACES);
    nextEl.classList.add('spin');
    play('whoosh');
    await sleep(420);
    nextEl.classList.remove('spin');

    const won = dir > 0 ? next > cur : next < cur;
    cur = next;
    if (!won) {
      dial.classList.add('bad');
      play('lose');
      settle({ id: t.id, stake, payout: 0, msg, loseLabel: `It came up ${next} — streak ended at ${run}` });
      hist.push(String(run), 'lose');
      return finish();
    }
    dial.classList.remove('bad');
    run++;
    mult = round2(mult * (1 / p));
    play('chip');
    paint();
    bp.actionBtn.disabled = false;
    msg.set(`${next} — streak ${run} · cash out for ${fmt(round2(stake * mult * EDGE))}`, 'push');
  }

  function cashOut() {
    if (!live || run === 0) return;
    const payout = round2(stake * mult * EDGE);
    burst(dial);
    settle({ id: t.id, stake, payout, msg, winLabel: `Streak of ${run} — ${(mult * EDGE).toFixed(2)}×` });
    hist.push(String(run), 'win');
    finish();
  }
  function finish() {
    live = false; hiBtn.disabled = loBtn.disabled = true;
    bp.unlock(); bp.setAction('START', 'btn-gold'); bp.actionBtn.disabled = false;
  }
  bp.actionBtn.addEventListener('click', () => { if (live) cashOut(); });

  paint();
  root.append(scene(t, stageEl, multEl.node), hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `Readings run <b>1 to ${FACES}</b>, drawn independently each time. Call whether the next one is higher or lower.`,
      `The price is always the true odds from the reading on screen — calling higher on a <code>2</code> is cheap, calling higher on a <code>12</code> is not.`,
      `A <b>tie repeats the value and ends the streak</b>, and that is where much of the edge lives.`,
      `Correct calls compound. Cash out any time to bank the running multiplier less the <code>1%</code> edge.`));
};

/* ═══════════════════════════════════════════ 12. WHEELX
   A segmented prize wheel; the risk profile is the player's to choose. */
export const wheelx = (t) => (root) => {
  const PROFILES = {
    /* Every profile sums to 11.7 across twelve segments, so all three return
       the same amount and only the shape of the ride differs. */
    low:  { label: 'LOW', segs: [1.2, 1.2, 0, 1.2, 1.2, 2.1, 1.2, 0, 1.2, 1.2, 0, 1.2] },
    med:  { label: 'MEDIUM', segs: [0, 1.5, 0, 2.2, 1.5, 0, 1.8, 0, 0, 3.2, 1.5, 0] },
    high: { label: 'HIGH', segs: [0, 0, 0, 0, 9.7, 0, 0, 0, 0, 0, 2, 0] },
  };
  let profile = 'med', busy = false, rotation = 0;

  const disc = el('div.wx-disc');
  const wheelBox = el('div.wx-box', {}, el('div.wx-pointer', { 'aria-hidden': 'true' }), disc);
  const msg = msgLine();
  const hist = historyRow();
  const segRow = el('div.wx-legend');

  function build() {
    const segs = PROFILES[profile].segs;
    const step = 360 / segs.length;
    disc.style.background = `conic-gradient(${segs.map((v, i) =>
      `${v === 0 ? 'rgba(255,255,255,.06)' : v >= 5 ? t.accent : v >= 2 ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.13)'} ${i * step}deg ${(i + 1) * step}deg`).join(',')})`;
    disc.replaceChildren(...segs.map((v, i) =>
      el('span.wx-seg', { style: { '--a': `${i * step + step / 2}deg` } }, v === 0 ? '—' : v + '×')));
    const uniq = [...new Set(segs)].sort((a, b) => b - a);
    segRow.replaceChildren(...uniq.map((v) =>
      el('span.wx-chip', {}, `${v === 0 ? 'nothing' : v + '×'} · ${segs.filter((s) => s === v).length}/${segs.length}`)));
  }

  const modes = choices(Object.values(PROFILES).map((p) => p.label), (i) => {
    if (busy) return;
    profile = Object.keys(PROFILES)[i]; modes.select(i); build(); play('click');
    msg.set(`${PROFILES[profile].label} risk — top prize ${Math.max(...PROFILES[profile].segs)}×`, 'push');
  });
  const bp = betPanel({ start: 25, min: 1, action: 'SPIN', onAction: spin });

  async function spin() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); modes.lock(true);

    const segs = PROFILES[profile].segs;
    const step = 360 / segs.length;
    const idx = rndInt(segs.length);
    rotation += 360 * 4 + (360 - (idx * step + step / 2)) - (rotation % 360);
    disc.style.transform = `rotate(${rotation}deg)`;
    const stopTick = (() => {
      let n = 0;
      const iv = setInterval(() => { play('wheelTick'); if (++n > 40) clearInterval(iv); }, 95);
      return () => clearInterval(iv);
    })();
    await sleep(4200);
    stopTick();

    const v = segs[idx];
    const payout = round2(stake * v * EDGE);
    if (payout > stake) { play('win'); burst(wheelBox); } else if (!payout) play('lose');
    settle({ id: t.id, stake, payout, msg,
      winLabel: `Landed ${v}×`, loseLabel: 'Landed on a blank' });
    hist.push(v === 0 ? '—' : v + '×', payout > stake ? 'win' : 'lose');
    busy = false; bp.unlock(); modes.lock(false);
  }

  build(); modes.select(1);
  root.append(scene(t, wheelBox), segRow, el('div.eng-row', {}, modes.node), hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `Twelve segments, one pointer. Choose the risk profile before you spin — the segment mix is listed above the wheel, always.`,
      `<b>Low</b> hits something on nine of twelve spins but tops out at <code>2.1×</code>. <b>High</b> is blank ten times in twelve and pays <code>9.7×</code>.`,
      `All three profiles return the same <code>${(EDGE * 100).toFixed(0)}%</code> over time.`,
      `The landing segment is drawn before the wheel starts turning — the animation only shows you the result.`));
};

/* ═══════════════════════════════════════════ 13. DIG
   A minefield on a grid you size yourself. */
export const dig = (t) => (root) => {
  const SIZE = 25;
  let hazards = 3, live = false, stake = 0, found = 0, mines = new Set();

  const grid = el('div.dig-grid');
  const cells = Array.from({ length: SIZE }, (_, i) => {
    const c = el('button.dig-cell', { type: 'button', 'aria-label': `Tile ${i + 1}` });
    c.addEventListener('click', () => turn(i));
    grid.append(c); return c;
  });
  const cur = readout('NEXT TILE', '—');
  const msg = msgLine();
  const hist = historyRow();

  const hazRow = choices(['3', '5', '8', '12'], (i) => {
    if (live) return;
    hazards = [3, 5, 8, 12][i]; hazRow.select(i); paint(); play('click');
  });
  const bp = betPanel({ start: 25, min: 1, action: 'DIG IN', onAction: start });

  /* After `k` safe tiles the fair price is the inverse of the chance of having
     got that far: C(safe,k)/C(SIZE,k). Edge applied once at the end. */
  function multAfter(k) {
    const safe = SIZE - hazards;
    let inv = 1;
    for (let i = 0; i < k; i++) inv *= (safe - i) / (SIZE - i);
    return round2(EDGE / inv);
  }
  function paint() {
    cur.set(live ? multAfter(found + 1).toFixed(2) + '×' : multAfter(1).toFixed(2) + '×');
  }

  function start() {
    if (live) return;
    stake = bp.value;
    if (!bp.take()) return;
    mines = pickDistinct(SIZE, hazards);
    live = true; found = 0;
    cells.forEach((c) => { c.className = 'dig-cell'; c.disabled = false; c.replaceChildren(); });
    bp.lock(); bp.setAction('CASH OUT', 'btn-green'); bp.actionBtn.disabled = true;
    hazRow.lock(true); paint();
    msg.set(`${hazards} hazards hidden in ${SIZE} tiles`, 'push');
  }

  function turn(i) {
    if (!live || cells[i].disabled) return;
    cells[i].disabled = true;
    if (mines.has(i)) {
      cells[i].className = 'dig-cell hazard';
      cells[i].replaceChildren(el('span', {}, t.emblem));
      play('lose');
      revealAll();
      settle({ id: t.id, stake, payout: 0, msg, loseLabel: `Hit a hazard after ${found} safe tile${found === 1 ? '' : 's'}` });
      hist.push(String(found), 'lose');
      return finish();
    }
    found++;
    cells[i].className = 'dig-cell safe';
    cells[i].replaceChildren(el('span', {}, '✦'));
    play('chip');
    paint();
    bp.actionBtn.disabled = false;
    msg.set(`${found} safe — cash out for ${fmt(round2(stake * multAfter(found)))}`, 'push');
    if (found === SIZE - hazards) cashOut();
  }

  function revealAll() {
    cells.forEach((c, i) => {
      c.disabled = true;
      if (mines.has(i) && !c.classList.contains('hazard')) {
        c.classList.add('shown'); c.replaceChildren(el('span', {}, t.emblem));
      }
    });
  }
  function cashOut() {
    if (!live || found === 0) return;
    revealAll();
    const payout = round2(stake * multAfter(found));
    burst(grid);
    settle({ id: t.id, stake, payout, msg, winLabel: `${found} tiles — ${multAfter(found).toFixed(2)}×` });
    hist.push(String(found), 'win');
    finish();
  }
  function finish() {
    live = false; hazRow.lock(false);
    bp.unlock(); bp.setAction('DIG IN', 'btn-gold'); bp.actionBtn.disabled = false;
  }
  bp.actionBtn.addEventListener('click', () => { if (live) cashOut(); });

  hazRow.select(0); paint();
  root.append(scene(t, grid, cur.node),
    el('div.eng-row', {}, el('span.eng-lab', {}, 'HAZARDS'), hazRow.node),
    hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `${SIZE} tiles hide the hazards you choose — <code>3</code>, <code>5</code>, <code>8</code> or <code>12</code>.`,
      `Every safe tile raises the price to exactly the inverse of your chance of having got that far, so the ladder is fair at every depth.`,
      `With <code>3</code> hazards, five safe tiles pays <code>${(() => { const s = SIZE - 3; let inv = 1; for (let i = 0; i < 5; i++) inv *= (s - i) / (SIZE - i); return round2(EDGE / inv).toFixed(2); })()}×</code>; with <code>12</code> it pays <code>${(() => { const s = SIZE - 12; let inv = 1; for (let i = 0; i < 5; i++) inv *= (s - i) / (SIZE - i); return round2(EDGE / inv).toFixed(2); })()}×</code>.`,
      `Hazard positions are drawn once at the start and never move.`));
};

/* ═══════════════════════════════════════════ 14. LADDER
   Fixed rungs with published survival odds that tighten as you climb. */
export const ladder = (t) => (root) => {
  const RUNGS = 8;
  /* Survival gets harder the higher you go, so the prize has to grow faster
     than a flat ladder would. Each entry is [survival chance, multiplier]. */
  const P = Array.from({ length: RUNGS }, (_, i) => 0.9 - i * 0.06);
  const MULTS = P.reduce((acc, p, i) => {
    acc.push(round2(EDGE / P.slice(0, i + 1).reduce((a, b) => a * b, 1)));
    return acc;
  }, []);
  let live = false, stake = 0, at = 0;

  const col = el('div.lad-col');
  const rungs = Array.from({ length: RUNGS }, (_, i) => {
    const r = el('div.lad-rung', {},
      el('span.lad-x', {}, MULTS[RUNGS - 1 - i].toFixed(2) + '×'),
      el('span.lad-p', {}, pct(P[RUNGS - 1 - i])));
    col.append(r); return r;
  }).reverse();                                   // rungs[0] is the bottom
  const climber = el('div.lad-climber', { 'aria-hidden': 'true' });
  const stageEl = el('div.lad-stage', {}, col, climber);
  const msg = msgLine();
  const hist = historyRow();

  const upBtn = el('button.btn.btn-gold.btn-lg', { type: 'button' }, 'CLIMB');
  upBtn.addEventListener('click', climb);
  const bp = betPanel({ start: 25, min: 1, action: 'START', onAction: start,
    extra: [el('div.field', {}, el('label', {}, 'ASCEND'), upBtn)] });
  upBtn.disabled = true;

  function paint() {
    rungs.forEach((r, i) => r.classList.toggle('done', i < at));
    climber.style.setProperty('--at', at);
  }

  function start() {
    if (live) return;
    stake = bp.value;
    if (!bp.take()) return;
    live = true; at = 0;
    rungs.forEach((r) => r.classList.remove('done', 'fail'));
    paint();
    bp.lock(); bp.setAction('CASH OUT', 'btn-green'); bp.actionBtn.disabled = true;
    upBtn.disabled = false;
    msg.set(`First rung holds ${pct(P[0])} of the time`, 'push');
  }

  async function climb() {
    if (!live) return;
    upBtn.disabled = true;
    const held = rnd() < P[at];
    climber.classList.add('up');
    play('whoosh');
    await sleep(320);
    climber.classList.remove('up');
    if (!held) {
      rungs[at].classList.add('fail');
      play('lose');
      settle({ id: t.id, stake, payout: 0, msg, loseLabel: `Rung ${at + 1} gave way` });
      hist.push(String(at), 'lose');
      return finish();
    }
    at++;
    play('chip');
    paint();
    bp.actionBtn.disabled = false;
    if (at >= RUNGS) return cashOut();
    msg.set(`Rung ${at} — ${MULTS[at - 1].toFixed(2)}× banked · next holds ${pct(P[at])}`, 'push');
    upBtn.disabled = false;
  }

  function cashOut() {
    if (!live || at === 0) return;
    const payout = round2(stake * MULTS[at - 1]);
    burst(climber);
    settle({ id: t.id, stake, payout, msg, winLabel: `Rung ${at} — ${MULTS[at - 1].toFixed(2)}×` });
    hist.push(String(at), 'win');
    finish();
  }
  function finish() {
    live = false; upBtn.disabled = true;
    bp.unlock(); bp.setAction('START', 'btn-gold'); bp.actionBtn.disabled = false;
  }
  bp.actionBtn.addEventListener('click', () => { if (live) cashOut(); });

  paint();
  root.append(scene(t, stageEl), hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `Eight rungs. Unlike a flat ladder each one is <b>harder than the last</b> — <code>${pct(P[0])}</code> at the bottom down to <code>${pct(P[RUNGS - 1])}</code> at the top.`,
      `Prizes climb to match: <code>${MULTS.map((m) => m.toFixed(2) + '×').join('</code> <code>')}</code>.`,
      `Both numbers are printed on every rung before you commit to it.`,
      `Cash out at any rung. Fall and the stake is gone.`));
};

/* ═══════════════════════════════════════════ 15. CATCH
   Three chutes, one prize — but you may open more than one chute for a
   proportionally smaller price. */
export const catchGame = (t) => (root) => {
  const CHUTES = 4;
  const chosen = new Set([0]);
  let busy = false;

  const sky = el('div.cat-sky');
  const faller = el('div.cat-faller', { 'aria-hidden': 'true' });
  const row = el('div.cat-row');
  const chutes = Array.from({ length: CHUTES }, (_, i) => {
    const c = el('button.cat-chute', { type: 'button', 'aria-label': `Chute ${i + 1}` },
      el('span', {}, String(i + 1)));
    c.addEventListener('click', () => toggle(i));
    row.append(c); return c;
  });
  const stageEl = el('div.cat-stage', {}, sky, faller, row);
  const odds = readout('PAYS', '—');
  const msg = msgLine();
  const hist = historyRow();
  const bp = betPanel({ start: 25, min: 1, action: 'DROP', onAction: go });

  function toggle(i) {
    if (busy) return;
    if (chosen.has(i)) { if (chosen.size > 1) chosen.delete(i); }
    else if (chosen.size < CHUTES - 1) chosen.add(i);
    else return;
    paint(); play('chip');
  }
  function paint() {
    chutes.forEach((c, i) => c.classList.toggle('on', chosen.has(i)));
    odds.set(fairMult(CHUTES / chosen.size).toFixed(2) + '×');
    msg.set(`${chosen.size} of ${CHUTES} chutes open — catches ${pct(chosen.size / CHUTES)} of the time`, 'push');
  }

  async function go() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock();
    chutes.forEach((c) => c.classList.remove('hit', 'miss'));

    const lands = rndInt(CHUTES);
    faller.style.setProperty('--lane', String(lands));
    faller.classList.add('drop');
    play('whoosh');
    await sleep(1100);
    faller.classList.remove('drop');

    const caught = chosen.has(lands);
    chutes[lands].classList.add(caught ? 'hit' : 'miss');
    const payout = caught ? round2(stake * fairMult(CHUTES / chosen.size)) : 0;
    if (payout) { play('win'); burst(chutes[lands]); } else play('lose');
    settle({ id: t.id, stake, payout, msg,
      winLabel: `Caught in chute ${lands + 1}`,
      loseLabel: `Landed in chute ${lands + 1} — not one of yours` });
    hist.push(String(lands + 1), payout ? 'win' : 'lose');
    busy = false; bp.unlock();
  }

  paint();
  root.append(scene(t, stageEl, odds.node), hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `One object falls into one of <b>${CHUTES}</b> chutes, each equally likely.`,
      `Open as many chutes as you like, up to ${CHUTES - 1}. Covering one pays <code>${fairMult(CHUTES).toFixed(2)}×</code>, two pays <code>${fairMult(CHUTES / 2).toFixed(2)}×</code>, three pays <code>${fairMult(CHUTES / 3).toFixed(2)}×</code>.`,
      `Every combination returns the same <code>${(EDGE * 100).toFixed(0)}%</code> — widening your net trades payout for frequency, nothing more.`));
};

/* ═══════════════════════════════════════════ 16. SAFE
   Crack a combination one dial at a time; each correct digit compounds. */
export const safe = (t) => (root) => {
  const DIGITS = 4, RANGE = 4;      // four dials, four positions each
  const MULT = Array.from({ length: DIGITS }, (_, i) => round2(EDGE * Math.pow(RANGE, i + 1)));
  let live = false, stake = 0, at = 0, combo = [];

  const dials = el('div.safe-dials');
  const dialEls = Array.from({ length: DIGITS }, (_, i) => {
    const d = el('div.safe-dial', {}, el('span', {}, '?'));
    dials.append(d); return d;
  });
  const keypad = el('div.safe-keys');
  const keys = Array.from({ length: RANGE }, (_, i) => {
    const k = el('button.safe-key', { type: 'button' }, String(i + 1));
    k.addEventListener('click', () => tryDigit(i));
    keypad.append(k); return k;
  });
  const doorEl = el('div.safe-door', {}, dials);
  const cur = readout('IF CORRECT', MULT[0].toFixed(2) + '×');
  const msg = msgLine();
  const hist = historyRow();
  const bp = betPanel({ start: 25, min: 1, action: 'START', onAction: start });

  const lockKeys = (v) => keys.forEach((k) => { k.disabled = v; });

  function start() {
    if (live) return;
    stake = bp.value;
    if (!bp.take()) return;
    combo = Array.from({ length: DIGITS }, () => rndInt(RANGE));
    live = true; at = 0;
    dialEls.forEach((d) => { d.className = 'safe-dial'; d.firstChild.textContent = '?'; });
    cur.set(MULT[0].toFixed(2) + '×');
    lockKeys(false);
    bp.lock(); bp.setAction('CASH OUT', 'btn-green'); bp.actionBtn.disabled = true;
    msg.set(`Dial 1 of ${DIGITS} — one of ${RANGE} positions is right`, 'push');
  }

  async function tryDigit(d) {
    if (!live) return;
    lockKeys(true);
    dialEls[at].classList.add('spin');
    play('wheelTick');
    await sleep(380);
    dialEls[at].classList.remove('spin');
    dialEls[at].firstChild.textContent = String(d + 1);
    if (d !== combo[at]) {
      dialEls[at].classList.add('bad');
      play('lose');
      settle({ id: t.id, stake, payout: 0, msg,
        loseLabel: `Dial ${at + 1} was ${combo[at] + 1} — the lock reset` });
      hist.push(`D${at}`, 'lose');
      return finish();
    }
    dialEls[at].classList.add('good');
    at++;
    play('chip');
    bp.actionBtn.disabled = false;
    if (at >= DIGITS) { doorEl.classList.add('open'); return cashOut(); }
    cur.set(MULT[at].toFixed(2) + '×');
    lockKeys(false);
    msg.set(`Dial ${at} correct — banked ${MULT[at - 1].toFixed(2)}× · next dial pays ${MULT[at].toFixed(2)}×`, 'push');
  }

  function cashOut() {
    if (!live || at === 0) return;
    const payout = round2(stake * MULT[at - 1]);
    burst(doorEl);
    settle({ id: t.id, stake, payout, msg,
      winLabel: at >= DIGITS ? `Cracked it — ${MULT[at - 1].toFixed(2)}×` : `Stopped at dial ${at} — ${MULT[at - 1].toFixed(2)}×` });
    hist.push(`D${at}`, 'win');
    finish();
  }
  function finish() {
    live = false; lockKeys(true);
    setTimeout(() => doorEl.classList.remove('open'), 900);
    bp.unlock(); bp.setAction('START', 'btn-gold'); bp.actionBtn.disabled = false;
  }
  bp.actionBtn.addEventListener('click', () => { if (live) cashOut(); });

  lockKeys(true);
  root.append(scene(t, doorEl, cur.node), keypad, hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `A <b>${DIGITS}-dial</b> combination, each dial with <b>${RANGE}</b> positions — ${Math.pow(RANGE, DIGITS)} combinations in all.`,
      `Every correct dial multiplies by <code>${RANGE}×</code> less the edge: <code>${MULT.map((m) => m.toFixed(2) + '×').join('</code> <code>')}</code>.`,
      `Stop after any correct dial to bank what you have. One wrong dial ends the round.`,
      `The combination is drawn at the start of the round and does not change as you guess.`));
};

/* ═══════════════════════════════════════════ 17. BURST
   Pick a handful from a cluster; some are duds. Payout scales with how many
   of your picks were live. */
export const burstGame = (t) => (root) => {
  const TOTAL = 12, LIVE = 4, PICKS = 4;
  /* Hypergeometric: choosing 4 from 12 with 5 live. Prizes are set so the
     overall return lands on the house edge — see tools/rtp.mjs. */
  const PAY = [0, 0, 1.5, 5.8, 38];
  let busy = false;
  const chosen = new Set();

  const cluster = el('div.bur-cluster');
  const cells = Array.from({ length: TOTAL }, (_, i) => {
    const c = el('button.bur-orb', { type: 'button', 'aria-label': `Orb ${i + 1}` });
    c.addEventListener('click', () => toggle(i));
    cluster.append(c); return c;
  });
  const msg = msgLine();
  const hist = historyRow();
  const bp = betPanel({ start: 25, min: 1, action: 'BURST', onAction: go });

  function toggle(i) {
    if (busy) return;
    if (chosen.has(i)) chosen.delete(i);
    else if (chosen.size < PICKS) chosen.add(i);
    else return;
    cells[i].classList.toggle('on', chosen.has(i));
    play('chip');
    msg.set(`${chosen.size} of ${PICKS} selected`, 'push');
  }

  async function go() {
    if (busy) return;
    if (chosen.size !== PICKS) { msg.set(`Select exactly ${PICKS}`, 'push'); return; }
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock();

    const liveSet = pickDistinct(TOTAL, LIVE);
    let hits = 0;
    for (const i of chosen) {
      cells[i].classList.add(liveSet.has(i) ? 'live' : 'dud');
      if (liveSet.has(i)) hits++;
      play(liveSet.has(i) ? 'win' : 'click');
      await sleep(260);
    }
    const payout = round2(stake * PAY[hits]);
    if (payout > stake) burst(cluster); else if (!payout) play('lose');
    settle({ id: t.id, stake, payout, msg,
      winLabel: `${hits} of ${PICKS} burst`,
      loseLabel: `${hits} of ${PICKS} burst — no prize` });
    hist.push(`${hits}/${PICKS}`, payout > stake ? 'win' : 'lose');

    await sleep(700);
    cells.forEach((c) => { c.className = 'bur-orb'; });
    chosen.clear();
    busy = false; bp.unlock();
  }

  root.append(scene(t, cluster), hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `<b>${LIVE}</b> of the <b>${TOTAL}</b> are live; the rest are duds. Choose exactly <b>${PICKS}</b>.`,
      `Pays from two hits up: <code>2 → ${PAY[2]}×</code>, <code>3 → ${PAY[3]}×</code>, <code>4 → ${PAY[4]}×</code>. One hit pays nothing.`,
      `Two hits comes up about a third of the time; all four about once in 500 rounds.`,
      `Which are live is drawn after you commit, from a fresh shuffle each round.`));
};

/* ═══════════════════════════════════════════ 18. DRAW
   A single weighted draw from published tiers. No decisions, no ladder —
   the whole game is the reveal. */
export const drawGame = (t) => (root) => {
  const TIERS = [
    { name: 'Common', w: 620, pay: 0, tone: 'c' },
    { name: 'Uncommon', w: 240, pay: 0, tone: 'u' },
    { name: 'Rare', w: 100, pay: 2.2, tone: 'r' },
    { name: 'Epic', w: 33, pay: 8, tone: 'e' },
    { name: 'Legendary', w: 6, pay: 38, tone: 'l' },
    { name: 'Mythic', w: 1, pay: 250, tone: 'm' },
  ];
  const TOTAL = TIERS.reduce((a, x) => a + x.w, 0);
  let busy = false;

  const prize = el('div.drw-prize', {}, el('span', {}, t.emblem));
  const beam = el('div.drw-beam', { 'aria-hidden': 'true' });
  const stageEl = el('div.drw-stage', {}, beam, prize);
  const msg = msgLine();
  const hist = historyRow();
  const legend = el('div.paytable', {},
    el('h4', {}, 'TIERS'),
    el('div.pt-rows', {}, TIERS.map((x) =>
      el('div.pt-row.tier-' + x.tone, {},
        el('span', {}, x.name),
        el('span', {}, `${(x.w / TOTAL * 100).toFixed(2)}%  ·  ${x.pay ? x.pay + '×' : 'no prize'}`)))));
  const bp = betPanel({ start: 25, min: 1, action: 'DRAW', onAction: go });

  async function go() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock();
    prize.className = 'drw-prize';
    beam.classList.add('charge');
    play('whoosh');
    await sleep(1000);

    let r = rndInt(TOTAL), tier = TIERS[0];
    for (const x of TIERS) { r -= x.w; if (r < 0) { tier = x; break; } }
    beam.classList.remove('charge');
    prize.className = 'drw-prize reveal tier-' + tier.tone;
    const payout = round2(stake * tier.pay);
    if (payout > stake) { play('win'); burst(prize); } else if (!payout) play('lose');
    settle({ id: t.id, stake, payout, msg,
      winLabel: `${tier.name.toUpperCase()} draw`,
      loseLabel: `${tier.name} — no prize` });
    hist.push(tier.name.slice(0, 4), payout > stake ? 'win' : 'lose');
    busy = false; bp.unlock();
  }

  root.append(scene(t, stageEl), legend, hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `One draw from six tiers with the exact odds printed above — no hidden pity timer, no streak logic.`,
      `Common and Uncommon pay nothing and are <b>${((TIERS[0].w + TIERS[1].w) / TOTAL * 100).toFixed(0)}%</b> of draws between them; Mythic comes up once in <code>${TOTAL}</code> and pays <code>${TIERS[5].pay}×</code>.`,
      `Every draw is independent. A long run of Commons does not make a Legendary any nearer.`,
      `Weights are fixed in the source and drawn with <code>crypto.getRandomValues</code>.`));
};

/* ═══════════════════════════════════════════ 19. TRAIL
   Roll along a board. Tiles carry prizes, and one tile ends the run. */
export const trail = (t) => (root) => {
  const LEN = 16;
  const TILE = ['x0.95', 'x0', 'x1.15', 'x0', 'x0.8', 'BUST', 'x1.4', 'x0',
    'x0.95', 'BUST', 'x1.25', 'x0', 'x2.1', 'BUST', 'x0', 'x4.5'];
  let live = false, stake = 0, at = -1, banked = 0;

  const board = el('div.trl-board');
  const tiles = TILE.map((v, i) => {
    const tile = el('div.trl-tile' + (v === 'BUST' ? '.bust' : v === 'x0' ? '.blank' : ''), {},
      el('span', {}, v === 'x0' ? '—' : v));
    board.append(tile); return tile;
  });
  const token = el('div.trl-token', { 'aria-hidden': 'true' });
  const stageEl = el('div.trl-stage', {}, board, token);
  const bank = readout('BANKED', '—');
  const msg = msgLine();
  const hist = historyRow();

  const rollBtn = el('button.btn.btn-gold.btn-lg', { type: 'button' }, 'ROLL');
  rollBtn.addEventListener('click', roll);
  const bp = betPanel({ start: 25, min: 1, action: 'START', onAction: start,
    extra: [el('div.field', {}, el('label', {}, 'MOVE'), rollBtn)] });
  rollBtn.disabled = true;

  function start() {
    if (live) return;
    stake = bp.value;
    if (!bp.take()) return;
    live = true; at = -1; banked = 0;
    tiles.forEach((n) => n.classList.remove('on', 'hit'));
    token.style.setProperty('--at', '-1');
    bank.set('0.00×');
    bp.lock(); bp.setAction('CASH OUT', 'btn-green'); bp.actionBtn.disabled = true;
    rollBtn.disabled = false;
    msg.set('Roll 1–3 to move along the trail', 'push');
  }

  async function roll() {
    if (!live) return;
    rollBtn.disabled = true;
    const step = 1 + rndInt(3);
    for (let s = 0; s < step; s++) {
      at++;
      token.style.setProperty('--at', String(Math.min(at, LEN - 1)));
      board.style.setProperty('--scroll', String(Math.max(0, Math.min(at - 2, LEN - 6))));
      play('chip');
      await sleep(220);
      if (at >= LEN) break;
    }
    if (at >= LEN) { msg.set('Reached the end of the trail', 'push'); return cashOut(); }

    tiles[at].classList.add('on');
    const v = TILE[at];
    if (v === 'BUST') {
      tiles[at].classList.add('hit');
      play('lose');
      settle({ id: t.id, stake, payout: 0, msg, loseLabel: `Landed on a bust at tile ${at + 1}` });
      hist.push(`T${at + 1}`, 'lose');
      return finish();
    }
    const add = parseFloat(v.slice(1));
    if (add > 0) { banked = round2(banked + add); play('win'); }
    bank.set(banked.toFixed(2) + '×');
    bp.actionBtn.disabled = banked === 0;
    msg.set(add > 0
      ? `Tile ${at + 1}: +${add.toFixed(1)}× — banked ${banked.toFixed(2)}×`
      : `Tile ${at + 1}: nothing — banked ${banked.toFixed(2)}×`, 'push');
    rollBtn.disabled = false;
  }

  function cashOut() {
    if (!live) return;
    const payout = round2(stake * banked * EDGE);
    settle({ id: t.id, stake, payout, msg, winLabel: `Banked ${(banked * EDGE).toFixed(2)}×` });
    hist.push(banked.toFixed(1) + '×', payout > stake ? 'win' : 'lose');
    finish();
  }
  function finish() {
    live = false; rollBtn.disabled = true;
    bp.unlock(); bp.setAction('START', 'btn-gold'); bp.actionBtn.disabled = false;
  }
  bp.actionBtn.addEventListener('click', () => { if (live) cashOut(); });

  root.append(scene(t, stageEl, bank.node), hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `Roll <b>1–3</b> and move along a fixed ${LEN}-tile trail. The tiles never change — they are printed on the board from the start.`,
      `Prize tiles add to your bank. <b>Three bust tiles</b> end the run and take everything with it.`,
      `Cash out between rolls to keep what you have, less the <code>1%</code> edge.`,
      `Because the board is fixed and visible, you always know exactly what is ahead of you.`));
};

/* ═══════════════════════════════════════════ 20. FUSE
   A live countdown. The multiplier rises with every tick and the round ends
   at a moment drawn before the timer starts. */
export const fuse = (t) => (root) => {
  let live = false, stake = 0, mult = 1, endAt = 0, raf = 0, t0 = 0;

  const trackEl = el('div.fus-track');
  const flame = el('div.fus-flame', { 'aria-hidden': 'true' });
  const spark = el('div.fus-spark', { 'aria-hidden': 'true' });
  const stageEl = el('div.fus-stage', {}, trackEl, flame, spark);
  const multEl = readout('MULTIPLIER', '1.00×');
  const msg = msgLine();
  const hist = historyRow();
  const bp = betPanel({ start: 25, min: 1, action: 'LIGHT IT', onAction: start });

  /* Same distribution as a crash curve: 1% instant, otherwise 0.99/(1-u). */
  function drawEnd() {
    if (rnd() < 0.01) return 1;
    return Math.max(1, Math.floor(100 * EDGE / (1 - rnd())) / 100);
  }

  function start() {
    if (live) return;
    stake = bp.value;
    if (!bp.take()) return;
    live = true; mult = 1; endAt = drawEnd(); t0 = performance.now();
    flame.classList.add('burn'); stageEl.classList.remove('blown');
    bp.lock(); bp.setAction('CASH OUT', 'btn-green'); bp.actionBtn.disabled = false;
    msg.set('Cash out before it reaches the end', 'push');
    tick();
  }

  function tick() {
    const secs = (performance.now() - t0) / 1000;
    mult = Math.max(1, Math.pow(1.07, secs * 6));
    if (mult >= endAt) return blow();
    multEl.set(mult.toFixed(2) + '×');
    const p = Math.min(1, Math.log(mult) / Math.log(Math.max(endAt, 12)));
    flame.style.setProperty('--p', `${p * 100}%`);
    raf = requestAnimationFrame(tick);
  }

  function blow() {
    cancelAnimationFrame(raf);
    live = false;
    multEl.set(endAt.toFixed(2) + '×');
    flame.classList.remove('burn');
    stageEl.classList.add('blown');
    play('lose');
    settle({ id: t.id, stake, payout: 0, msg, loseLabel: `Blew at ${endAt.toFixed(2)}×` });
    hist.push(endAt.toFixed(2) + '×', 'lose');
    reset();
  }

  function cashOut() {
    if (!live) return;
    cancelAnimationFrame(raf);
    live = false;
    const taken = Math.min(mult, endAt);
    const payout = round2(stake * taken);
    flame.classList.remove('burn');
    burst(spark);
    settle({ id: t.id, stake, payout, msg, winLabel: `Out at ${taken.toFixed(2)}×` });
    hist.push(taken.toFixed(2) + '×', payout > stake ? 'win' : 'lose');
    reset();
  }
  function reset() {
    bp.unlock(); bp.setAction('LIGHT IT', 'btn-gold'); bp.actionBtn.disabled = false;
  }
  bp.actionBtn.addEventListener('click', () => { if (live) cashOut(); });

  root.append(scene(t, stageEl, multEl.node), hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `The multiplier climbs from <code>1.00×</code> for as long as the fuse burns. Cash out and you keep it.`,
      `The end point is drawn <b>before the timer starts</b> from the standard <code>0.99 / (1 − u)</code> curve, so nothing about how long you wait changes it.`,
      `One round in a hundred ends immediately at <code>1.00×</code> — that is where the house edge comes from.`,
      `Median end point is around <code>2×</code>, but half of all rounds end below it.`));
};
