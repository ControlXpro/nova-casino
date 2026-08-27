/* Instant-game engines A: aim, picks, path, pump, race,
   duel, shuffle, match3, wires, spots.

   Each export is a factory: give it a catalogue entry and it returns a mount
   function for that specific themed variant. */
import {
  el, fmt, rnd, rndInt, shuffle, sleep, wallet, round2, msgLine, play,
  EDGE, fairMult, scene, readout, historyRow, ladderMults, pickDistinct, settle, choices,
} from './eng-core.js';
import { betPanel, rules } from '../ui.js';
import { coinBurst as burst } from '../fx.js';

const pct = (x) => (x * 100).toFixed(1) + '%';

/* ═══════════════════════════════════════════ 1. AIM
   Six target zones. Placement keeps the shot accurate but lets the blocker
   cover two zones; power beats the blocker down to one zone but throws the
   shot wide almost a third of the time. Two honest routes to the same edge. */
export const aim = (t) => (root) => {
  const W = t.words;
  const MODES = {
    place: { label: 'PLACEMENT', covers: 2, accuracy: 1, note: 'blocker covers 2 zones' },
    power: { label: 'POWER', covers: 1, accuracy: 0.7, note: 'blocker covers 1 — 30% goes wide' },
  };
  let mode = 'place', zone = 0, busy = false;

  const goal = el('div.aim-goal');
  const blocker = el('div.aim-blocker', { 'aria-hidden': 'true' });
  const shot = el('div.aim-shot', { 'aria-hidden': 'true' });
  const zones = choices(W, (i) => { if (!busy) { zone = i; zones.select(i); play('chip'); } },
    { cls: '.aim-zone' });
  goal.append(blocker, shot, zones.node);

  const odds = readout('RETURNS', '—');
  const modeRow = choices(Object.values(MODES).map((m) => m.label),
    (i) => { if (busy) { return; } mode = Object.keys(MODES)[i]; modeRow.select(i); paintOdds(); play('click'); });
  const msg = msgLine();
  const hist = historyRow();

  function chance() { const m = MODES[mode]; return (6 - m.covers) / 6 * m.accuracy; }
  function paintOdds() {
    odds.set(fairMult(1 / chance()).toFixed(2) + '×');
    msg.set(`${MODES[mode].label} — ${MODES[mode].note} · scores ${pct(chance())} of the time`, 'push');
  }

  const bp = betPanel({ start: 25, min: 1, action: 'SHOOT', onAction: fire });

  async function fire() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); zones.lock(true); modeRow.lock(true);

    const m = MODES[mode];
    const covered = [...pickDistinct(6, m.covers)];
    const wide = rnd() >= m.accuracy;
    const scored = !wide && !covered.includes(zone);

    // the blocker commits first, then the shot travels
    blocker.style.setProperty('--x', `${(covered[0] % 3) * 50}%`);
    blocker.style.setProperty('--y', covered[0] < 3 ? '0%' : '100%');
    blocker.classList.add('dive');
    play('whoosh');
    await sleep(160);

    shot.className = 'aim-shot fly' + (wide ? ' wide' : '');
    shot.style.setProperty('--tx', `${(zone % 3) * 50}%`);
    shot.style.setProperty('--ty', zone < 3 ? '0%' : '100%');
    await sleep(560);

    zones.nodes.forEach((n, i) => {
      if (covered.includes(i)) n.classList.add('blocked');
      if (i === zone) n.classList.add(scored ? 'hit' : 'miss');
    });

    const payout = scored ? round2(stake * fairMult(1 / chance())) : 0;
    if (scored) { play('win'); burst(shot); } else play('lose');
    settle({ id: t.id, stake, payout, msg,
      winLabel: `${W[zone]} — SCORED`,
      loseLabel: wide ? 'Wide of the target' : `${W[zone]} — blocked` });
    hist.push(scored ? 'GOAL' : wide ? 'WIDE' : 'SAVE', scored ? 'win' : 'lose');

    await sleep(900);
    blocker.classList.remove('dive'); shot.className = 'aim-shot';
    zones.reset(); zones.select(zone);
    busy = false; bp.unlock(); zones.lock(false); modeRow.lock(false);
  }

  zones.select(0); modeRow.select(0); paintOdds();
  root.append(scene(t, goal, odds.node), el('div.eng-row', {}, modeRow.node), hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `Choose one of <b>six</b> target zones, then choose how you take the shot.`,
      `<b>Placement</b> — the blocker covers two zones, so you score <code>${pct(4 / 6)}</code> of the time and it pays <code>${fairMult(6 / 4).toFixed(2)}×</code>.`,
      `<b>Power</b> — the blocker only reaches one zone, but three shots in ten sail wide. That scores <code>${pct(5 / 6 * 0.7)}</code> and pays <code>${fairMult(1 / (5 / 6 * 0.7)).toFixed(2)}×</code>.`,
      `Both routes carry the same <code>1%</code> house edge — pick the one you enjoy, not the one you think is looser.`));
};

/* ═══════════════════════════════════════════ 2. PICKS
   Nine containers. Seven hold a multiplier you bank, two end the round.
   Winnings accumulate as you open more, so the decision is always "one more?" */
export const picks = (t) => (root) => {
  const NOUN = t.words[0];
  const VALUES = [0.3, 0.5, 0.7, 0.85, 1.15, 1.7, 2.9];   // calibrated by tools/rtp200.mjs
  const BUSTS = 2;
  let live = false, stake = 0, banked = 0, layout = [], opened = 0;

  const grid = el('div.pick-grid');
  const cells = [];
  for (let i = 0; i < 9; i++) {
    const face = el('div.pick-face', {}, el('span.pick-noun', {}, NOUN));
    const c = el('button.pick-cell', { type: 'button', 'aria-label': `${NOUN} ${i + 1}` }, face);
    c.addEventListener('click', () => open(i));
    cells.push(c); grid.append(c);
  }
  const bank = readout('BANKED', '—');
  const msg = msgLine();
  const hist = historyRow();
  const bp = betPanel({ start: 25, min: 1, action: 'OPEN THE FIRST', onAction: start });

  function start() {
    if (live) { cashOut(); return; }
    stake = bp.value;
    if (!bp.take()) return;
    layout = shuffle([...VALUES, ...Array(BUSTS).fill(null)]);
    live = true; banked = 0; opened = 0;
    cells.forEach((c) => { c.className = 'pick-cell'; c.disabled = false; c.firstChild.replaceChildren(el('span.pick-noun', {}, NOUN)); });
    bank.set('0.00×');
    bp.lock(); bp.setAction('CASH OUT', 'btn-green'); bp.actionBtn.disabled = true;
    msg.set(`Open a ${NOUN.toLowerCase()} — two of the nine end the round`, 'push');
  }

  function open(i) {
    if (!live || cells[i].disabled) return;
    const v = layout[i];
    cells[i].disabled = true;
    opened++;
    if (v == null) {
      cells[i].className = 'pick-cell bust';
      cells[i].firstChild.replaceChildren(el('span.pick-val', {}, 'BUST'));
      play('lose');
      reveal();
      settle({ id: t.id, stake, payout: 0, msg, loseLabel: `Opened a bad ${NOUN.toLowerCase()} on pick ${opened} — banked ${banked.toFixed(2)}× lost` });
      hist.push('BUST', 'lose');
      finish();
      return;
    }
    banked = round2(banked + v);
    cells[i].className = 'pick-cell open';
    cells[i].firstChild.replaceChildren(el('span.pick-val', {}, v.toFixed(2) + '×'));
    bank.set(banked.toFixed(2) + '×');
    play(v >= 2 ? 'win' : 'chip');
    if (v >= 2) burst(cells[i]);
    bp.actionBtn.disabled = false;
    msg.set(`+${v.toFixed(2)}× — banked ${banked.toFixed(2)}× · cash out for ${fmt(round2(stake * banked))}`, 'push');
    if (opened === 9 - BUSTS) cashOut();
  }

  function cashOut() {
    if (!live) return;
    reveal();
    const payout = round2(stake * banked);
    settle({ id: t.id, stake, payout, msg, winLabel: `Cashed out at ${banked.toFixed(2)}×` });
    hist.push(banked.toFixed(2) + '×', payout > stake ? 'win' : 'lose');
    finish();
  }

  function reveal() {
    cells.forEach((c, i) => {
      c.disabled = true;
      if (!c.classList.contains('open') && !c.classList.contains('bust')) {
        c.classList.add('shown');
        c.firstChild.replaceChildren(el('span.pick-val', {}, layout[i] == null ? 'BUST' : layout[i].toFixed(2) + '×'));
      }
    });
  }
  function finish() {
    live = false;
    bp.unlock(); bp.setAction('OPEN THE FIRST', 'btn-gold'); bp.actionBtn.disabled = false;
  }

  root.append(scene(t, grid, bank.node), hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `Nine ${NOUN.toLowerCase()}s. <b>Seven</b> hold a multiplier that adds to your bank; <b>two</b> end the round and take everything with them.`,
      `The prizes are <code>${VALUES.map((v) => v.toFixed(1) + '×').join('</code> <code>')}</code>, shuffled fresh every round.`,
      `Cash out whenever you like. Open all seven safe ${NOUN.toLowerCase()}s and you bank <code>${VALUES.reduce((a, b) => a + b, 0).toFixed(1)}×</code> — but the odds of getting there are slim.`,
      `Every layout comes from <code>crypto.getRandomValues</code>.`));
};

/* ═══════════════════════════════════════════ 3. PATH
   Step across one hazard at a time. Each step is an independent survival
   roll, so the multiplier ladder is simply (1/p)^n with the edge applied. */
export const path = (t) => (root) => {
  const NOUN = t.words[0];
  const STEPS = 12, P = 0.75;
  const MULTS = ladderMults(STEPS, P);
  let live = false, stake = 0, at = 0;

  const lane = el('div.path-lane');
  const tiles = [];
  for (let i = 0; i < STEPS; i++) {
    const tile = el('div.path-tile', {},
      el('span.path-n', {}, NOUN + ' ' + (i + 1)),
      el('span.path-x', {}, MULTS[i].toFixed(2) + '×'));
    tiles.push(tile); lane.append(tile);
  }
  const runner = el('div.path-runner', { 'aria-hidden': 'true' });
  const track = el('div.path-track', {}, lane, runner);
  const cur = readout('NEXT STEP', MULTS[0].toFixed(2) + '×');
  const msg = msgLine();
  const hist = historyRow();

  const stepBtn = el('button.btn.btn-gold.btn-lg', { type: 'button' }, 'STEP');
  const bp = betPanel({ start: 25, min: 1, action: 'START', onAction: start,
    extra: [el('div.field', {}, el('label', {}, 'ADVANCE'), stepBtn)] });
  stepBtn.disabled = true;
  stepBtn.addEventListener('click', step);

  function paint() {
    tiles.forEach((n, i) => n.classList.toggle('done', i < at));
    runner.style.setProperty('--at', at);
    lane.style.setProperty('--scroll', Math.max(0, Math.min(at - 2, STEPS - 5)));
    cur.set(at < STEPS ? MULTS[at].toFixed(2) + '×' : 'CLEARED');
  }

  function start() {
    if (live) return;
    stake = bp.value;
    if (!bp.take()) return;
    live = true; at = 0;
    tiles.forEach((n) => { n.className = 'path-tile'; });
    paint();
    bp.lock(); bp.setAction('CASH OUT', 'btn-green'); bp.actionBtn.disabled = true;
    stepBtn.disabled = false;
    msg.set(`Each ${NOUN.toLowerCase()} holds ${pct(P)} of the time`, 'push');
  }

  async function step() {
    if (!live) return;
    stepBtn.disabled = true;
    const safe = rnd() < P;
    runner.classList.add('hop');
    play('whoosh');
    await sleep(300);
    runner.classList.remove('hop');
    if (!safe) {
      tiles[at].classList.add('broken');
      play('lose');
      settle({ id: t.id, stake, payout: 0, msg, loseLabel: `The ${NOUN.toLowerCase()} gave way on step ${at + 1}` });
      hist.push(`${at}`, 'lose');
      return finish();
    }
    at++;
    play('chip');
    paint();
    bp.actionBtn.disabled = false;
    if (at >= STEPS) return cashOut();
    msg.set(`Across ${at} — cash out for ${fmt(round2(stake * MULTS[at - 1]))} or push on`, 'push');
    stepBtn.disabled = false;
  }

  function cashOut() {
    if (!live || at === 0) return;
    const payout = round2(stake * MULTS[at - 1]);
    burst(runner);
    settle({ id: t.id, stake, payout, msg, winLabel: `Crossed ${at} — ${MULTS[at - 1].toFixed(2)}×` });
    hist.push(`${at}`, 'win');
    finish();
  }

  function finish() {
    live = false; stepBtn.disabled = true;
    bp.unlock(); bp.setAction('START', 'btn-gold'); bp.actionBtn.disabled = false;
  }
  bp.actionBtn.addEventListener('click', () => { if (live) cashOut(); });

  paint();
  root.append(scene(t, track, cur.node), hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `Advance one ${NOUN.toLowerCase()} at a time. Each holds <code>${pct(P)}</code> of the time, independently of the last.`,
      `The ladder runs <code>${MULTS.slice(0, 5).map((m) => m.toFixed(2) + '×').join('</code> <code>')}</code> … up to <code>${MULTS[STEPS - 1].toFixed(2)}×</code> for all ${STEPS}.`,
      `Cash out at any point. Fall and the round is over — there is no partial return.`,
      `The edge is applied once to the whole ladder, so going deep is not punished.`));
};

/* ═══════════════════════════════════════════ 4. PUMP
   Unlike the path, the risk here *escalates*: every pump adds to the burst
   chance, so late pumps cost far more than early ones. */
export const pump = (t) => (root) => {
  const NOUN = t.words[0];
  const base = 0.05, ramp = 0.022;         // burst chance = base + ramp * pumps
  let live = false, stake = 0, n = 0, mult = 1;

  const body = el('div.pump-body', { 'aria-hidden': 'true' });
  const stage = el('div.pump-stage', {}, body);
  const cur = readout('MULTIPLIER', '1.00×');
  const risk = readout('BURST RISK', pct(base));
  const msg = msgLine();
  const hist = historyRow();

  const pumpBtn = el('button.btn.btn-gold.btn-lg', { type: 'button' }, 'PUMP');
  const bp = betPanel({ start: 25, min: 1, action: 'START', onAction: start,
    extra: [el('div.field', {}, el('label', {}, 'INFLATE'), pumpBtn)] });
  pumpBtn.disabled = true;
  pumpBtn.addEventListener('click', doPump);

  const burstChance = (k) => Math.min(0.9, base + ramp * k);

  function start() {
    if (live) return;
    stake = bp.value;
    if (!bp.take()) return;
    live = true; n = 0; mult = 1;
    body.className = 'pump-body';
    body.style.setProperty('--size', '1');
    cur.set('1.00×'); risk.set(pct(burstChance(0)));
    bp.lock(); bp.setAction('CASH OUT', 'btn-green'); bp.actionBtn.disabled = true;
    pumpBtn.disabled = false;
    msg.set(`Pump the ${NOUN.toLowerCase()} — each one adds ${(ramp * 100).toFixed(1)}% to the burst risk`, 'push');
  }

  async function doPump() {
    if (!live) return;
    pumpBtn.disabled = true;
    const popped = rnd() < burstChance(n);
    n++;
    body.style.setProperty('--size', String(1 + n * 0.11));
    body.classList.add('flex');
    play('click');
    await sleep(240);
    body.classList.remove('flex');
    if (popped) {
      body.classList.add('pop');
      play('lose');
      settle({ id: t.id, stake, payout: 0, msg, loseLabel: `Burst on pump ${n} at ${mult.toFixed(2)}×` });
      hist.push(mult.toFixed(2) + '×', 'lose');
      return finish();
    }
    /* Price the pump off the risk that was just survived, so the ladder is
       fair at every depth rather than only in the middle. */
    mult = round2(mult / (1 - burstChance(n - 1)));
    cur.set(mult.toFixed(2) + '×');
    risk.set(pct(burstChance(n)));
    bp.actionBtn.disabled = false;
    msg.set(`${mult.toFixed(2)}× — cash out for ${fmt(round2(stake * mult * EDGE))} · next pump bursts ${pct(burstChance(n))}`, 'push');
    pumpBtn.disabled = n >= 24;
  }

  function cashOut() {
    if (!live || n === 0) return;
    const payout = round2(stake * mult * EDGE);
    burst(body);
    settle({ id: t.id, stake, payout, msg, winLabel: `Cashed at ${mult.toFixed(2)}×` });
    hist.push(mult.toFixed(2) + '×', payout > stake ? 'win' : 'lose');
    finish();
  }
  function finish() {
    live = false; pumpBtn.disabled = true;
    bp.unlock(); bp.setAction('START', 'btn-gold'); bp.actionBtn.disabled = false;
  }
  bp.actionBtn.addEventListener('click', () => { if (live) cashOut(); });

  root.append(scene(t, stage, el('div.eng-stack', {}, cur.node, risk.node)), hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `Every pump multiplies your stake by exactly the inverse of the risk you just survived, so early pumps add a little and late ones add a lot.`,
      `Burst risk starts at <code>${pct(base)}</code> and climbs <code>${(ramp * 100).toFixed(1)}%</code> per pump, so it is shown to you before every decision.`,
      `Cash out at any time to bank the current multiplier less the <code>1%</code> edge. Burst and you lose the stake.`,
      `Unlike a ladder game the danger accelerates — the tenth pump is far riskier than the first.`));
};

/* ═══════════════════════════════════════════ 5. RACE
   Six runners with published, unequal chances. Prices are the fair price
   with the edge taken off, so a longshot is not a worse bet than a favourite. */
export const race = (t) => (root) => {
  const RUNNERS = t.words;
  const WEIGHTS = [30, 24, 18, 13, 9, 6];       // out of 100
  let choice = 0, busy = false;

  const trackEl = el('div.race-track');
  const lanes = RUNNERS.map((name, i) => {
    const runner = el('div.race-runner', { 'aria-hidden': 'true' });
    const lane = el('div.race-lane', {},
      el('span.race-name', {}, name),
      el('span.race-odds', {}, fairMult(100 / WEIGHTS[i]).toFixed(2) + '×'),
      runner);
    lane.addEventListener('click', () => { if (!busy) { choice = i; paint(); play('chip'); } });
    trackEl._runners = trackEl._runners || [];
    trackEl._runners.push(runner);
    trackEl.append(lane);
    return lane;
  });
  const msg = msgLine();
  const hist = historyRow();
  const bp = betPanel({ start: 25, min: 1, action: 'RACE', onAction: run });

  const paint = () => lanes.forEach((l, i) => l.classList.toggle('on', i === choice));

  function drawWinner() {
    let r = rndInt(100);
    for (let i = 0; i < WEIGHTS.length; i++) { r -= WEIGHTS[i]; if (r < 0) return i; }
    return WEIGHTS.length - 1;
  }

  async function run() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock();
    lanes.forEach((l) => l.classList.remove('won', 'lost'));

    const winner = drawWinner();
    // give every runner a plausible finishing position, winner first
    const rest = shuffle([...RUNNERS.keys()].filter((i) => i !== winner));
    const order = [winner, ...rest];
    order.forEach((idx, place) => {
      trackEl._runners[idx].style.setProperty('--finish', `${96 - place * 3}%`);
      trackEl._runners[idx].style.setProperty('--dur', `${2.2 + place * 0.16 + rnd() * 0.3}s`);
      trackEl._runners[idx].classList.add('go');
    });
    play('whoosh');
    msg.set('And they are away…', 'push');
    await sleep(2900);

    lanes[winner].classList.add('won');
    if (choice !== winner) lanes[choice].classList.add('lost');
    const payout = choice === winner ? round2(stake * fairMult(100 / WEIGHTS[winner])) : 0;
    if (payout) { play('win'); burst(lanes[winner]); } else play('lose');
    settle({ id: t.id, stake, payout, msg,
      winLabel: `${RUNNERS[winner]} wins`,
      loseLabel: `${RUNNERS[winner]} wins — you backed ${RUNNERS[choice]}` });
    hist.push(RUNNERS[winner].slice(0, 6), payout ? 'win' : 'lose');

    await sleep(700);
    trackEl._runners.forEach((r) => r.classList.remove('go'));
    busy = false; bp.unlock();
  }

  paint();
  root.append(scene(t, trackEl), hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `Six runners, each with a <b>different published chance</b>: ${WEIGHTS.map((w, i) => `${RUNNERS[i]} <code>${w}%</code>`).join(', ')}.`,
      `Prices are the true odds with the house edge taken off, so <code>${RUNNERS[0]}</code> at <code>${fairMult(100 / WEIGHTS[0]).toFixed(2)}×</code> and <code>${RUNNERS[5]}</code> at <code>${fairMult(100 / WEIGHTS[5]).toFixed(2)}×</code> return the same <code>${(EDGE * 100).toFixed(0)}%</code> over time.`,
      `Backing the longshot is more volatile, not more profitable.`,
      `The winner is drawn from those weights by <code>crypto.getRandomValues</code> before the animation starts.`));
};

/* ═══════════════════════════════════════════ 6. DUEL
   Two evenly matched sides plus an optional call on a decisive finish. */
export const duel = (t) => (root) => {
  const [A, B] = t.words;
  let side = 0, decisive = false, busy = false;

  const bar = el('div.duel-bar', {}, el('div.duel-fill'));
  const arena = el('div.duel-arena', {},
    el('div.duel-side.a', {}, el('span', {}, A)),
    bar,
    el('div.duel-side.b', {}, el('span', {}, B)));
  const sides = choices([A, B], (i) => { if (!busy) { side = i; sides.select(i); play('chip'); } });
  const decBtn = el('button.eng-choice', { type: 'button' }, el('span', {}, 'DECISIVE FINISH +'));
  decBtn.addEventListener('click', () => {
    if (busy) return;
    decisive = !decisive; decBtn.classList.toggle('on', decisive); play('click');
    msg.set(decisive
      ? `Decisive call on — pays ${fairMult(1 / (0.5 * 0.45)).toFixed(2)}× but only if ${t.words[side]} wins by a margin`
      : `Straight call — pays ${fairMult(2).toFixed(2)}×`, 'push');
  });

  const msg = msgLine();
  const hist = historyRow();
  const bp = betPanel({ start: 25, min: 1, action: 'FIGHT', onAction: fight });

  async function fight() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); sides.lock(true); decBtn.disabled = true;

    const winner = rndInt(2);
    const wasDecisive = rnd() < 0.45;
    // momentum swings a few times before settling
    for (let i = 0; i < 5; i++) {
      bar.style.setProperty('--p', `${30 + rndInt(41)}%`);
      play('click');
      await sleep(300);
    }
    bar.style.setProperty('--p', winner === 0 ? (wasDecisive ? '8%' : '30%') : (wasDecisive ? '92%' : '70%'));
    await sleep(600);

    const won = side === winner && (!decisive || wasDecisive);
    const price = decisive ? fairMult(1 / (0.5 * 0.45)) : fairMult(2);
    const payout = won ? round2(stake * price) : 0;
    if (won) { play('win'); burst(arena); } else play('lose');
    settle({ id: t.id, stake, payout, msg,
      winLabel: `${t.words[winner]} takes it${wasDecisive ? ' decisively' : ''}`,
      loseLabel: side === winner
        ? `${t.words[winner]} won, but only narrowly — the decisive call missed`
        : `${t.words[winner]} takes it` });
    hist.push(t.words[winner].slice(0, 6), won ? 'win' : 'lose');

    await sleep(600);
    busy = false; bp.unlock(); sides.lock(false); decBtn.disabled = false;
  }

  sides.select(0);
  root.append(scene(t, arena), el('div.eng-row', {}, sides.node, decBtn), hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `<b>${A}</b> and <b>${B}</b> are evenly matched — a straight call on the winner pays <code>${fairMult(2).toFixed(2)}×</code>.`,
      `Add <b>Decisive Finish</b> and you only collect if your side wins <i>and</i> wins by a clear margin, which happens <code>45%</code> of the time. That pays <code>${fairMult(1 / (0.5 * 0.45)).toFixed(2)}×</code>.`,
      `Both bets carry the same <code>1%</code> edge; the decisive call is simply the more volatile of the two.`));
};

/* ═══════════════════════════════════════════ 7. SHUFFLE
   Classic shell game. More containers means a longer price and a worse
   chance — the trade is entirely the player's to make. */
export const shuffleGame = (t) => (root) => {
  const NOUN = t.words[0];
  let count = 3, busy = false;

  const table = el('div.shuf-table');
  let cups = [];
  function build() {
    cups = [];
    table.replaceChildren();
    for (let i = 0; i < count; i++) {
      const c = el('button.shuf-cup', { type: 'button', 'aria-label': `${NOUN} ${i + 1}` },
        el('span.shuf-lab', {}, NOUN));
      c.addEventListener('click', () => guess(i));
      cups.push(c); table.append(c);
    }
    table.style.setProperty('--n', count);
  }

  const counts = choices(['3 ' + NOUN + 'S', '4 ' + NOUN + 'S', '5 ' + NOUN + 'S'], (i) => {
    if (busy) return;
    count = i + 3; counts.select(i); build(); paintOdds(); play('click');
  });
  const odds = readout('PAYS', '—');
  const msg = msgLine();
  const hist = historyRow();
  const bp = betPanel({ start: 25, min: 1, action: 'SHUFFLE', onAction: start });

  const paintOdds = () => odds.set(fairMult(count).toFixed(2) + '×');

  let hidden = -1, ready = false, stake = 0;

  async function start() {
    if (busy) return;
    stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); counts.lock(true);
    cups.forEach((c) => { c.className = 'shuf-cup'; c.firstChild.textContent = NOUN; });
    hidden = rndInt(count);
    msg.set('Watch closely…', 'push');
    for (let i = 0; i < 6; i++) {
      table.classList.toggle('swap', true);
      cups.forEach((c, j) => c.style.setProperty('--slide', `${(rndInt(3) - 1) * 100}%`));
      play('whoosh');
      await sleep(280);
      cups.forEach((c) => c.style.setProperty('--slide', '0%'));
      await sleep(90);
    }
    table.classList.remove('swap');
    ready = true; busy = false;
    msg.set(`Which ${NOUN.toLowerCase()} is it under?`, 'push');
  }

  function guess(i) {
    if (!ready) return;
    ready = false;
    cups.forEach((c, j) => {
      c.classList.add(j === hidden ? 'prize' : 'empty');
      c.firstChild.textContent = j === hidden ? '★' : '—';
    });
    cups[i].classList.add('picked');
    const payout = i === hidden ? round2(stake * fairMult(count)) : 0;
    if (payout) { play('win'); burst(cups[i]); } else play('lose');
    settle({ id: t.id, stake, payout, msg,
      winLabel: `Found it — ${fairMult(count).toFixed(2)}×`,
      loseLabel: `It was under ${NOUN.toLowerCase()} ${hidden + 1}` });
    hist.push(payout ? 'FOUND' : 'MISS', payout ? 'win' : 'lose');
    bp.unlock(); counts.lock(false);
  }

  build(); counts.select(0); paintOdds();
  root.append(scene(t, table, odds.node), el('div.eng-row', {}, counts.node), hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `One prize hides under a ${NOUN.toLowerCase()}, then they are shuffled six times.`,
      `Pick correctly and you are paid the true odds less the edge: <code>3 → ${fairMult(3).toFixed(2)}×</code>, <code>4 → ${fairMult(4).toFixed(2)}×</code>, <code>5 → ${fairMult(5).toFixed(2)}×</code>.`,
      `The shuffle is cosmetic — the hiding place is drawn once, fairly, and nothing about the animation changes it.`,
      `More ${NOUN.toLowerCase()}s means bigger swings, not a better return.`));
};

/* ═══════════════════════════════════════════ 8. MATCH3
   Reveal nine cells; three of a kind pays by symbol tier. */
export const match3 = (t) => (root) => {
  // (symbol, weight, payout for three of a kind)
  const SYMS = [
    { s: '◆', w: 34, pay: 0 }, { s: '●', w: 26, pay: 2 }, { s: '▲', w: 18, pay: 5.5 },
    { s: '★', w: 12, pay: 16 }, { s: '⬢', w: 7, pay: 54 }, { s: t.emblem, w: 3, pay: 270 },
  ];
  /* Eight scoring lines - three rows, three columns, two diagonals. Paying on
     any three cells anywhere returned 760%, because nine independent draws
     throw up a triple far more often than intuition suggests. */
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6],
    [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const TOTAL = SYMS.reduce((a, s) => a + s.w, 0);
  const roll = () => { let r = rndInt(TOTAL); for (const s of SYMS) { r -= s.w; if (r < 0) return s; } return SYMS[0]; };

  let busy = false;
  const grid = el('div.m3-grid');
  const cells = Array.from({ length: 9 }, () => {
    const c = el('div.m3-cell', {}, el('span', {}, '?'));
    grid.append(c); return c;
  });
  const msg = msgLine();
  const hist = historyRow();
  const bp = betPanel({ start: 25, min: 1, action: 'REVEAL', onAction: go });

  const paytable = el('div.paytable', {},
    el('h4', {}, 'THREE OF A KIND PAYS'),
    el('div.pt-rows', {}, SYMS.map((s) =>
      el('div.pt-row', {}, el('span.pt-sym', {}, s.s), el('span', {}, s.pay + '×')))));

  async function go() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock();
    const drawn = Array.from({ length: 9 }, roll);
    cells.forEach((c) => { c.className = 'm3-cell'; c.firstChild.textContent = '?'; });

    for (let i = 0; i < 9; i++) {
      cells[i].classList.add('flip');
      await sleep(110);
      cells[i].firstChild.textContent = drawn[i].s;
      play('cardFlip');
    }
    await sleep(220);

    let payout = 0, best = null;
    for (const line of LINES) {
      const [x, y, z] = line;
      if (drawn[x].s !== drawn[y].s || drawn[y].s !== drawn[z].s) continue;
      const def = drawn[x];
      if (def.pay === 0) continue;
      payout += stake * def.pay;
      line.forEach((i) => cells[i].classList.add('hit'));
      if (!best || def.pay > best.pay) best = def;
    }
    payout = round2(payout);
    if (payout > stake) { play('win'); burst(grid); } else if (!payout) play('lose');
    settle({ id: t.id, stake, payout, msg,
      winLabel: best ? `Three ${best.s} — ${best.pay}×` : 'WIN',
      loseLabel: 'No three of a kind' });
    hist.push(best ? best.s : '—', payout > stake ? 'win' : 'lose');
    busy = false; bp.unlock();
  }

  root.append(scene(t, grid), paytable, hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `Nine cells are drawn independently. Three matching symbols on any of the <b>eight lines</b> — three rows, three columns, two diagonals — pays.`,
      `Every line is scored, so one grid can pay more than once.`,
      `The common <code>${SYMS[0].s}</code> does not pay; the rest run <code>${SYMS[1].s} ${SYMS[1].pay}×</code> up to <code>${SYMS[5].s} ${SYMS[5].pay}×</code>.`,
      `Each cell is an independent draw from <code>crypto.getRandomValues</code> — there is no "due" symbol.`));
};

/* ═══════════════════════════════════════════ 9. WIRES
   Survive successive rounds where the choice narrows: 5 wires, then 4, then
   3, then 2. The odds get worse each round, which is why the prize jumps. */
export const wires = (t) => (root) => {
  const ROUNDS = [5, 4, 3, 2];
  // fair price = product of (n/(n-1)) survival odds so far, edge applied once
  const MULTS = ROUNDS.map((_, i) =>
    round2(EDGE * ROUNDS.slice(0, i + 1).reduce((a, n) => a * (n / (n - 1)), 1)));
  const COLOURS = ['#ff4d6a', '#4b8cff', '#2ee06a', '#ffc531', '#8b5cf6'];

  let live = false, stake = 0, r = 0;
  const panel = el('div.wire-panel');
  const cur = readout('IF YOU CUT', '—');
  const msg = msgLine();
  const hist = historyRow();
  const bp = betPanel({ start: 25, min: 1, action: 'START', onAction: start });

  function build() {
    const n = ROUNDS[r];
    panel.replaceChildren(...Array.from({ length: n }, (_, i) => {
      const w = el('button.wire', { type: 'button', 'aria-label': `Wire ${i + 1}`,
        style: { '--wire': COLOURS[i] } });
      w.addEventListener('click', () => cut(i));
      return w;
    }));
    cur.set(MULTS[r].toFixed(2) + '×');
  }

  function start() {
    if (live) return;
    stake = bp.value;
    if (!bp.take()) return;
    live = true; r = 0; build();
    bp.lock(); bp.setAction('CASH OUT', 'btn-green'); bp.actionBtn.disabled = true;
    msg.set(`Round 1 — ${ROUNDS[0]} wires, one is live`, 'push');
  }

  async function cut(i) {
    if (!live) return;
    const n = ROUNDS[r];
    const liveWire = rndInt(n);
    panel.children[i].classList.add('cut');
    play('click');
    await sleep(340);
    if (i === liveWire) {
      panel.children[i].classList.add('boom');
      play('lose');
      settle({ id: t.id, stake, payout: 0, msg, loseLabel: `Round ${r + 1} — that was the live wire` });
      hist.push(`R${r}`, 'lose');
      return finish();
    }
    r++;
    play('chip');
    bp.actionBtn.disabled = false;
    if (r >= ROUNDS.length) return cashOut();
    build();
    msg.set(`Survived round ${r} — banked ${MULTS[r - 1].toFixed(2)}× · next round has ${ROUNDS[r]} wires`, 'push');
  }

  function cashOut() {
    if (!live || r === 0) return;
    const payout = round2(stake * MULTS[r - 1]);
    burst(panel);
    settle({ id: t.id, stake, payout, msg, winLabel: `Cleared ${r} round${r > 1 ? 's' : ''} — ${MULTS[r - 1].toFixed(2)}×` });
    hist.push(`R${r}`, 'win');
    finish();
  }
  function finish() {
    live = false;
    bp.unlock(); bp.setAction('START', 'btn-gold'); bp.actionBtn.disabled = false;
  }
  bp.actionBtn.addEventListener('click', () => { if (live) cashOut(); });

  build();
  root.append(scene(t, panel, cur.node), hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `Four rounds. Each round shows fewer wires — <code>${ROUNDS.join('</code>, <code>')}</code> — and exactly one of them is live.`,
      `Survive a round and the prize climbs: <code>${MULTS.map((m) => m.toFixed(2) + '×').join('</code> <code>')}</code>.`,
      `The narrowing choice is the whole game: round one is a <code>${pct(4 / 5)}</code> shot, round four is a coin flip.`,
      `Cash out between rounds. Cut the live wire and the stake is gone.`));
};

/* ═══════════════════════════════════════════ 10. SPOTS
   A compact keno: 25 spots, 8 drawn, pick between one and six. */
export const spots = (t) => (root) => {
  const N = 25, DRAW = 8, MAXPICK = 6;
  /* Paytable per number of picks; index = hits. Tuned so every pick count
     returns close to the same 96-97%, verified by tools/rtp.mjs. */
  const TABLE = {
    1: [0, 3.0],
    2: [0, 0, 10.3],
    3: [0, 0, 2.0, 22.5],
    4: [0, 0, 0, 8, 66],
    5: [0, 0, 0, 2.8, 18, 155],
    6: [0, 0, 0, 0, 9.5, 64, 760],
  };
  const chosen = new Set();
  let busy = false;

  const grid = el('div.spot-grid');
  const cells = Array.from({ length: N }, (_, i) => {
    const c = el('button.spot-cell', { type: 'button' }, String(i + 1));
    c.addEventListener('click', () => toggle(i));
    grid.append(c); return c;
  });
  const msg = msgLine();
  const hist = historyRow();
  const payRow = el('div.paytable');
  const bp = betPanel({ start: 25, min: 1, action: 'DRAW', onAction: go });

  function toggle(i) {
    if (busy) return;
    if (chosen.has(i)) chosen.delete(i);
    else if (chosen.size < MAXPICK) chosen.add(i);
    else return;
    cells[i].classList.toggle('on', chosen.has(i));
    play('chip');
    paintPays();
  }
  function paintPays() {
    const k = chosen.size;
    payRow.replaceChildren(el('h4', {}, k ? `${k} SPOT${k > 1 ? 'S' : ''} — PAYS` : 'PICK 1 TO 6 SPOTS'));
    if (!k) return;
    const rows = el('div.pt-rows');
    TABLE[k].forEach((p, hits) => {
      if (p > 0) rows.append(el('div.pt-row', {}, el('span', {}, `${hits} hit${hits > 1 ? 's' : ''}`), el('span', {}, p + '×')));
    });
    payRow.append(rows);
    msg.set(`${k} spot${k > 1 ? 's' : ''} selected — top prize ${TABLE[k][k]}×`, 'push');
  }

  async function go() {
    if (busy || chosen.size === 0) { if (!chosen.size) msg.set('Select at least one spot', 'push'); return; }
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock();
    cells.forEach((c) => c.classList.remove('drawn', 'hit'));

    const drawn = pickDistinct(N, DRAW);
    for (const d of drawn) {
      cells[d].classList.add(chosen.has(d) ? 'hit' : 'drawn');
      play('chip');
      await sleep(140);
    }
    const hits = [...chosen].filter((c) => drawn.has(c)).length;
    const payout = round2(stake * (TABLE[chosen.size][hits] || 0));
    if (payout > stake) { play('win'); burst(grid); } else if (!payout) play('lose');
    settle({ id: t.id, stake, payout, msg,
      winLabel: `${hits} of ${chosen.size} hit`,
      loseLabel: `${hits} of ${chosen.size} hit — no prize` });
    hist.push(`${hits}/${chosen.size}`, payout > stake ? 'win' : 'lose');
    busy = false; bp.unlock();
  }

  paintPays();
  root.append(scene(t, grid), payRow, hist.node, msg.node, bp.node,
    rules('HOW IT PAYS',
      `<b>${DRAW} of ${N}</b> spots are drawn each round. Choose between one and six and you are paid on how many you match.`,
      `Every pick count is priced to return the same amount over time — six spots is more volatile, not more generous.`,
      `The top prize is <code>${TABLE[6][6]}×</code> for matching all six, which comes up about once in <code>${Math.round(1 / (Array.from({ length: 6 }, (_, i) => (DRAW - i) / (N - i)).reduce((a, b) => a * b, 1))).toLocaleString()}</code> rounds.`,
      `Draws use <code>crypto.getRandomValues</code> with rejection sampling, so all ${N} spots are equally likely.`));
};
