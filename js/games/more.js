/* Additional table engines: Dragon Tiger, Andar Bahar, Teen Patti,
   Casino Hold'em and the Big Six money wheel. */
import { el, clear, fmt, sleep, rndInt, shuffle, wallet, round2, toast } from '../core.js';
import { betPanel, msgLine, rules, newShoe, draw, evalPoker, cmpPoker } from '../ui.js';
import { feltTable, seat, spot, layCards } from '../felt.js';
import { play } from '../sound.js';

const G = (o) => o;
const hv = (c) => (c.v === 1 ? 14 : c.v);

/* ============================================================ DRAGON TIGER */
function dragonTiger(root) {
  const id = 'dragon-tiger';
  let shoe = newShoe(8), side = 'dragon', busy = false;
  const history = [];

  const dSeat = seat('Dragon'), tSeat = seat('Tiger');
  const spots = new Map();
  const spotRow = el('div.felt-row');
  for (const s of [
    { key: 'dragon', label: 'Dragon', sub: '1 to 1' },
    { key: 'tie', label: 'Tie', sub: '8 to 1' },
    { key: 'tiger', label: 'Tiger', sub: '1 to 1' },
  ]) {
    const node = spot(s.label, { sub: s.sub, key: s.key, onPick: choose });
    spots.set(s.key, node); spotRow.append(node);
  }
  const table = feltTable({ tone: 12, shoe: true,
    print: ['Dragon Tiger', 'One card each - highest card wins - tie pays 8 to 1'] });
  table.surface.append(el('div.felt-row', {}, dSeat, tSeat), spotRow);

  const histRow = el('div.history');
  const msg = msgLine();
  const bp = betPanel({ start: 25, min: 1, max: 2000, action: 'DEAL', onAction: deal });

  function choose(k) {
    if (busy) return;
    side = k;
    for (const [key, n] of spots) {
      n.classList.toggle('on', key === side);
      n.setStack(key === side ? bp.value : 0);
    }
    play('chip');
  }

  async function deal() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); msg.clear();
    if (shoe.length < 12) shoe = newShoe(8);

    const dc = draw(shoe, 8), tc = draw(shoe, 8);
    layCards(dSeat.cards, [null]); layCards(tSeat.cards, [null]);
    dSeat.setBadge(''); tSeat.setBadge('');
    play('cardDeal');
    await sleep(420);
    layCards(dSeat.cards, [dc]); dSeat.setBadge(dc.r + dc.suit);
    play('cardFlip');
    await sleep(420);
    layCards(tSeat.cards, [tc]); tSeat.setBadge(tc.r + tc.suit);
    play('cardFlip');
    await sleep(300);

    const winner = hv(dc) > hv(tc) ? 'dragon' : hv(tc) > hv(dc) ? 'tiger' : 'tie';
    dSeat.setBadge(dc.r + dc.suit, winner === 'dragon' ? 'win' : '');
    tSeat.setBadge(tc.r + tc.suit, winner === 'tiger' ? 'win' : '');

    let payout = 0;
    if (winner === 'tie') {
      // house rule: a tie takes half of the dragon/tiger bets
      if (side === 'tie') payout = stake * 9;
      else payout = stake / 2;
    } else if (side === winner) payout = stake * 2;

    if (payout > 0) wallet.pay(payout);
    const label = `Dragon ${dc.r} — Tiger ${tc.r} · ${winner.toUpperCase()}`;
    if (payout > stake) msg.win(payout - stake, label + ' ·', stake);
    else if (payout === stake) msg.push(label);
    else msg.lose(label);
    wallet.logResult(id, stake, payout);

    history.unshift(winner);
    if (history.length > 14) history.pop();
    clear(histRow);
    for (const h of history) {
      histRow.append(el('div.hnum', {
        style: { background: h === 'dragon' ? '#c92c46' : h === 'tiger' ? '#d4a017' : '#128a4a' },
      }, h[0].toUpperCase()));
    }
    busy = false; bp.unlock();
  }

  choose('dragon');
  root.append(table, histRow, msg.node, bp.node,
    rules('DRAGON TIGER',
      `The fastest game on the floor: <b>one card to Dragon, one to Tiger</b>, higher card wins. Suits are ignored, aces are low.`,
      `Dragon and Tiger pay <code>1:1</code>. <b>Tie pays 8:1</b> — but on a tie, Dragon and Tiger bets lose half their stake.`,
      `House edge <code>3.7%</code> on Dragon/Tiger, much higher on the tie.`,
      `8-deck shoe, reshuffled when it runs low.`));
}

/* ============================================================ ANDAR BAHAR */
function andarBahar(root) {
  const id = 'andar-bahar';
  let shoe = newShoe(1), side = 'andar', busy = false;

  const jokerSeat = seat('Joker card');
  const andarRow = el('div.ab-run'), baharRow = el('div.ab-run');
  const spots = new Map();
  const spotRow = el('div.felt-row');
  for (const s of [
    { key: 'andar', label: 'Andar', sub: '0.9 to 1' },
    { key: 'bahar', label: 'Bahar', sub: '1 to 1' },
  ]) {
    const node = spot(s.label, { sub: s.sub, key: s.key, onPick: choose });
    spots.set(s.key, node); spotRow.append(node);
  }
  const table = feltTable({ tone: 300, shoe: true,
    print: ['Andar Bahar', 'Cards deal either side until the joker rank repeats'] });
  table.surface.append(jokerSeat,
    el('div.ab-lane', {}, el('span', {}, 'ANDAR'), andarRow),
    el('div.ab-lane', {}, el('span', {}, 'BAHAR'), baharRow),
    spotRow);

  const msg = msgLine();
  const bp = betPanel({ start: 25, min: 1, max: 2000, action: 'DEAL', onAction: deal });

  function choose(k) {
    if (busy) return;
    side = k;
    for (const [key, n] of spots) {
      n.classList.toggle('on', key === side);
      n.setStack(key === side ? bp.value : 0);
    }
    play('chip');
  }

  async function deal() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); msg.clear();
    clear(andarRow); clear(baharRow);
    shoe = newShoe(1);

    const joker = draw(shoe);
    layCards(jokerSeat.cards, [joker]);
    jokerSeat.setBadge(joker.r + joker.suit);
    play('cardFlip');
    await sleep(600);

    // the side matching the joker's colour receives the first card
    let turn = joker.red ? 'andar' : 'bahar';
    let winner = null, count = 0;
    while (!winner && count < 52) {
      const c = draw(shoe);
      if (!c) break;
      const lane = turn === 'andar' ? andarRow : baharRow;
      lane.append(el('div.ab-card' + (c.red ? '.red' : ''), {}, c.r + c.suit));
      lane.scrollLeft = lane.scrollWidth;
      play('cardDeal');
      count++;
      if (c.r === joker.r) winner = turn;
      else turn = turn === 'andar' ? 'bahar' : 'andar';
      await sleep(Math.max(70, 240 - count * 8));
    }

    const payout = side === winner ? round2(stake * (side === 'andar' ? 1.9 : 2)) : 0;
    if (payout > 0) wallet.pay(payout);
    const label = `${winner ? winner.toUpperCase() : 'NO MATCH'} after ${count} cards`;
    if (payout > 0) msg.win(payout - stake, label + ' ·', stake);
    else msg.lose(label);
    wallet.logResult(id, stake, payout);
    busy = false; bp.unlock();
  }

  choose('andar');
  root.append(table, msg.node, bp.node,
    rules('ANDAR BAHAR',
      `A single <b>joker card</b> is turned. Cards are then dealt alternately to <b>Andar</b> and <b>Bahar</b> until one matches the joker's rank.`,
      `The side matching the joker's colour is dealt first, which is why it wins slightly more often — so <b>Andar pays 0.9:1</b> while <b>Bahar pays 1:1</b>.`,
      `House edge around <code>2.1%</code>. Fresh 52-card deck every round.`));
}

/* ============================================================ TEEN PATTI */
function rank3(cards) {
  const v = cards.map(hv).sort((a, b) => b - a);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const straight = (v[0] - v[1] === 1 && v[1] - v[2] === 1) || (v[0] === 14 && v[1] === 3 && v[2] === 2);
  const trips = v[0] === v[1] && v[1] === v[2];
  const pair = v[0] === v[1] || v[1] === v[2];
  // Teen Patti ranking: trail > pure sequence > sequence > colour > pair > high
  let r;
  if (trips) r = 5; else if (straight && flush) r = 4; else if (straight) r = 3;
  else if (flush) r = 2; else if (pair) r = 1; else r = 0;
  const names = ['High Card', 'Pair', 'Colour', 'Sequence', 'Pure Sequence', 'Trail'];
  const key = pair && !trips ? (v[0] === v[1] ? [v[0], v[2]] : [v[1], v[0]]) : v;
  return { r, name: names[r], key };
}
const cmpKey = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

function teenPatti(root) {
  const id = 'teen-patti';
  let shoe = [], stake = 0, phase = 'bet', p = [], d = [];

  const dSeat = seat('Dealer'), pSeat = seat('Your hand');
  const anteSpot = spot('Boot'), playSpot = spot('Play');
  const table = feltTable({ tone: 276, shoe: true,
    print: ['Teen Patti', 'Trail beats pure sequence - dealer plays with queen high'] });
  table.surface.append(dSeat, pSeat, el('div.felt-row', {}, anteSpot, playSpot));

  const msg = msgLine();
  const btnPlay = el('button.btn.btn-green', { type: 'button', onclick: () => decide(true) }, 'PLAY (match boot)');
  const btnFold = el('button.btn.btn-red', { type: 'button', onclick: () => decide(false) }, 'FOLD');
  const row = el('div.felt-actions', {}, btnPlay, btnFold);
  row.hidden = true;
  const bp = betPanel({ start: 25, min: 1, max: 1000, label: 'BOOT', action: 'DEAL', onAction: deal });
  const BONUS = { 5: 8, 4: 5, 3: 2, 2: 1 };   // trail / pure seq / sequence / colour

  function deal() {
    if (phase !== 'bet') return;
    stake = bp.value;
    if (!bp.take()) return;
    shoe = newShoe(1);
    p = [draw(shoe), draw(shoe), draw(shoe)];
    d = [draw(shoe), draw(shoe), draw(shoe)];
    layCards(pSeat.cards, p); pSeat.setBadge(rank3(p).name);
    layCards(dSeat.cards, [null, null, null]); dSeat.setBadge('');
    anteSpot.setStack(stake); playSpot.setStack(0);
    play('cardDeal');
    phase = 'decide'; row.hidden = false; bp.lock();
    msg.set('Play or fold?', 'push');
  }

  function decide(playOn) {
    row.hidden = true;
    const pr = rank3(p), dr = rank3(d);
    layCards(dSeat.cards, d); dSeat.setBadge(dr.name);
    play('cardFlip');

    let payout = 0, total = stake, note = '';
    const bonus = BONUS[pr.r] ? stake * BONUS[pr.r] : 0;

    if (!playOn) note = 'Folded';
    else {
      if (!wallet.bet(stake)) { row.hidden = false; return; }
      total = stake * 2;
      playSpot.setStack(stake);
      const dq = dr.r > 0 || dr.key[0] >= 12;
      if (!dq) { payout = stake * 2 + stake; note = 'Dealer does not play — boot pays 1:1'; }
      else {
        const cmp = pr.r - dr.r || cmpKey(pr.key, dr.key);
        if (cmp > 0) { payout = stake * 4; note = `${pr.name} beats ${dr.name}`; }
        else if (cmp === 0) { payout = stake * 2; note = 'Tie — both bets push'; }
        else note = `${dr.name} beats ${pr.name}`;
      }
    }
    payout += bonus;
    if (bonus) note += ` · Bonus ${BONUS[pr.r]}:1 for ${pr.name}`;
    if (payout > 0) wallet.pay(payout);
    const net = payout - total;
    if (net > 0) msg.win(net, note + ' ·', total);
    else if (net === 0) msg.push(note);
    else msg.lose(note);
    wallet.logResult(id, total, payout);
    phase = 'bet'; bp.unlock();
  }

  root.append(table, row, msg.node, bp.node,
    rules('TEEN PATTI',
      `The Indian three-card game. Post the <b>boot</b>, see your cards, then match it to play on or fold.`,
      `Ranking: <code>Trail > Pure Sequence > Sequence > Colour > Pair > High Card</code> — note the trail (three of a kind) is the top hand, unlike three card poker.`,
      `Dealer plays with <b>queen high or better</b>. If not, the boot pays 1:1 and the play bet pushes.`,
      `Bonus regardless of the dealer: colour <code>1:1</code> · sequence <code>2:1</code> · pure sequence <code>5:1</code> · trail <code>8:1</code>.`));
}

/* ============================================================ CASINO HOLD'EM */
/** Best five-card hand out of seven. */
function best5(cards) {
  let best = null;
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++) {
            const h = evalPoker([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || cmpPoker(h, best) > 0) best = h;
          }
  return best;
}

function casinoHoldem(root) {
  const id = 'casino-holdem';
  let shoe = [], stake = 0, phase = 'bet', hole = [], dealerHole = [], board = [];

  const dSeat = seat('Dealer'), boardSeat = seat('Community'), pSeat = seat('Your hand');
  const anteSpot = spot('Ante'), callSpot = spot('Call');
  const table = feltTable({ tone: 210, shoe: true,
    print: ['Casino Hold’em', 'Dealer qualifies with a pair of fours or better'] });
  table.surface.append(dSeat, boardSeat, pSeat, el('div.felt-row', {}, anteSpot, callSpot));

  const msg = msgLine();
  const btnCall = el('button.btn.btn-green', { type: 'button', onclick: () => decide(true) }, 'CALL (2× ante)');
  const btnFold = el('button.btn.btn-red', { type: 'button', onclick: () => decide(false) }, 'FOLD');
  const row = el('div.felt-actions', {}, btnCall, btnFold);
  row.hidden = true;
  const bp = betPanel({ start: 25, min: 1, max: 1000, label: 'ANTE', action: 'DEAL', onAction: deal });
  /* ante odds by rank: straight 1:1 up to royal 100:1 */
  const ANTE_ODDS = [0, 0, 0, 0, 1, 2, 3, 10, 20, 100];

  function deal() {
    if (phase !== 'bet') return;
    stake = bp.value;
    if (!bp.take()) return;
    shoe = newShoe(1);
    hole = [draw(shoe), draw(shoe)];
    dealerHole = [draw(shoe), draw(shoe)];
    board = [draw(shoe), draw(shoe), draw(shoe)];
    layCards(pSeat.cards, hole);
    layCards(boardSeat.cards, board);
    layCards(dSeat.cards, [null, null]);
    pSeat.setBadge(best5([...hole, ...board]).name);
    boardSeat.setBadge('flop');
    dSeat.setBadge('');
    anteSpot.setStack(stake); callSpot.setStack(0);
    play('cardDeal');
    phase = 'decide'; row.hidden = false; bp.lock();
    msg.set('Call or fold?', 'push');
  }

  async function decide(call) {
    row.hidden = true;
    let payout = 0, total = stake, note = '';

    if (!call) {
      note = 'Folded — ante lost';
      layCards(dSeat.cards, dealerHole); dSeat.setBadge('');
    } else {
      if (!wallet.bet(stake * 2)) { row.hidden = false; return; }
      total = stake * 3;
      callSpot.setStack(stake * 2);
      board.push(draw(shoe), draw(shoe));
      layCards(boardSeat.cards, board); boardSeat.setBadge('river');
      play('cardDeal');
      await sleep(500);
      layCards(dSeat.cards, dealerHole);
      play('cardFlip');

      const pe = best5([...hole, ...board]);
      const de = best5([...dealerHole, ...board]);
      pSeat.setBadge(pe.name); dSeat.setBadge(de.name);

      const dq = de.rank >= 1;            // pair of fours or better
      const cmp = cmpPoker(pe, de);
      const anteOdds = ANTE_ODDS[pe.rank] || 0;

      if (!dq) {
        payout = stake * (1 + anteOdds) + stake * 2;
        note = `Dealer does not qualify — ante pays ${anteOdds ? anteOdds + ':1' : 'even'}, call returns`;
      } else if (cmp > 0) {
        payout = stake * 2 + stake * anteOdds + stake * 4;
        note = `${pe.name} beats ${de.name}`;
        pSeat.setBadge(pe.name, 'win');
      } else if (cmp === 0) { payout = total; note = 'Tie — all bets push'; }
      else { note = `${de.name} beats ${pe.name}`; dSeat.setBadge(de.name, 'win'); }
    }

    if (payout > 0) wallet.pay(payout);
    const net = payout - total;
    if (net > 0) msg.win(net, note + ' ·', total);
    else if (net === 0) msg.push(note);
    else msg.lose(note);
    wallet.logResult(id, total, payout);
    phase = 'bet'; bp.unlock();
  }

  root.append(table, row, msg.node, bp.node,
    rules('CASINO HOLD’EM',
      `Ante, then you and the dealer each get two hole cards against a shared <b>flop</b>. Call for twice the ante to see the turn and river, or fold.`,
      `Best five cards out of seven wins. <b>Dealer qualifies with a pair of fours or better</b>; if not, the ante pays and the call bet pushes.`,
      `Ante bonus: straight <code>1:1</code> · flush <code>2:1</code> · full house <code>3:1</code> · quads <code>10:1</code> · straight flush <code>20:1</code> · royal <code>100:1</code>.`,
      `House edge around <code>2.2%</code>.`));
}

/* ============================================================ BIG SIX WHEEL */
const BIG6 = [
  { v: 1, w: 24, c: '#3d4668' }, { v: 2, w: 15, c: '#128a4a' }, { v: 5, w: 7, c: '#1f6dff' },
  { v: 10, w: 4, c: '#c92c46' }, { v: 20, w: 2, c: '#6d3fd4' }, { v: 45, w: 2, c: '#d4a017' },
];
function bigSix(root) {
  const id = 'big-six';
  let busy = false, rotation = 0, pick = 1;

  /* build 54 segments in the classic money-wheel distribution */
  const segs = [];
  for (const b of BIG6) for (let i = 0; i < b.w; i++) segs.push(b);
  shuffle(segs);
  const step = 360 / segs.length;
  const stops = segs.map((b, i) =>
    `${b.c} ${(i * step).toFixed(3)}deg ${((i + 1) * step).toFixed(3)}deg`).join(',');

  const disc = el('div.fw', { style: { background: `conic-gradient(${stops})` } });
  const wrap = el('div.fw-wrap', {}, el('div.fw-ptr', {}, '▼'), disc);
  const msg = msgLine();

  const spots = new Map();
  const spotRow = el('div.felt-row');
  for (const b of BIG6) {
    const node = spot(`$${b.v}`, { sub: `${b.v} to 1`, key: String(b.v), onPick: choose });
    spots.set(b.v, node); spotRow.append(node);
  }
  const table = feltTable({ tone: 32, shoe: false,
    print: ['Big Six Money Wheel', '54 segments - pays the odds shown on the segment'] });
  table.surface.append(wrap, spotRow);

  const bp = betPanel({ start: 25, min: 1, max: 2000, action: 'SPIN', onAction: spin });

  function choose(k) {
    if (busy) return;
    pick = Number(k);
    for (const [v, n] of spots) {
      n.classList.toggle('on', v === pick);
      n.setStack(v === pick ? bp.value : 0);
    }
    play('chip');
  }

  async function spin() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); msg.clear();

    const idx = rndInt(segs.length);
    rotation += 360 * 5 + (360 - (idx * step + step / 2));
    disc.style.transform = `rotate(${rotation}deg)`;
    const stopTick = (() => {
      let n = 0;
      const t = setInterval(() => { play('wheelTick'); if (++n > 46) clearInterval(t); }, 90);
      return () => clearInterval(t);
    })();
    await sleep(4500);
    stopTick();

    const hit = segs[idx].v;
    const payout = hit === pick ? round2(stake * (pick + 1)) : 0;
    if (payout > 0) wallet.pay(payout);
    if (payout > 0) msg.win(payout - stake, `$${hit} — pays ${pick}:1 ·`, stake);
    else msg.lose(`$${hit} — you backed $${pick}`);
    wallet.logResult(id, stake, payout);
    busy = false; bp.unlock();
  }

  choose('1');
  root.append(table, msg.node, bp.node,
    rules('BIG SIX MONEY WHEEL',
      `The classic carnival wheel: <b>54 segments</b> marked $1, $2, $5, $10, $20 and the $45 joker.`,
      `Back a symbol and it pays those odds — <code>$1 pays 1:1</code>, <code>$20 pays 20:1</code>, the joker pays <code>45:1</code>.`,
      `Segment counts: 24×$1, 15×$2, 7×$5, 4×$10, 2×$20, 2×joker.`,
      `This is a high-edge game by design — between <code>11%</code> and <code>24%</code> depending on the symbol.`));
}

/* ============================================================ exports */
export const moreGames = [
  G({ id: 'dragon-tiger', name: 'Dragon Tiger', cat: 'table', icon: '🐲', art: 'linear-gradient(160deg,#3d1220,#0b0d1c)', rtp: 96.3, vol: 'Low', tags: ['hot'], mount: dragonTiger }),
  G({ id: 'andar-bahar', name: 'Andar Bahar', cat: 'table', icon: '🎴', art: 'linear-gradient(160deg,#3a1236,#0b0d1c)', rtp: 97.9, vol: 'Low', tags: ['new'], mount: andarBahar }),
  G({ id: 'teen-patti', name: 'Teen Patti', cat: 'poker', icon: '🃏', art: 'linear-gradient(160deg,#2a1a52,#0b0d1c)', rtp: 96.5, vol: 'Medium', tags: ['new'], mount: teenPatti }),
  G({ id: 'casino-holdem', name: "Casino Hold'em", cat: 'poker', icon: '♠️', art: 'linear-gradient(160deg,#13294d,#0b0d1c)', rtp: 97.8, vol: 'Medium', tags: ['hot'], mount: casinoHoldem }),
  G({ id: 'big-six', name: 'Big Six Wheel', cat: 'table', icon: '🎡', art: 'linear-gradient(160deg,#3d2c12,#0b0d1c)', rtp: 88.9, vol: 'High', mount: bigSix }),
];
