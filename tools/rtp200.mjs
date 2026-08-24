/* Monte-Carlo the twenty instant engines so the RTP each one advertises is the
   RTP its maths actually pays.

   The engines live in the DOM, so rather than import them this file restates
   each payout rule as a pure function. That is a real duplication risk, so the
   constants are copied verbatim from the engine source and any change there
   must be mirrored here — the drift column is what catches it if it is not.

   Run: node tools/rtp200.mjs [rounds]
*/
const N = Number(process.argv[2]) || 400_000;
const EDGE = 0.99;
const r = () => Math.random();
const ri = (n) => Math.floor(Math.random() * n);
const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const fair = (odds) => round2(EDGE * odds);

function distinct(n, k) {
  const a = [...Array(n).keys()];
  for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return new Set(a.slice(0, k));
}
function shuf(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* Each entry returns the amount returned for a 1-unit stake. Players are
   modelled as making the choices the game is designed around — a bot that
   never cashes out would understate the return of every ladder game. */
const ENGINES = {
  /* 1. AIM — half the shots taken on placement, half on power */
  aim() {
    const power = r() < 0.5;
    const covers = power ? 1 : 2, acc = power ? 0.7 : 1;
    const p = (6 - covers) / 6 * acc;
    const zone = ri(6), blocked = distinct(6, covers);
    const wide = r() >= acc;
    return (!wide && !blocked.has(zone)) ? fair(1 / p) : 0;
  },

  /* 2. PICKS — open until a target count, then bank */
  picks() {
    const VALUES = [0.3, 0.5, 0.7, 0.85, 1.15, 1.7, 2.9];
    const layout = shuf([...VALUES, null, null]);
    const target = 2 + ri(6);            // players stop somewhere between 2 and 7
    let banked = 0;
    for (let i = 0; i < target; i++) {
      const v = layout[i];
      if (v == null) return 0;
      banked = round2(banked + v);
    }
    return banked;
  },

  /* 3. PATH — advance to a randomly chosen depth then cash */
  path() {
    const P = 0.75, STEPS = 12;
    const MULTS = Array.from({ length: STEPS }, (_, i) => round2(EDGE * Math.pow(1 / P, i + 1)));
    const target = 1 + ri(STEPS);
    for (let i = 0; i < target; i++) if (r() >= P) return 0;
    return MULTS[target - 1];
  },

  /* 4. PUMP — escalating burst risk */
  pump() {
    const base = 0.05, ramp = 0.022;
    const q = (k) => Math.min(0.9, base + ramp * k);
    const target = 1 + ri(14);
    let mult = 1;
    for (let k = 0; k < target; k++) {
      if (r() < q(k)) return 0;
      mult = round2(mult / (1 - q(k)));
    }
    return round2(mult * EDGE);
  },

  /* 5. RACE */
  race() {
    const W = [30, 24, 18, 13, 9, 6];
    const pick = ri(6);
    let x = ri(100), win = 5;
    for (let i = 0; i < W.length; i++) { x -= W[i]; if (x < 0) { win = i; break; } }
    return pick === win ? fair(100 / W[win]) : 0;
  },

  /* 6. DUEL — half straight calls, half decisive */
  duel() {
    const dec = r() < 0.5;
    const side = ri(2), winner = ri(2), decisive = r() < 0.45;
    const won = side === winner && (!dec || decisive);
    return won ? (dec ? fair(1 / (0.5 * 0.45)) : fair(2)) : 0;
  },

  /* 7. SHUFFLE — 3, 4 or 5 containers */
  shuffle() {
    const n = 3 + ri(3);
    return ri(n) === ri(n) ? fair(n) : 0;
  },

  /* 8. MATCH3 */
  match3() {
    const S = [
      { s: 'a', w: 34, pay: 0 }, { s: 'b', w: 26, pay: 2 }, { s: 'c', w: 18, pay: 5.5 },
      { s: 'd', w: 12, pay: 16 }, { s: 'e', w: 7, pay: 54 }, { s: 'f', w: 3, pay: 270 },
    ];
    const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6],
      [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    const T = S.reduce((a, x) => a + x.w, 0);
    const roll = () => { let x = ri(T); for (const s of S) { x -= s.w; if (x < 0) return s; } return S[0]; };
    const drawn = Array.from({ length: 9 }, roll);
    let pay = 0;
    for (const [x, y, z] of LINES) {
      if (drawn[x].s === drawn[y].s && drawn[y].s === drawn[z].s) pay += drawn[x].pay;
    }
    return round2(pay);
  },

  /* 9. WIRES */
  wires() {
    const R = [5, 4, 3, 2];
    const M = R.map((_, i) => round2(EDGE * R.slice(0, i + 1).reduce((a, n) => a * (n / (n - 1)), 1)));
    const target = 1 + ri(4);
    for (let i = 0; i < target; i++) if (ri(R[i]) === ri(R[i])) return 0;
    return M[target - 1];
  },

  /* 10. SPOTS */
  spots() {
    const TABLE = {
      1: [0, 3.0], 2: [0, 0, 10.3], 3: [0, 0, 2.0, 22.5], 4: [0, 0, 0, 8, 66],
      5: [0, 0, 0, 2.8, 18, 155], 6: [0, 0, 0, 0, 9.5, 64, 760],
    };
    const k = 1 + ri(6);
    const mine = distinct(25, k), drawn = distinct(25, 8);
    let hits = 0;
    for (const m of mine) if (drawn.has(m)) hits++;
    return round2(TABLE[k][hits] || 0);
  },

  /* 11. STREAK */
  streak() {
    const F = 13;
    const target = 1 + ri(5);
    let cur = 1 + ri(F), mult = 1;
    for (let i = 0; i < target; i++) {
      let up = r() < 0.5;
      if (cur === F) up = false;          // "higher" is disabled at the top
      if (cur === 1) up = true;           // "lower" is disabled at the bottom
      const p = up ? (F - cur) / F : (cur - 1) / F;
      const next = 1 + ri(F);
      const won = up ? next > cur : next < cur;
      cur = next;
      if (!won) return 0;
      mult = round2(mult * (1 / p));
    }
    return round2(mult * EDGE);
  },

  /* 12. WHEELX */
  wheelx() {
    const P = [
      [1.2, 1.2, 0, 1.2, 1.2, 2.1, 1.2, 0, 1.2, 1.2, 0, 1.2],
      [0, 1.5, 0, 2.2, 1.5, 0, 1.8, 0, 0, 3.2, 1.5, 0],
      [0, 0, 0, 0, 9.7, 0, 0, 0, 0, 0, 2, 0],
    ][ri(3)];
    return round2(P[ri(P.length)] * EDGE);
  },

  /* 13. DIG */
  dig() {
    const SIZE = 25;
    const hazards = [3, 5, 8, 12][ri(4)];
    const mines = distinct(SIZE, hazards);
    const order = shuf([...Array(SIZE).keys()]);
    const target = 1 + ri(Math.min(10, SIZE - hazards));
    for (let i = 0; i < target; i++) if (mines.has(order[i])) return 0;
    const safe = SIZE - hazards;
    let inv = 1;
    for (let i = 0; i < target; i++) inv *= (safe - i) / (SIZE - i);
    return round2(EDGE / inv);
  },

  /* 14. LADDER */
  ladder() {
    const RUNGS = 8;
    const P = Array.from({ length: RUNGS }, (_, i) => 0.9 - i * 0.06);
    const M = P.reduce((acc, _, i) => {
      acc.push(round2(EDGE / P.slice(0, i + 1).reduce((a, b) => a * b, 1)));
      return acc;
    }, []);
    const target = 1 + ri(RUNGS);
    for (let i = 0; i < target; i++) if (r() >= P[i]) return 0;
    return M[target - 1];
  },

  /* 15. CATCH */
  catch() {
    const C = 4, open = 1 + ri(3);
    const chosen = distinct(C, open);
    return chosen.has(ri(C)) ? fair(C / open) : 0;
  },

  /* 16. SAFE */
  safe() {
    const D = 4, RANGE = 4;
    const M = Array.from({ length: D }, (_, i) => round2(EDGE * Math.pow(RANGE, i + 1)));
    const target = 1 + ri(D);
    for (let i = 0; i < target; i++) if (ri(RANGE) !== ri(RANGE)) return 0;
    return M[target - 1];
  },

  /* 17. BURST */
  burst() {
    const TOTAL = 12, LIVE = 4, PICKS = 4;
    const PAY = [0, 0, 1.5, 5.8, 38];
    const live = distinct(TOTAL, LIVE), mine = distinct(TOTAL, PICKS);
    let hits = 0;
    for (const m of mine) if (live.has(m)) hits++;
    return round2(PAY[hits]);
  },

  /* 18. DRAW */
  draw() {
    const T = [[620, 0], [240, 0], [100, 2.2], [33, 8], [6, 38], [1, 250]];
    const total = T.reduce((a, x) => a + x[0], 0);
    let x = ri(total);
    for (const [w, pay] of T) { x -= w; if (x < 0) return round2(pay); }
    return 0;
  },

  /* 19. TRAIL */
  trail() {
    const TILE = [0.95, 0, 1.15, 0, 0.8, -1, 1.4, 0, 0.95, -1, 1.25, 0, 2.1, -1, 0, 4.5];
    const stopAfter = 1 + ri(6);
    let at = -1, banked = 0, rolls = 0;
    while (true) {
      at += 1 + ri(3);
      rolls++;
      if (at >= TILE.length) break;
      if (TILE[at] === -1) return 0;
      banked = round2(banked + TILE[at]);
      if (rolls >= stopAfter) break;
    }
    return round2(banked * EDGE);
  },

  /* 20. FUSE */
  fuse() {
    const end = r() < 0.01 ? 1 : Math.max(1, Math.floor(100 * EDGE / (1 - r())) / 100);
    const target = 1.1 + r() * 3;      // players aim somewhere between 1.1x and 4.1x
    return end > target ? round2(target) : 0;
  },
};

/* Stated returns, copied from js/games/instant200.js */
const STATED = {
  aim: 99.0, picks: 97.0, path: 99.0, pump: 99.0, race: 99.0, duel: 99.0,
  shuffle: 99.0, match3: 95.5, wires: 99.0, spots: 96.0,
  streak: 99.0, wheelx: 96.8, dig: 99.0, ladder: 99.0, catch: 99.0,
  safe: 99.0, burst: 96.0, draw: 96.2, trail: 95.0, fuse: 98.0,
};

console.log(`${N.toLocaleString()} rounds per engine\n`);
let worst = 0;
for (const [name, fn] of Object.entries(ENGINES)) {
  let ret = 0, best = 0;
  for (let i = 0; i < N; i++) { const x = fn(); ret += x; if (x > best) best = x; }
  const rtp = ret / N * 100;
  const drift = rtp - STATED[name];
  if (Math.abs(drift) > Math.abs(worst)) worst = drift;
  console.log(
    `${name.padEnd(8)} stated ${STATED[name].toFixed(1).padStart(5)}%  ` +
    `measured ${rtp.toFixed(2).padStart(6)}%  ` +
    `drift ${(drift >= 0 ? '+' : '') + drift.toFixed(2)}%  best ${best.toFixed(0)}x`);
}
console.log(`\nlargest drift ${worst.toFixed(2)}%`);
