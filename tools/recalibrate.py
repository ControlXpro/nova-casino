"""One-shot recalibration of the eight instant engines that tools/rtp200.mjs
measured off their stated return. Kept in the repo so the reasoning behind
each new number is recoverable rather than appearing as a bare diff."""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
A = ROOT / "js/games/engines-a.js"
B = ROOT / "js/games/engines-b.js"
a = A.read_text(encoding="utf-8")
b = B.read_text(encoding="utf-8")


def sub(text, old, new, tag):
    assert text.count(old) == 1, f"{tag}: matched {text.count(old)}"
    return text.replace(old, new)


# ── PICKS: measured 116.6% — prizes too fat for a 2-in-9 bust rate ──
a = sub(a,
    "  const VALUES = [0.4, 0.6, 0.8, 1.0, 1.4, 2.0, 3.5];   // seven prizes, calibrated below",
    "  const VALUES = [0.3, 0.5, 0.7, 0.85, 1.15, 1.7, 2.9];   // calibrated by tools/rtp200.mjs",
    "picks values")

# ── MATCH3: measured 761%. Paying on any three cells anywhere is far too
#    loose across nine draws — score lines instead, the way a real grid does.
a = sub(a, """  const SYMS = [
    { s: '◆', w: 34, pay: 2 }, { s: '●', w: 26, pay: 4 }, { s: '▲', w: 18, pay: 8 },
    { s: '★', w: 12, pay: 18 }, { s: '⬢', w: 7, pay: 45 }, { s: t.emblem, w: 3, pay: 160 },
  ];""",
"""  const SYMS = [
    { s: '◆', w: 34, pay: 0 }, { s: '●', w: 26, pay: 2 }, { s: '▲', w: 18, pay: 5.5 },
    { s: '★', w: 12, pay: 16 }, { s: '⬢', w: 7, pay: 54 }, { s: t.emblem, w: 3, pay: 270 },
  ];
  /* Eight scoring lines - three rows, three columns, two diagonals. Paying on
     any three cells anywhere returned 760%, because nine independent draws
     throw up a triple far more often than intuition suggests. */
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6],
    [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];""", "match3 syms")

a = sub(a, """    const counts = new Map();
    drawn.forEach((d, i) => { const a = counts.get(d.s) || []; a.push(i); counts.set(d.s, a); });
    let payout = 0, best = null;
    for (const [sym, idx] of counts) {
      if (idx.length < 3) continue;
      const def = SYMS.find((s) => s.s === sym);
      const sets = Math.floor(idx.length / 3);
      payout += stake * def.pay * sets;
      idx.slice(0, sets * 3).forEach((i) => cells[i].classList.add('hit'));
      if (!best || def.pay > best.pay) best = def;
    }
    payout = round2(payout);""",
"""    let payout = 0, best = null;
    for (const line of LINES) {
      const [x, y, z] = line;
      if (drawn[x].s !== drawn[y].s || drawn[y].s !== drawn[z].s) continue;
      const def = drawn[x];
      if (def.pay === 0) continue;
      payout += stake * def.pay;
      line.forEach((i) => cells[i].classList.add('hit'));
      if (!best || def.pay > best.pay) best = def;
    }
    payout = round2(payout);""", "match3 scoring")

a = sub(a, """      `Nine cells are drawn independently. Any <b>three matching symbols</b> pays — position does not matter.`,
      `Six of a kind pays the three-of-a-kind prize <b>twice</b>.`,
      `Rarer symbols pay more: <code>${SYMS[0].s} ${SYMS[0].pay}×</code> up to <code>${SYMS[5].s} ${SYMS[5].pay}×</code>.`,""",
"""      `Nine cells are drawn independently. Three matching symbols on any of the <b>eight lines</b> — three rows, three columns, two diagonals — pays.`,
      `Every line is scored, so one grid can pay more than once.`,
      `The common <code>${SYMS[0].s}</code> does not pay; the rest run <code>${SYMS[1].s} ${SYMS[1].pay}×</code> up to <code>${SYMS[5].s} ${SYMS[5].pay}×</code>.`,""",
    "match3 rules")

# ── SPOTS: measured 108.4%. Recomputed from the exact hypergeometric so every
#    pick count lands on the same return.
a = sub(a, """  const TABLE = {
    1: [0, 2.9],
    2: [0, 0, 8.5],
    3: [0, 0, 2.2, 24],
    4: [0, 0, 1.1, 7, 60],
    5: [0, 0, 0, 3.4, 22, 190],
    6: [0, 0, 0, 1.9, 9.5, 70, 600],
  };""",
"""  const TABLE = {
    1: [0, 3.0],
    2: [0, 0, 10.3],
    3: [0, 0, 2.0, 22.5],
    4: [0, 0, 0, 8, 66],
    5: [0, 0, 0, 2.8, 18, 155],
    6: [0, 0, 0, 0, 9.5, 64, 760],
  };""", "spots table")

# ── PUMP: measured 106.9%. A flat 1.18x step cannot track a burst risk that
#    climbs every pump - price each pump off its own risk instead.
a = sub(a,
    "  const STEP = 1.18;\n  const base = 0.05, ramp = 0.022;         // burst chance = base + ramp * pumps",
    "  const base = 0.05, ramp = 0.022;         // burst chance = base + ramp * pumps",
    "pump const")
a = sub(a, "    mult = round2(mult * STEP);\n    cur.set(mult.toFixed(2) + '×');",
"""    /* Price the pump off the risk that was just survived, so the ladder is
       fair at every depth rather than only in the middle. */
    mult = round2(mult / (1 - burstChance(n - 1)));
    cur.set(mult.toFixed(2) + '×');""", "pump step")
a = sub(a,
    "      `Every pump multiplies your stake by <code>${STEP}×</code> — but the ${NOUN.toLowerCase()} gets more fragile as it grows.`,",
    "      `Every pump multiplies your stake by exactly the inverse of the risk you just survived, so early pumps add a little and late ones add a lot.`,",
    "pump rules")

# ── BURST: measured 252%. Fewer live targets, and the paytable starts at two
#    hits so a single hit is no longer a sub-stake "win".
b = sub(b, "  const TOTAL = 12, LIVE = 5, PICKS = 4;",
        "  const TOTAL = 12, LIVE = 4, PICKS = 4;", "burst counts")
b = sub(b, "  const PAY = [0, 0.6, 2.1, 7.5, 34];",
        "  const PAY = [0, 0, 1.5, 5.8, 38];", "burst pay")
b = sub(b, """      `Pays on how many of your picks were live: <code>1 → ${PAY[1]}×</code>, <code>2 → ${PAY[2]}×</code>, <code>3 → ${PAY[3]}×</code>, <code>4 → ${PAY[4]}×</code>.`,
      `Note that one hit returns <b>less than your stake</b> — it is a partial refund, and the game says so rather than calling it a win.`,""",
"""      `Pays from two hits up: <code>2 → ${PAY[2]}×</code>, <code>3 → ${PAY[3]}×</code>, <code>4 → ${PAY[4]}×</code>. One hit pays nothing.`,
      `Two hits comes up about a third of the time; all four about once in 500 rounds.`,""",
    "burst rules")

# ── DRAW: measured 211%. Tiers rebuilt against their own printed odds.
b = sub(b, """    { name: 'Common', w: 620, pay: 0, tone: 'c' },
    { name: 'Uncommon', w: 240, pay: 1.6, tone: 'u' },
    { name: 'Rare', w: 100, pay: 4, tone: 'r' },
    { name: 'Epic', w: 33, pay: 15, tone: 'e' },
    { name: 'Legendary', w: 6, pay: 70, tone: 'l' },
    { name: 'Mythic', w: 1, pay: 400, tone: 'm' },""",
"""    { name: 'Common', w: 620, pay: 0, tone: 'c' },
    { name: 'Uncommon', w: 240, pay: 0, tone: 'u' },
    { name: 'Rare', w: 100, pay: 2.2, tone: 'r' },
    { name: 'Epic', w: 33, pay: 8, tone: 'e' },
    { name: 'Legendary', w: 6, pay: 38, tone: 'l' },
    { name: 'Mythic', w: 1, pay: 250, tone: 'm' },""", "draw tiers")
b = sub(b,
    "      `<b>${(TIERS[0].w / TOTAL * 100).toFixed(1)}%</b> of draws are Common and pay nothing; Mythic comes up once in <code>${TOTAL}</code> draws and pays <code>${TIERS[5].pay}×</code>.`,",
    "      `Common and Uncommon pay nothing and are <b>${((TIERS[0].w + TIERS[1].w) / TOTAL * 100).toFixed(0)}%</b> of draws between them; Mythic comes up once in <code>${TOTAL}</code> and pays <code>${TIERS[5].pay}×</code>.`,",
    "draw rules")

# ── WHEELX: measured 115.5%. Each profile now sums to the same 11.7.
b = sub(b, """    low:  { label: 'LOW', segs: [1.2, 1.5, 1.2, 0, 1.5, 1.2, 2, 1.2, 0, 1.5, 1.2, 2] },
    med:  { label: 'MEDIUM', segs: [0, 1.5, 0, 3, 1.5, 0, 2, 1.5, 0, 5, 1.5, 0] },
    high: { label: 'HIGH', segs: [0, 0, 0, 0, 9.5, 0, 0, 0, 0, 0, 2, 0] },""",
"""    /* Every profile sums to 11.7 across twelve segments, so all three return
       the same amount and only the shape of the ride differs. */
    low:  { label: 'LOW', segs: [1.2, 1.2, 0, 1.2, 1.2, 2.1, 1.2, 0, 1.2, 1.2, 0, 1.2] },
    med:  { label: 'MEDIUM', segs: [0, 1.5, 0, 2.2, 1.5, 0, 1.8, 0, 0, 3.2, 1.5, 0] },
    high: { label: 'HIGH', segs: [0, 0, 0, 0, 9.7, 0, 0, 0, 0, 0, 2, 0] },""", "wheelx segs")
b = sub(b,
    "      `<b>Low</b> hits something on ten of twelve spins but tops out at <code>2×</code>. <b>High</b> is blank eleven times in twelve and pays <code>9.5×</code>.`,",
    "      `<b>Low</b> hits something on nine of twelve spins but tops out at <code>2.1×</code>. <b>High</b> is blank ten times in twelve and pays <code>9.7×</code>.`,",
    "wheelx rules")

# ── TRAIL: measured 170%. Board values scaled to the measured overshoot.
b = sub(b, """  const TILE = ['x1.5', 'x0', 'x2', 'x0', 'x1.2', 'BUST', 'x3', 'x0',
    'x1.5', 'BUST', 'x2.5', 'x0', 'x4', 'x0', 'BUST', 'x8'];""",
"""  const TILE = ['x1', 'x0', 'x1.2', 'x0', 'x0.8', 'BUST', 'x1.5', 'x0',
    'x1', 'BUST', 'x1.3', 'x0', 'x2', 'x0', 'BUST', 'x4.6'];""", "trail tiles")

A.write_text(a, encoding="utf-8")
B.write_text(b, encoding="utf-8")
print("engines recalibrated")
