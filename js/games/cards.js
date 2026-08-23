/* Card games: blackjack (2), baccarat, video poker (3), casino war,
   three card poker, caribbean stud, red dog, hi-lo. */
import { el, clear, fmt, sleep, rndInt, shuffle, wallet, round2 } from '../core.js';
import {
  betPanel, msgLine, rules, newShoe, draw, cardEl,
  evalPoker, cmpPoker, RANKS,
} from '../ui.js';
import { feltTable, seat, spot, layCards } from '../felt.js';
import { randomNames, randomFlag, basicStrategy, botStake } from '../players.js';
import { play } from '../sound.js';

const G = (o) => o;

/* ============================================================ BLACKJACK */
function bjValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.v === 1) { aces++; total += 11; }
    else total += Math.min(c.v, 10);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}
const isBJ = (cards) => cards.length === 2 && bjValue(cards).total === 21;

function blackjack({ decks, name, id, h17 = false }) {
  return function mount(root) {
    let shoe = newShoe(decks);
    let dealer = [], hands = [], active = 0, stake = 0, over = true;
    /* Simulated companions. Bots, not people — see js/players.js. */
    const SEATS = 3;
    let bots = [];

    /* ── the table ── */
    const dealerSeat = seat('Dealer');
    const botRow = el('div.felt-row.bot-row');
    const playerRow = el('div.felt-row');
    const table = feltTable({
      tone: h17 ? 196 : 152,
      shoe: true, discard: true,
      print: ['Blackjack pays 3 to 2',
        `Dealer must draw to 16 and stand on ${h17 ? 'soft 17' : 'all 17s'}`],
    });
    table.surface.append(dealerSeat, botRow, playerRow);

    const msg = msgLine();
    const shoeInfo = el('div.readout');

    const btnHit = el('button.btn.btn-green', { type: 'button', onclick: () => act('hit') }, 'HIT');
    const btnStand = el('button.btn', { type: 'button', onclick: () => act('stand') }, 'STAND');
    const btnDouble = el('button.btn', { type: 'button', onclick: () => act('double') }, 'DOUBLE');
    const btnSplit = el('button.btn', { type: 'button', onclick: () => act('split') }, 'SPLIT');
    const actions = el('div.felt-actions', {}, btnHit, btnStand, btnDouble, btnSplit);
    actions.hidden = true;

    const bp = betPanel({ start: 25, min: 1, max: 2000, action: 'DEAL', onAction: deal });

    function d() {
      if (shoe.length < decks * 15) shoe = newShoe(decks);
      return draw(shoe, decks);
    }

    function render(revealHole = false) {
      const open = over || revealHole;
      layCards(dealerSeat.cards, open ? dealer : [dealer[0], null]);
      if (!dealer.length) dealerSeat.setBadge('');
      else if (!open) dealerSeat.setBadge(bjValue([dealer[0]]).total + ' +');
      else {
        const dv = bjValue(dealer).total;
        dealerSeat.setBadge(isBJ(dealer) ? 'BLACKJACK' : dv,
          isBJ(dealer) ? 'bj' : dv > 21 ? 'bust' : '');
      }

      clear(botRow);
      for (const b of bots) {
        const bs = seat(b.name);
        bs.classList.add('bot-seat');
        layCards(bs.cards, b.cards);
        const bv = bjValue(b.cards);
        bs.setBadge(
          b.cards.length === 0 ? ''
            : b.bust ? `${bv.total} BUST`
              : isBJ(b.cards) ? 'BLACKJACK' : bv.total,
          b.bust ? 'bust' : isBJ(b.cards) ? 'bj' : b.result === 'win' ? 'win' : '');
        const chip = spot(b.flag + ' ' + (b.result ? b.result.toUpperCase() : 'Bet'));
        chip.setStack(b.bet);
        botRow.append(el('div.felt-box.bot-box', {}, bs, chip));
      }

      clear(playerRow);
      hands.forEach((h, i) => {
        const s = seat(hands.length > 1 ? `Hand ${i + 1}` : 'Your hand');
        layCards(s.cards, h.cards);
        const v = bjValue(h.cards);
        s.setBadge(
          h.bust ? `${v.total} BUST`
            : isBJ(h.cards) ? 'BLACKJACK'
              : `${v.total}${v.soft && v.total !== 21 ? ' soft' : ''}`,
          h.bust ? 'bust' : isBJ(h.cards) ? 'bj' : '');

        const circle = spot('Bet');
        circle.setStack(h.bet);
        const box = el('div.felt-box' + (!h.done && i === active && !over ? '.active' : '')
          + (h.done && !over ? '.settled' : ''), {}, s, circle);
        playerRow.append(box);
      });
      shoeInfo.textContent = `shoe: ${shoe.length} cards remaining · ${decks} decks`;
    }
    function updateButtons() {
      const h = hands[active];
      const can = h && !h.done;
      actions.hidden = !can;
      if (!can) return;
      btnDouble.disabled = h.cards.length !== 2 || !wallet.can(h.bet);
      btnSplit.disabled = !(h.cards.length === 2 && hands.length < 4 &&
        Math.min(h.cards[0].v, 10) === Math.min(h.cards[1].v, 10) && wallet.can(h.bet));
    }

    function deal() {
      if (!over) return;
      stake = bp.value;
      if (!bp.take()) return;
      over = false; bp.lock(); msg.clear();
      dealer = [d(), d()];
      bots = randomNames(SEATS).map((name) => ({
        name, flag: randomFlag(), cards: [d(), d()],
        bet: botStake(stake), done: false, bust: false, result: null,
      }));
      hands = [{ cards: [d(), d()], bet: stake, done: false, bust: false }];
      active = 0;
      play('cardDeal');
      render(); updateButtons();

      if (isBJ(hands[0].cards) || isBJ(dealer)) { hands[0].done = true; finish(); }
    }

    function act(what) {
      const h = hands[active];
      if (!h || h.done) return;
      play('cardDeal');
      if (what === 'hit') {
        h.cards.push(d());
        const v = bjValue(h.cards);
        if (v.total > 21) { h.bust = true; h.done = true; }
        else if (v.total === 21) h.done = true;
      } else if (what === 'stand') {
        h.done = true;
      } else if (what === 'double') {
        if (!wallet.bet(h.bet)) return;
        h.bet = round2(h.bet * 2);
        h.cards.push(d());
        if (bjValue(h.cards).total > 21) h.bust = true;
        h.done = true;
      } else if (what === 'split') {
        if (!wallet.bet(h.bet)) return;
        const moved = h.cards.pop();
        const nh = { cards: [moved, d()], bet: h.bet, done: false, bust: false };
        h.cards.push(d());
        hands.splice(active + 1, 0, nh);
      }
      while (active < hands.length && hands[active].done) active++;
      render(); updateButtons();
      if (active >= hands.length) finish();
    }

    /** Each simulated seat plays basic strategy against the dealer up-card. */
    async function playBots() {
      const up = dealer[0].v;
      for (const b of bots) {
        let guard = 0;
        while (!b.done && guard++ < 8) {
          const v = bjValue(b.cards);
          if (v.total >= 21) break;
          const move = basicStrategy(v.total, v.soft, b.cards.length === 2, up);
          if (move === 'stand') break;
          if (move === 'double') { b.bet = round2(b.bet * 2); b.cards.push(d()); b.done = true; }
          else b.cards.push(d());
          if (bjValue(b.cards).total > 21) { b.bust = true; b.done = true; }
          render(); play('cardDeal');
          await sleep(230);
        }
        b.done = true;
      }
    }

    async function finish() {
      actions.hidden = true;
      await playBots();
      const live = hands.some((h) => !h.bust) || bots.some((b) => !b.bust);
      render(true);
      if (live && !isBJ(hands[0].cards)) {
        await sleep(400);
        while (true) {
          const v = bjValue(dealer);
          if (v.total < 17 || (h17 && v.total === 17 && v.soft)) { dealer.push(d()); render(true); await sleep(420); }
          else break;
        }
      }
      over = true;
      const dv = bjValue(dealer).total, dbj = isBJ(dealer);
      let payout = 0; const parts = [];
      for (const h of hands) {
        const pv = bjValue(h.cards).total;
        if (h.bust) { parts.push('bust'); continue; }
        if (isBJ(h.cards) && !dbj) { payout += h.bet * 2.5; parts.push('blackjack 3:2'); continue; }
        if (dbj && !isBJ(h.cards)) { parts.push('dealer BJ'); continue; }
        if (dbj && isBJ(h.cards)) { payout += h.bet; parts.push('push'); continue; }
        if (dv > 21 || pv > dv) { payout += h.bet * 2; parts.push('win'); }
        else if (pv === dv) { payout += h.bet; parts.push('push'); }
        else parts.push('lose');
      }
      for (const b of bots) {
        const bv = bjValue(b.cards).total;
        if (b.bust) b.result = 'lost';
        else if (isBJ(b.cards) && !dbj) b.result = 'win';
        else if (dbj && !isBJ(b.cards)) b.result = 'lost';
        else if (dv > 21 || bv > dv) b.result = 'win';
        else if (bv === dv) b.result = 'push';
        else b.result = 'lost';
      }
      const totalBet = hands.reduce((s, h) => s + h.bet, 0);
      render(true);
      if (payout > 0) wallet.pay(payout);
      const net = payout - totalBet;
      if (net > 0) msg.win(net, 'WIN', totalBet);
      else if (net === 0) msg.push(`PUSH · ${parts.join(', ')}`);
      else msg.lose(`Dealer ${dv > 21 ? 'busts' : dv} — ${parts.join(', ')}`);
      wallet.logResult(id, totalBet, payout);
      bp.unlock();
    }

    render();
    root.append(table, actions, msg.node, bp.node, shoeInfo,
      rules('BLACKJACK RULES',
        `<b>${decks}-deck shoe</b>, reshuffled when it runs low. Blackjack pays <code>3:2</code>, other wins pay <code>1:1</code>.`,
        `Dealer ${h17 ? 'hits' : 'stands on'} <code>soft 17</code>. Double on any two cards, split up to 4 hands.`,
        `Ties push and your stake is returned. Insurance is not offered.`,
        `The three seats above you are <b>simulated companions</b> playing basic strategy — bots generated in your browser, not other people. Their results never affect your hand or your balance.`,
        `House edge with basic strategy ≈ <code>${h17 ? '0.6' : '0.4'}%</code>.`));
  };
}

/* ============================================================ BACCARAT */
function baccarat({ id, noComm = false }) {
  return function mount(root) {
  let shoe = newShoe(8), side = 'player', busy = false;
  const pts = (cards) => cards.reduce((s, c) => s + Math.min(c.v, 10) % 10, 0) % 10;

  const pSeat = seat('Player'), bSeat = seat('Banker');
  const msg = msgLine();

  const SPOTS = [
    { key: 'player', label: 'Player', sub: '1 to 1' },
    { key: 'banker', label: 'Banker', sub: noComm ? '1 to 1' : '1 to 1 -5%' },
    { key: 'tie', label: 'Tie', sub: '8 to 1' },
    { key: 'ppair', label: 'P Pair', sub: '11 to 1' },
    { key: 'bpair', label: 'B Pair', sub: '11 to 1' },
  ];
  const spots = new Map();
  const spotRow = el('div.felt-row');
  for (const sp of SPOTS) {
    const node = spot(sp.label, { sub: sp.sub, key: sp.key, onPick: choose });
    spots.set(sp.key, node);
    spotRow.append(node);
  }
  function choose(k) {
    if (busy) return;
    side = k;
    for (const [key, node] of spots) {
      node.classList.toggle('on', key === side);
      node.setStack(key === side ? bp.value : 0);
    }
  }

  const table = feltTable({ tone: 348, shoe: true, discard: true,
    print: ['Baccarat - Punto Banco', 'Banker wins pay 5% commission - tie pays 8 to 1'] });
  table.surface.append(el('div.felt-row', {}, pSeat, bSeat), spotRow);

  const bp = betPanel({ start: 25, min: 1, max: 2000, action: 'DEAL', onAction: play });

  async function play() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); msg.clear();
    if (shoe.length < 30) shoe = newShoe(8);
    const d = () => draw(shoe, 8);

    const p = [d(), d()], b = [d(), d()];
    layCards(pSeat.cards, p); layCards(bSeat.cards, b);
    pSeat.setBadge(pts(p)); bSeat.setBadge(pts(b));
    await sleep(600);

    if (pts(p) < 8 && pts(b) < 8) {
      let third = null;
      if (pts(p) <= 5) { third = d(); p.push(third); layCards(pSeat.cards, p); pSeat.setBadge(pts(p)); await sleep(450); }
      const bt = pts(b);
      let bDraw;
      if (third === null) bDraw = bt <= 5;
      else {
        const t = Math.min(third.v, 10) % 10;
        bDraw = bt <= 2 || (bt === 3 && t !== 8) || (bt === 4 && t >= 2 && t <= 7) ||
                (bt === 5 && t >= 4 && t <= 7) || (bt === 6 && (t === 6 || t === 7));
      }
      if (bDraw) { b.push(d()); layCards(bSeat.cards, b); bSeat.setBadge(pts(b)); await sleep(450); }
    }

    const pv = pts(p), bv = pts(b);
    const winner = pv > bv ? 'player' : bv > pv ? 'banker' : 'tie';
    pSeat.setBadge(pv, winner === 'player' ? 'win' : '');
    bSeat.setBadge(bv, winner === 'banker' ? 'win' : '');
    let payout = 0;
    if (side === 'player' && winner === 'player') payout = stake * 2;
    else if (side === 'banker' && winner === 'banker') {
      // no-commission pays even money, but a banker win on 6 pays only half
      payout = noComm ? (bv === 6 ? stake * 1.5 : stake * 2) : stake + stake * 0.95;
    }
    else if (side === 'tie' && winner === 'tie') payout = stake * 9;
    else if ((side === 'player' || side === 'banker') && winner === 'tie') payout = stake;
    else if (side === 'ppair' && Math.min(p[0].v, 10) === Math.min(p[1].v, 10)) payout = stake * 12;
    else if (side === 'bpair' && Math.min(b[0].v, 10) === Math.min(b[1].v, 10)) payout = stake * 12;

    if (payout > 0) wallet.pay(payout);
    const label = `Player ${pv} — Banker ${bv} · ${winner.toUpperCase()}`;
    if (payout > stake) msg.win(payout - stake, label + ' · WIN', stake);
    else if (payout === stake) msg.push(label + ' · PUSH');
    else msg.lose(label);
    wallet.logResult(id, stake, payout);
    busy = false; bp.unlock();
  }

  choose('player');
  root.append(table, msg.node, bp.node,
    rules(noComm ? 'NO COMMISSION BACCARAT' : 'BACCARAT — PUNTO BANCO',
      `Cards count face value, 10s and faces are <code>0</code>, only the last digit of the total counts.`,
      `Third-card draws follow the standard punto banco tableau — no decisions to make.`,
      noComm
        ? `Player <code>1:1</code> · Banker <code>1:1 with no commission</code>, except a <b>banker win on 6 pays only 1:2</b> — that is where the house takes its cut instead.`
        : `Player <code>1:1</code> · Banker <code>1:1 less 5% commission</code> · Tie <code>8:1</code> · Either Pair <code>11:1</code>.`,
      noComm
        ? `House edge: banker <code>1.46%</code>, player <code>1.24%</code>. No mental arithmetic on payouts. 8-deck shoe.`
        : `House edge: banker <code>1.06%</code>, player <code>1.24%</code>, tie <code>14.4%</code>. 8-deck shoe.`));
  };
}

/* ============================================================ VIDEO POKER */
const VP_KEYS = {
  royal: 'Royal Flush', wildRoyal: 'Wild Royal Flush', fourDeuces: 'Four Deuces',
  fiveJoker: 'Five of a Kind + Joker', five: 'Five of a Kind', straightFlush: 'Straight Flush',
  quads: 'Four of a Kind', fullHouse: 'Full House', flush: 'Flush', straight: 'Straight',
  trips: 'Three of a Kind', twoPair: 'Two Pair', jacks: 'Jacks or Better',
  kings: 'Kings or Better', pair: 'Pair', none: '—',
};
const RANK_ORDER = ['royal', 'wildRoyal', 'fourDeuces', 'five', 'straightFlush', 'quads',
  'fullHouse', 'flush', 'straight', 'trips', 'twoPair', 'jacks', 'kings', 'pair'];

function classify(cards) {
  const ev = evalPoker(cards);
  if (ev.groups[0].n === 5) return 'five';
  if (ev.rank === 9) return 'royal';
  if (ev.rank === 8) return 'straightFlush';
  if (ev.rank === 7) return 'quads';
  if (ev.rank === 6) return 'fullHouse';
  if (ev.rank === 5) return 'flush';
  if (ev.rank === 4) return 'straight';
  if (ev.rank === 3) return 'trips';
  if (ev.rank === 2) return 'twoPair';
  if (ev.rank === 1) return ev.groups[0].v >= 11 ? 'jacks' : 'pair';
  return 'none';
}
const ALL52 = (() => {
  const out = [];
  for (const suit of ['♠', '♥', '♦', '♣'])
    for (let r = 0; r < 13; r++) out.push({ r: RANKS[r], v: r + 1, suit, red: suit === '♥' || suit === '♦' });
  return out;
})();

/** Best paying category for a hand with wild cards, brute-forced over substitutions. */
function bestWild(cards, isWild, table) {
  const wilds = cards.filter(isWild), naturals = cards.filter((c) => !isWild(c));
  if (wilds.length === 0) return classify(cards);
  if (wilds.length >= 4) return table.fourDeuces != null ? 'fourDeuces' : 'five';

  let best = 'none', bestPay = -1;
  const combos = [];
  const build = (start, acc) => {
    if (acc.length === wilds.length) { combos.push(acc.slice()); return; }
    for (let i = start; i < ALL52.length; i++) { acc.push(ALL52[i]); build(i, acc); acc.pop(); }
  };
  build(0, []);
  for (const sub of combos) {
    let key = classify([...naturals, ...sub]);
    if (key === 'royal') key = 'wildRoyal';
    if (key === 'pair' || key === 'jacks' || key === 'kings') key = table.jacks != null ? 'jacks' : 'none';
    const pay = table[key] ?? -1;
    if (pay > bestPay) { bestPay = pay; best = key; }
  }
  return best;
}

const VP_GAMES = {
  'video-poker-jb': {
    name: 'Jacks or Better', icon: '🂡', rtp: 99.5, jokers: 0, wild: null,
    table: { royal: 800, straightFlush: 50, quads: 25, fullHouse: 9, flush: 6, straight: 4, trips: 3, twoPair: 2, jacks: 1 },
    note: 'The classic 9/6 pay schedule — the highest-returning machine on the floor when played perfectly.',
  },
  'video-poker-dw': {
    name: 'Deuces Wild', icon: '2️⃣', rtp: 98.9, jokers: 0, wild: (c) => c.v === 2,
    table: { royal: 800, fourDeuces: 200, wildRoyal: 25, five: 15, straightFlush: 9, quads: 5, fullHouse: 3, flush: 2, straight: 2, trips: 1 },
    note: 'All four 2s are wild. Three of a kind is the minimum paying hand.',
  },
  'video-poker-bonus': {
    name: 'Bonus Poker', icon: '🂡', rtp: 99.2, jokers: 0, wild: null,
    table: { royal: 800, straightFlush: 50, quads: 25, fullHouse: 8, flush: 5, straight: 4, trips: 3, twoPair: 2, jacks: 1 },
    note: 'Jacks or Better with a bigger bonus on four of a kind, paid for with a slightly flatter full house and flush.',
  },
  'video-poker-dbonus': {
    name: 'Double Bonus Poker', icon: '💠', rtp: 99.1, jokers: 0, wild: null,
    table: { royal: 800, straightFlush: 50, quads: 50, fullHouse: 9, flush: 7, straight: 5, trips: 3, twoPair: 1, jacks: 1 },
    note: 'Quads pay double — but two pair drops to even money, which makes it far swingier than Jacks or Better.',
  },
  'video-poker-aces-faces': {
    name: 'Aces & Faces', icon: '👑', rtp: 99.0, jokers: 0, wild: null,
    table: { royal: 800, straightFlush: 50, quads: 40, fullHouse: 8, flush: 5, straight: 4, trips: 3, twoPair: 2, jacks: 1 },
    note: 'Premium quads — aces and face cards — carry the paytable here.',
  },
  'video-poker-tens': {
    name: 'Tens or Better', icon: '🔟', rtp: 99.1, jokers: 0, wild: null,
    table: { royal: 800, straightFlush: 50, quads: 25, fullHouse: 6, flush: 5, straight: 4, trips: 3, twoPair: 2, jacks: 1 },
    note: 'A pair of tens already pays, so you hit far more often — funded by a shorter full house.',
  },
  'video-poker-joker': {
    name: 'Joker Poker', icon: '🃏', rtp: 98.4, jokers: 1, wild: (c) => !!c.joker,
    table: { royal: 800, five: 200, wildRoyal: 100, straightFlush: 50, quads: 20, fullHouse: 7, flush: 5, straight: 3, trips: 2, twoPair: 1, kings: 1 },
    note: 'A single joker is wild. Kings or better is the minimum paying hand.',
  },
};

function videoPoker(id) {
  const cfg = VP_GAMES[id];
  return function mount(root) {
    let shoe = [], cards = [], held = [false, false, false, false, false];
    let phase = 'bet', stake = 0;

    const handRow = el('div.vp-hand');
    const msg = msgLine();
    const payRows = el('div.paytable');
    const order = RANK_ORDER.filter((k) => cfg.table[k] != null);
    const rowEls = {};
    for (const k of order) {
      const r = el('div.pt', {}, el('span', { style: { fontSize: '13px' } }, ''),
        VP_KEYS[k], el('b', {}, cfg.table[k] + '×'));
      rowEls[k] = r; payRows.append(r);
    }

    const bp = betPanel({ start: 25, min: 1, max: 1000, action: 'DEAL', onAction: go });

    function paint() {
      handRow.replaceChildren(...cards.map((c, i) => {
        const wrap = el('div', { style: { position: 'relative' } });
        const node = cardEl(c, { sel: phase === 'draw' });
        if (held[i]) node.classList.add('held');
        if (phase === 'draw') {
          node.addEventListener('click', () => { held[i] = !held[i]; paint(); });
          if (held[i]) wrap.append(el('div.hold-tag', {}, 'HELD'));
        }
        wrap.append(node);
        return wrap;
      }));
    }
    function highlight(key) {
      for (const k of order) rowEls[k].style.background = '';
      if (rowEls[key]) rowEls[key].style.background = 'rgba(245,196,81,.22)';
    }

    function go() {
      if (phase === 'bet') {
        stake = bp.value;
        if (!bp.take()) return;
        shoe = newShoe(1, cfg.jokers);
        cards = [0, 0, 0, 0, 0].map(() => draw(shoe, 1, cfg.jokers));
        held = [false, false, false, false, false];
        phase = 'draw'; paint(); highlight(null);
        msg.set('Click cards to HOLD, then DRAW', 'push');
        bp.setAction('DRAW', 'btn-green'); bp.lock(); bp.actionBtn.disabled = false;
      } else {
        for (let i = 0; i < 5; i++) if (!held[i]) cards[i] = draw(shoe, 1, cfg.jokers);
        phase = 'bet'; paint();
        const key = cfg.wild ? bestWild(cards, cfg.wild, cfg.table) : (() => {
          let k = classify(cards);
          if (k === 'pair') k = cfg.table.kings != null ? 'none' : 'none';
          return k;
        })();
        const mult = cfg.table[key] ?? 0;
        highlight(mult ? key : null);
        const payout = round2(stake * mult);
        if (payout > 0) { wallet.pay(payout); msg.win(payout, VP_KEYS[key] + ' —', stake); }
        else msg.lose('No paying hand');
        wallet.logResult(id, stake, payout);
        bp.setAction('DEAL', 'btn-gold'); bp.unlock();
      }
    }

    cards = [null, null, null, null, null]; paint();
    root.append(handRow, msg.node, bp.node, payRows,
      rules(cfg.name.toUpperCase(),
        cfg.note,
        `Multipliers apply to your full bet. Deal, hold the cards you keep, then draw replacements once.`,
        `Theoretical return with optimal play <code>${cfg.rtp}%</code> — mistakes cost real percentage points.`,
        `${cfg.jokers ? '53-card deck with one joker.' : '52-card deck.'} Shuffled every hand.`));
  };
}

/* ============================================================ CASINO WAR */
function casinoWar(root) {
  const id = 'casino-war';
  let shoe = newShoe(6), busy = false, warPending = null;
  const dSeat = seat('Dealer'), pSeat = seat('You');
  const betSpot = spot('Bet');
  const table = feltTable({ tone: 36, shoe: true,
    print: ['Casino War', 'On a tie: surrender half or go to war - war wins pay 2 to 1'] });
  table.surface.append(dSeat, pSeat, el('div.felt-row', {}, betSpot));
  const msg = msgLine();
  const btnWar = el('button.btn.btn-red', { type: 'button', onclick: () => resolveWar(true) }, 'GO TO WAR (double)');
  const btnSurr = el('button.btn', { type: 'button', onclick: () => resolveWar(false) }, 'SURRENDER (half back)');
  const warRow = el('div.felt-actions', {}, btnWar, btnSurr);
  warRow.hidden = true;
  const bp = betPanel({ start: 25, min: 1, max: 2000, action: 'DEAL', onAction: play });
  const hv = (c) => (c.v === 1 ? 14 : c.v);

  function play() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); msg.clear();
    if (shoe.length < 20) shoe = newShoe(6);
    const p = draw(shoe, 6), d = draw(shoe, 6);
    layCards(pSeat.cards, [p]); layCards(dSeat.cards, [d]);
    pSeat.setBadge(p.r + p.suit); dSeat.setBadge(d.r + d.suit);
    betSpot.setStack(stake);

    if (hv(p) > hv(d)) { win(stake * 2, `${p.r} beats ${d.r}`, stake); }
    else if (hv(p) < hv(d)) { lose(`${d.r} beats ${p.r}`, stake); }
    else { warPending = stake; warRow.hidden = false; msg.set('WAR! Double your bet or surrender half.', 'push'); }
  }

  function resolveWar(goWar) {
    const stake = warPending; warRow.hidden = true;
    if (!goWar) { wallet.pay(stake / 2); msg.push(`Surrendered — ${fmt(stake / 2)} returned`); wallet.logResult(id, stake, stake / 2); return done(); }
    if (!wallet.bet(stake)) { warRow.hidden = false; return; }
    for (let i = 0; i < 3; i++) { draw(shoe, 6); draw(shoe, 6); }   // burn 3 each
    const p = draw(shoe, 6), d = draw(shoe, 6);
    layCards(pSeat.cards, [p]); layCards(dSeat.cards, [d]);
    pSeat.setBadge(p.r + p.suit); dSeat.setBadge(d.r + d.suit);
    const total = stake * 2;
    betSpot.setStack(total);
    if (hv(p) >= hv(d)) win(total * 2, hv(p) === hv(d) ? 'War tie — you win!' : `${p.r} beats ${d.r}`, total);
    else lose(`${d.r} beats ${p.r}`, total);
  }
  const win = (pay, why, staked) => { wallet.pay(pay); msg.win(pay - staked, why + ' ·', staked); wallet.logResult(id, staked, pay); done(); };
  const lose = (why, staked) => { msg.lose(why); wallet.logResult(id, staked, 0); done(); };
  const done = () => { busy = false; bp.unlock(); };

  root.append(table, warRow, msg.node, bp.node,
    rules('CASINO WAR',
      `Highest card wins — aces are high, suits are ignored. A win pays <code>1:1</code>.`,
      `On a tie you either <b>surrender</b> and get half your stake back, or <b>go to war</b>: match your bet, three cards are burned, and one more card is dealt each.`,
      `Winning the war pays <code>2:1</code> on the original bet; tying the war also wins.`,
      `6-deck shoe · house edge <code>2.9%</code> going to war.`));
}

/* ============================================================ THREE CARD POKER */
function rank3(cards) {
  const v = cards.map((c) => (c.v === 1 ? 14 : c.v)).sort((a, b) => b - a);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const straight = (v[0] - v[1] === 1 && v[1] - v[2] === 1) || (v[0] === 14 && v[1] === 3 && v[2] === 2);
  const trips = v[0] === v[1] && v[1] === v[2];
  const pair = v[0] === v[1] || v[1] === v[2];
  let r;
  if (straight && flush) r = 5; else if (trips) r = 4; else if (straight) r = 3;
  else if (flush) r = 2; else if (pair) r = 1; else r = 0;
  const names = ['High Card', 'Pair', 'Flush', 'Straight', 'Three of a Kind', 'Straight Flush'];
  const key = pair && !trips ? (v[0] === v[1] ? [v[0], v[2]] : [v[1], v[0]]) : v;
  return { r, name: names[r], key, high: v[0] };
}
function threeCard(root) {
  const id = 'three-card-poker';
  let shoe = newShoe(1), stake = 0, phase = 'bet', p = [], d = [];
  const dSeat = seat('Dealer'), pSeat = seat('Your hand');
  const anteSpot = spot('Ante'), playSpot = spot('Play');
  const table = feltTable({ tone: 164, shoe: true,
    print: ['Three Card Poker', 'Dealer qualifies with queen high or better'] });
  table.surface.append(dSeat, pSeat, el('div.felt-row', {}, anteSpot, playSpot));
  const msg = msgLine();
  const btnPlay = el('button.btn.btn-green', { type: 'button', onclick: () => decide(true) }, 'PLAY (match ante)');
  const btnFold = el('button.btn.btn-red', { type: 'button', onclick: () => decide(false) }, 'FOLD');
  const row = el('div.felt-actions', {}, btnPlay, btnFold);
  row.hidden = true;
  const bp = betPanel({ start: 25, min: 1, max: 1000, label: 'ANTE', action: 'DEAL', onAction: deal });
  const ANTE_BONUS = { 5: 5, 4: 4, 3: 1 };

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
    phase = 'decide'; row.hidden = false; bp.lock();
    msg.set('Play or fold?', 'push');
  }
  function decide(playOn) {
    row.hidden = true;
    const pr = rank3(p), dr = rank3(d);
    layCards(dSeat.cards, d); dSeat.setBadge(dr.name);
    if (playOn) playSpot.setStack(stake);
    let payout = 0, total = stake, note = '';
    const bonus = ANTE_BONUS[pr.r] ? stake * ANTE_BONUS[pr.r] : 0;

    if (!playOn) { note = 'Folded'; }
    else {
      if (!wallet.bet(stake)) { row.hidden = false; return; }
      total = stake * 2;
      const dq = dr.r > 0 || dr.high >= 12;
      if (!dq) { payout = stake * 2 + stake; note = 'Dealer does not qualify — ante pays 1:1, play returns'; }
      else {
        const cmp = pr.r - dr.r || cmpKey(pr.key, dr.key);
        if (cmp > 0) { payout = stake * 4; note = `${pr.name} beats ${dr.name}`; }
        else if (cmp === 0) { payout = stake * 2; note = 'Tie — both bets push'; }
        else { note = `${dr.name} beats ${pr.name}`; }
      }
    }
    payout += bonus;
    if (bonus) note += ` · Ante bonus ${ANTE_BONUS[pr.r]}:1 for ${pr.name}`;
    if (payout > 0) wallet.pay(payout);
    const net = payout - total;
    if (net > 0) msg.win(net, note + ' ·', total); else if (net === 0) msg.push(note); else msg.lose(note);
    wallet.logResult(id, total, payout);
    phase = 'bet'; bp.unlock();
  }
  const cmpKey = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

  root.append(table, row, msg.node, bp.node,
    rules('THREE CARD POKER',
      `Post an <b>ante</b>, see your three cards, then either match it as a <b>play</b> bet or fold and lose the ante.`,
      `Ranking (3 cards): <code>Straight Flush > Three of a Kind > Straight > Flush > Pair > High Card</code>.`,
      `Dealer qualifies with <b>Queen high or better</b>. If the dealer does not qualify, the ante pays 1:1 and the play bet pushes.`,
      `Ante bonus regardless of the dealer: straight <code>1:1</code>, trips <code>4:1</code>, straight flush <code>5:1</code>.`,
      `House edge on ante+play ≈ <code>3.4%</code>.`));
}

/* ============================================================ CARIBBEAN STUD */
function caribbeanStud(root) {
  const id = 'caribbean-stud';
  let shoe = [], stake = 0, phase = 'bet', p = [], d = [];
  const dSeat = seat('Dealer'), pSeat = seat('Your hand');
  const anteSpot = spot('Ante'), raiseSpot = spot('Raise');
  const table = feltTable({ tone: 190, shoe: true,
    print: ['Caribbean Stud Poker', 'Dealer qualifies with ace-king or better'] });
  table.surface.append(dSeat, pSeat, el('div.felt-row', {}, anteSpot, raiseSpot));
  const msg = msgLine();
  const btnRaise = el('button.btn.btn-green', { type: 'button', onclick: () => decide(true) }, 'RAISE (2× ante)');
  const btnFold = el('button.btn.btn-red', { type: 'button', onclick: () => decide(false) }, 'FOLD');
  const row = el('div.felt-actions', {}, btnRaise, btnFold);
  row.hidden = true;
  const bp = betPanel({ start: 25, min: 1, max: 1000, label: 'ANTE', action: 'DEAL', onAction: deal });
  const ODDS = [1, 1, 2, 3, 4, 5, 7, 20, 50, 100];   // by evalPoker rank

  function deal() {
    if (phase !== 'bet') return;
    stake = bp.value;
    if (!bp.take()) return;
    shoe = newShoe(1);
    p = Array.from({ length: 5 }, () => draw(shoe));
    d = Array.from({ length: 5 }, () => draw(shoe));
    layCards(pSeat.cards, p); pSeat.setBadge(evalPoker(p).name);
    layCards(dSeat.cards, [d[0], null, null, null, null]); dSeat.setBadge(`${d[0].r} up`);
    anteSpot.setStack(stake); raiseSpot.setStack(0);
    phase = 'decide'; row.hidden = false; bp.lock();
    msg.set('Dealer shows one card — raise or fold?', 'push');
  }
  function decide(raise) {
    row.hidden = true;
    const pe = evalPoker(p), de = evalPoker(d);
    layCards(dSeat.cards, d); dSeat.setBadge(de.name);
    if (raise) raiseSpot.setStack(stake * 2);
    let payout = 0, total = stake, note = '';
    if (!raise) note = 'Folded — ante lost';
    else {
      if (!wallet.bet(stake * 2)) { row.hidden = false; return; }
      total = stake * 3;
      const dq = de.rank >= 1 || (de.vals.includes(14) && de.vals.includes(13));
      if (!dq) { payout = stake * 2 + stake * 2; note = 'Dealer does not qualify — ante pays 1:1, raise returns'; }
      else {
        const c = cmpPoker(pe, de);
        if (c > 0) { payout = stake * 2 + stake * 2 * (1 + ODDS[pe.rank]); note = `${pe.name} beats ${de.name} — raise pays ${ODDS[pe.rank]}:1`; }
        else if (c === 0) { payout = total; note = 'Tie — all bets push'; }
        else note = `${de.name} beats ${pe.name}`;
      }
    }
    if (payout > 0) wallet.pay(payout);
    const net = payout - total;
    if (net > 0) msg.win(net, note + ' ·', total); else if (net === 0) msg.push(note); else msg.lose(note);
    wallet.logResult(id, total, payout);
    phase = 'bet'; bp.unlock();
  }
  root.append(table, row, msg.node, bp.node,
    rules('CARIBBEAN STUD POKER',
      `Ante, receive five cards and see one dealer card. Either <b>raise</b> for twice the ante or <b>fold</b>.`,
      `Dealer qualifies with <b>Ace-King or better</b>. If not, the ante pays 1:1 and the raise pushes.`,
      `Beating a qualified dealer pays the ante 1:1 and the raise on a ladder: pair <code>1:1</code> · two pair <code>2:1</code> · trips <code>3:1</code> · straight <code>4:1</code> · flush <code>5:1</code> · full house <code>7:1</code> · quads <code>20:1</code> · straight flush <code>50:1</code> · royal <code>100:1</code>.`,
      `House edge ≈ <code>5.2%</code> of the ante.`));
}

/* ============================================================ RED DOG */
function redDog(root) {
  const id = 'red-dog';
  let shoe = newShoe(8), busy = false;
  const spreadSeat = seat('The spread');
  const betSpot = spot('Bet');
  const table = feltTable({ tone: 14, shoe: true,
    print: ['Red Dog', 'Third card between the two - spread 1 pays 5 to 1'] });
  table.surface.append(spreadSeat, el('div.felt-row', {}, betSpot));
  const box = spreadSeat;
  const msg = msgLine();
  const bp = betPanel({ start: 25, min: 1, max: 2000, action: 'DEAL', onAction: play });
  const hv = (c) => (c.v === 1 ? 14 : c.v);
  const SPREAD_PAY = { 1: 5, 2: 4, 3: 2 };

  async function play() {
    if (busy) return;
    const stake = bp.value;
    if (!bp.take()) return;
    busy = true; bp.lock(); msg.clear();
    betSpot.setStack(stake);
    if (shoe.length < 20) shoe = newShoe(8);
    let a = draw(shoe, 8), b = draw(shoe, 8);
    layCards(spreadSeat.cards, [a, b, null]);
    await sleep(500);

    if (hv(a) > hv(b)) [a, b] = [b, a];
    let payout = 0, note = '';
    if (hv(a) === hv(b)) {
      const c = draw(shoe, 8);
      layCards(spreadSeat.cards, [a, b, c]);
      if (hv(c) === hv(a)) { payout = stake * 12; note = 'Three of a kind — pays 11:1'; }
      else { payout = stake; note = 'Pair, third card differs — push'; }
    } else {
      const spread = hv(b) - hv(a) - 1;
      spreadSeat.setBadge(`spread ${spread}`);
      if (spread === 0) { payout = stake; note = 'Consecutive cards — push'; layCards(spreadSeat.cards, [a, b]); }
      else {
        const c = draw(shoe, 8);
        layCards(spreadSeat.cards, [a, c, b]);
        const inside = hv(c) > hv(a) && hv(c) < hv(b);
        const mult = SPREAD_PAY[spread] || 1;
        if (inside) { payout = stake * (1 + mult); note = `${c.r} is inside — spread ${spread} pays ${mult}:1`; }
        else note = `${c.r} is outside the spread`;
      }
    }
    if (payout > 0) wallet.pay(payout);
    const net = payout - stake;
    if (net > 0) msg.win(net, note + ' ·', total); else if (net === 0) msg.push(note); else msg.lose(note);
    wallet.logResult(id, stake, payout);
    busy = false; bp.unlock();
  }
  root.append(table, msg.node, bp.node,
    rules('RED DOG (ACEY-DEUCEY)',
      `Two cards are dealt. You win if a third card falls <b>strictly between</b> them.`,
      `The payout depends on the gap: spread 1 pays <code>5:1</code>, spread 2 <code>4:1</code>, spread 3 <code>2:1</code>, spread 4+ <code>1:1</code>.`,
      `Consecutive cards push. A pair pushes unless the third card matches, which pays <code>11:1</code>.`,
      `Aces are high. 8-deck shoe · house edge <code>2.75%</code>.`));
}

/* ============================================================ HI-LO */
function hiLo(root) {
  const id = 'hi-lo';
  let shoe = newShoe(1), current = null, streak = 0, mult = 1, stake = 0, live = false;
  const cardSeat = seat('Current card');
  const betSpot = spot('Bet');
  const table = feltTable({ tone: 214, shoe: true,
    print: ['Hi-Lo', 'Ties win - cash out any time'] });
  table.surface.append(cardSeat, el('div.felt-row', {}, betSpot));
  const msg = msgLine();
  const info = el('div.readout');
  const btnHi = el('button.btn.btn-green', { type: 'button', onclick: () => guess('hi') }, '▲ HIGHER');
  const btnLo = el('button.btn.btn-red', { type: 'button', onclick: () => guess('lo') }, '▼ LOWER');
  const btnOut = el('button.btn.btn-gold', { type: 'button', onclick: cashOut }, 'CASH OUT');
  const row = el('div.felt-actions', {}, btnLo, btnHi, btnOut);
  row.hidden = true;
  const bp = betPanel({ start: 25, min: 1, max: 2000, action: 'START', onAction: start });
  const hv = (c) => (c.v === 1 ? 14 : c.v);

  function odds(kind) {
    const v = hv(current);
    // remaining ranks in a fresh 52 deck, ties count as a win for the player side chosen
    const higher = (14 - v) * 4, lower = (v - 2) * 4, same = 3;
    const total = 51;
    const p = kind === 'hi' ? (higher + same) / total : (lower + same) / total;
    return Math.max(1.02, (0.97 / p));
  }
  function refresh() {
    layCards(cardSeat.cards, [current]);
    cardSeat.setBadge(current.r + current.suit);
    betSpot.setStack(round2(stake * mult));
    btnHi.textContent = `▲ HIGHER ${odds('hi').toFixed(2)}×`;
    btnLo.textContent = `▼ LOWER ${odds('lo').toFixed(2)}×`;
    btnOut.textContent = `CASH OUT ${fmt(stake * mult)}`;
    info.textContent = `streak ${streak} · multiplier ${mult.toFixed(2)}×`;
  }
  function start() {
    if (live) return;
    stake = bp.value;
    if (!bp.take()) return;
    shoe = newShoe(1); current = draw(shoe); streak = 0; mult = 1; live = true;
    row.hidden = false; bp.lock(); msg.set('Higher or lower?', 'push'); refresh();
  }
  function guess(kind) {
    const step = odds(kind);
    const next = draw(shoe);
    if (!shoe.length) shoe = newShoe(1);
    const ok = kind === 'hi' ? hv(next) >= hv(current) : hv(next) <= hv(current);
    current = next;
    if (ok) {
      streak++; mult *= step; refresh();
      msg.set(`${next.r}${next.suit} — correct! ${mult.toFixed(2)}× banked`, 'win');
    } else {
      layCards(cardSeat.cards, [next]); cardSeat.setBadge(next.r + next.suit, 'bust');
      betSpot.setStack(0);
      msg.lose(`${next.r}${next.suit} — busted after ${streak}`);
      wallet.logResult(id, stake, 0);
      end();
    }
  }
  function cashOut() {
    const payout = round2(stake * mult);
    wallet.pay(payout);
    msg.win(payout - stake, `Cashed out at ${mult.toFixed(2)}× ·`, stake);
    wallet.logResult(id, stake, payout);
    end();
  }
  const end = () => { live = false; row.hidden = true; bp.unlock(); };

  root.append(table, row, info, msg.node, bp.node,
    rules('HI-LO',
      `Guess whether the next card is higher or lower. <b>Ties count as a win</b> for whichever side you picked.`,
      `Each correct call multiplies your stake by the true odds of that call, less a small margin — safe guesses pay less.`,
      `Cash out any time to bank the multiplier. One wrong call loses the whole stake.`,
      `Fresh 52-card deck each round · house edge <code>3%</code> per step.`));
}

/* ============================================================ exports */
export const cardGames = [
  G({ id: 'blackjack', name: 'Blackjack Classic', cat: 'table', icon: '🂡', art: 'linear-gradient(160deg,#0f3d2a,#0b0d1c)', rtp: 99.6, vol: 'Low', tags: ['hot'], mount: blackjack({ decks: 6, name: 'Blackjack Classic', id: 'blackjack' }) }),
  G({ id: 'blackjack-dd', name: 'Double Deck Blackjack', cat: 'table', icon: '🂱', art: 'linear-gradient(160deg,#123a4d,#0b0d1c)', rtp: 99.4, vol: 'Low', mount: blackjack({ decks: 2, name: 'Double Deck Blackjack', id: 'blackjack-dd', h17: true }) }),
  G({ id: 'baccarat', name: 'Baccarat', cat: 'table', icon: '🎴', art: 'linear-gradient(160deg,#3d1220,#0b0d1c)', rtp: 98.9, vol: 'Low', tags: ['hot'], mount: baccarat({ id: 'baccarat' }) }),
  G({ id: 'baccarat-nc', name: 'No Commission Baccarat', cat: 'table', icon: '🎴', art: 'linear-gradient(160deg,#4d1a2c,#0b0d1c)', rtp: 98.5, vol: 'Low', mount: baccarat({ id: 'baccarat-nc', noComm: true }) }),
  G({ id: 'blackjack-single', name: 'Single Deck Blackjack', cat: 'table', icon: '🂫', art: 'linear-gradient(160deg,#123d2a,#0b0d1c)', rtp: 99.8, vol: 'Low', tags: ['hot'], mount: blackjack({ decks: 1, name: 'Single Deck Blackjack', id: 'blackjack-single' }) }),
  G({ id: 'blackjack-vegas', name: 'Vegas Downtown Blackjack', cat: 'table', icon: '🂭', art: 'linear-gradient(160deg,#2a2d52,#0b0d1c)', rtp: 99.3, vol: 'Low', mount: blackjack({ decks: 8, name: 'Vegas Downtown Blackjack', id: 'blackjack-vegas', h17: true }) }),
  G({ id: 'video-poker-jb', name: 'Jacks or Better', cat: 'poker', icon: '🂡', art: 'linear-gradient(160deg,#1d2a52,#0b0d1c)', rtp: 99.5, vol: 'Medium', mount: videoPoker('video-poker-jb') }),
  G({ id: 'video-poker-dw', name: 'Deuces Wild Poker', cat: 'poker', icon: '2️⃣', art: 'linear-gradient(160deg,#2a1d52,#0b0d1c)', rtp: 98.9, vol: 'High', mount: videoPoker('video-poker-dw') }),
  G({ id: 'video-poker-bonus', name: 'Bonus Poker', cat: 'poker', icon: '🂡', art: 'linear-gradient(160deg,#1d3352,#0b0d1c)', rtp: 99.2, vol: 'Medium', mount: videoPoker('video-poker-bonus') }),
  G({ id: 'video-poker-dbonus', name: 'Double Bonus Poker', cat: 'poker', icon: '💠', art: 'linear-gradient(160deg,#1d2a6b,#0b0d1c)', rtp: 99.1, vol: 'High', mount: videoPoker('video-poker-dbonus') }),
  G({ id: 'video-poker-aces-faces', name: 'Aces & Faces', cat: 'poker', icon: '👑', art: 'linear-gradient(160deg,#4d3312,#0b0d1c)', rtp: 99.0, vol: 'Medium', tags: ['new'], mount: videoPoker('video-poker-aces-faces') }),
  G({ id: 'video-poker-tens', name: 'Tens or Better', cat: 'poker', icon: '🔟', art: 'linear-gradient(160deg,#123d3d,#0b0d1c)', rtp: 99.1, vol: 'Low', mount: videoPoker('video-poker-tens') }),
  G({ id: 'video-poker-joker', name: 'Joker Poker', cat: 'poker', icon: '🃏', art: 'linear-gradient(160deg,#4d1236,#0b0d1c)', rtp: 98.4, vol: 'High', mount: videoPoker('video-poker-joker') }),
  G({ id: 'casino-war', name: 'Casino War', cat: 'table', icon: '⚔️', art: 'linear-gradient(160deg,#3d2412,#0b0d1c)', rtp: 97.1, vol: 'Low', mount: casinoWar }),
  G({ id: 'three-card-poker', name: 'Three Card Poker', cat: 'poker', icon: '🃏', art: 'linear-gradient(160deg,#123d33,#0b0d1c)', rtp: 96.6, vol: 'Medium', mount: threeCard }),
  G({ id: 'caribbean-stud', name: 'Caribbean Stud', cat: 'poker', icon: '🏝️', art: 'linear-gradient(160deg,#0f3550,#0b0d1c)', rtp: 94.8, vol: 'High', mount: caribbeanStud }),
  G({ id: 'red-dog', name: 'Red Dog', cat: 'table', icon: '🐕', art: 'linear-gradient(160deg,#4d1a12,#0b0d1c)', rtp: 97.3, vol: 'Medium', mount: redDog }),
  G({ id: 'hi-lo', name: 'Hi-Lo', cat: 'instant', icon: '🔼', art: 'linear-gradient(160deg,#2a1d52,#0b0d1c)', rtp: 97.0, vol: 'Medium', tags: ['new'], mount: hiLo }),
];
