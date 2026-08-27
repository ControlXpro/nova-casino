/* Data-driven 5x3 / 20-line slot engine + 28 themed titles.
   Every title runs one of three shared math models, exactly like a real studio
   ships many skins over a handful of maths. */
import { el, clear, fmt, rnd, rndInt, weighted, sleep, wallet, toast } from '../core.js';
import { betPanel, msgLine, rules } from '../ui.js';
import { play, ticker } from '../sound.js';

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

  /* ── second wave ── */
  T('thunder-of-zeus', 'Thunder of Zeus', 'high', '#1b2440', ['⚡', '🏛️', '🦅', '🏺', '👑', '🧔'], '🌩️', '🔯', ['hot']),
  T('legion-of-rome', 'Legion of Rome', 'med', '#33210f', ['🛡️', '⚔️', '🏹', '🐎', '🏛️', '👔'], '🦅', '📜'),
  T('jungle-jackpot', 'Jungle Jackpot', 'med', '#12301c', ['🌴', '🐒', '🐍', '🐸', '🦜', '🐅'], '🌿', '🗿'),
  T('candy-rush', 'Candy Rush', 'low', '#3a1436', ['🍬', '🍭', '🧁', '🎂', '🍫', '🍓'], '🌟', '🍯'),
  T('vampire-manor', 'Vampire Manor', 'high', '#25101c', ['🦇', '⚰️', '🕯️', '🕸️', '🏰', '🧛'], '🌘', '🧄'),
  T('steampunk-cogs', 'Steampunk Cogs', 'med', '#2e2214', ['⚙️', '🔧', '🕰️', '🎩', '🛢️', '🧭'], '🔩', '🎭'),
  T('sakura-wind', 'Sakura Wind', 'low', '#2e1524', ['🌸', '🏮', '🍵', '🪭', '🏯', '🎎'], '⛩️', '🎴'),
  T('cyber-neon', 'Cyber Neon', 'high', '#141a3a', ['💾', '🕹️', '🔌', '📱', '🤖', '🕶️'], '⚡', '💽', ['new']),
  T('stampede-gold', 'Stampede Gold', 'med', '#33280f', ['🐂', '🐎', '🦓', '🦌', '🌵', '🌄'], '🦬', '💰'),
  T('deep-space', 'Deep Space Odyssey', 'high', '#0f1430', ['🛸', '🌌', '☄️', '🔭', '👽', '🪐'], '🌟', '🛰️'),
  T('rainbow-gold', 'Rainbow Gold', 'low', '#123024', ['🍀', '🎩', '🪙', '🔔', '🌈', '🧝'], '✨', '🪴'),
  T('cirque-fortune', 'Cirque Fortune', 'med', '#301238', ['🎪', '🤹', '🤡', '🎫', '🐘', '🎠'], '🌟', '🎹'),
  T('wild-panda', 'Wild Panda', 'low', '#1c2a1c', ['🎋', '🐼', '🍃', '🏮', '🏔️', '🐉'], '☯️', '🧧'),
  T('atlantis-deep', 'Atlantis Deep', 'high', '#0d2740', ['🐚', '🐠', '🐙', '🏺', '⚓', '🔱'], '🌊', '💎'),
  T('mummy-curse', 'Mummy Curse', 'high', '#2b2410', ['🪲', '🏺', '🗿', '🕯️', '💀', '🧟'], '🔺', '📖'),
  T('sherwood-gold', 'Sherwood Gold', 'med', '#16301a', ['🏹', '🎯', '🌳', '🏰', '👑', '🧑'], '🪶', '💰'),
  T('genie-lamp', 'Genie Lamp', 'high', '#2c1a3e', ['🪔', '💍', '🏺', '🫖', '🧞', '🔮'], '✨', '🧶'),
  T('farm-fortune', 'Farm Fortune', 'low', '#2a2812', ['🐥', '🐷', '🐄', '🌽', '🚜', '👩‍🌾'], '🏡', '🥚'),
  T('ice-dragon', 'Ice Dragon', 'high', '#12283c', ['❄️', '🧊', '🗡️', '🛡️', '🏔️', '🐉'], '💠', '🥚'),
  T('disco-nights', 'Disco Nights', 'low', '#2e1236', ['🪩', '🎷', '🕺', '🎶', '🍸', '💃'], '✨', '📼'),
  T('carnival-cash', 'Carnival Cash', 'med', '#331632', ['🎭', '🪘', '🎺', '🎊', '💃', '🏆'], '🌟', '🎟️'),
  T('treasure-isle', 'Treasure Isle', 'med', '#123028', ['🗺️', '🌴', '🦜', '⚓', '💀', '💰'], '⚔️', '🗝️'),
  T('zombie-cash', 'Zombie Cash', 'high', '#1c2a14', ['🧟', '🦴', '⚰️', '🧠', '🔪', '☢️'], '☣️', '💵'),
  T('sushi-bar', 'Sushi Bar', 'low', '#2c1418', ['🍣', '🍱', '🍥', '🥢', '🍶', '🐥'], '🏮', '💴'),
  T('rodeo-rush', 'Rodeo Rush', 'med', '#33230f', ['🤠', '🐎', '🪢', '🥁', '🌵', '🏆'], '⭐', '💰'),
  T('crystal-cavern', 'Crystal Cavern', 'high', '#1a1438', ['🪨', '⛏️', '💎', '🔮', '🦇', '🌟'], '💠', '🧿', ['new']),
  T('phoenix-rise', 'Phoenix Rise', 'high', '#33160f', ['🔥', '🪶', '🗻', '☀️', '🦅', '🐦‍🔥'], '🌞', '🥚'),
  T('emerald-isle', 'Emerald Isle', 'low', '#12301e', ['☘️', '🏰', '🎻', '🐏', '🗻', '🧝'], '🌈', '🪙'),
  T('sultans-palace', 'Sultan’s Palace', 'med', '#332610', ['🐪', '🕌', '🫖', '💍', '🪔', '👸'], '⭐', '🧿'),
  T('aurora-nights', 'Aurora Nights', 'med', '#122c38', ['❄️', '🦋', '🏔️', '🐺', '🌠', '🌇'], '🌌', '🔮', ['new']),

  /* ── third wave ── */
  T('kraken-depths', 'Kraken Depths', 'high', '#0c2230', ['🪸', '🐡', '🦞', '⚓', '🚢', '🦑'], '🌊', '🧭', ['hot']),
  T('golden-empire', 'Golden Empire', 'med', '#33270e', ['🏺', '🪙', '🗿', '🐎', '👑', '🏛️'], '⭐', '📜'),
  T('neon-drift', 'Neon Drift', 'high', '#171236', ['🛞', '🏁', '⛽', '🚗', '🌃', '🏎️'], '⚡', '🏆', ['new']),
  T('bee-bonanza', 'Bee Bonanza', 'low', '#2e2408', ['🌼', '🍯', '🌻', '🐝', '🌷', '🪻'], '☀️', '🍭'),
  T('tiki-tumble', 'Tiki Tumble', 'med', '#1e2a12', ['🗿', '🥥', '🍍', '🌺', '🔥', '🥁'], '🌴', '🐚'),
  T('frost-giants', 'Frost Giants', 'high', '#152538', ['🪓', '🛡️', '🐻‍❄️', '🏔️', '🧊', '🧌'], '❄️', '⚡'),
  T('cosmic-cats', 'Cosmic Cats', 'med', '#1d1436', ['🐾', '🌙', '⭐', '🚀', '🪐', '🐱'], '🌌', '🧶', ['new']),
  T('gold-rush-town', 'Gold Rush Town', 'med', '#2f2410', ['⛏️', '🪣', '🏚️', '🐴', '💰', '🤠'], '⭐', '🗺️'),
  T('temple-serpent', 'Temple Serpent', 'high', '#1a2a14', ['🪶', '🗿', '🌿', '🦎', '🐍', '☀️'], '🔆', '💎'),
  T('royal-crowns', 'Royal Crowns', 'low', '#2a1030', ['💍', '🗝️', '🕯️', '🛡️', '👑', '🏰'], '⭐', '💎'),
  T('lava-fortune', 'Lava Fortune', 'high', '#301209', ['🌋', '🔥', '🪨', '💀', '⚒️', '🐲'], '☄️', '💰'),
  T('bamboo-luck', 'Bamboo Luck', 'low', '#16281a', ['🎋', '🍵', '🏮', '🪷', '🐢', '🐉'], '☯️', '🧧'),
  T('circus-cash', 'Circus Cash', 'med', '#2c1030', ['🎈', '🎠', '🤹', '🎪', '🦁', '🎩'], '🌟', '🎟️'),
  T('deep-reef', 'Deep Reef', 'med', '#0d2836', ['🪸', '🐟', '🐠', '🐢', '🦈', '🧜‍♀️'], '🌊', '🦪'),
  T('spartan-gold', 'Spartan Gold', 'high', '#2c1a10', ['🛡️', '🗡️', '🏹', '🐎', '🏛️', '🪖'], '⚔️', '🏆'),
  T('candy-vault', 'Candy Vault', 'low', '#331636', ['🍬', '🍡', '🍮', '🧋', '🍪', '🎂'], '🌈', '🔐'),
  T('wolfpack-wilds', 'Wolfpack Wilds', 'high', '#161f2c', ['🌲', '🦊', '🦉', '🐗', '🌙', '🐺'], '❄️', '🦴'),
  T('mayan-moon', 'Mayan Moon', 'med', '#212a12', ['🗿', '🌽', '🪶', '🐆', '🌘', '🏹'], '🔆', '💠'),
  T('cyber-vault', 'Cyber Vault', 'high', '#101a30', ['💳', '🔋', '🖥️', '🛰️', '🔐', '🤖'], '⚡', '💾', ['new']),
  T('desert-mirage', 'Desert Mirage', 'med', '#302610', ['🐪', '🌵', '🏜️', '🦂', '🕌', '🧞'], '☀️', '🪔'),
  T('festival-fever', 'Festival Fever', 'low', '#2e1330', ['🎊', '🎈', '🍢', '🏮', '🎆', '💃'], '🌟', '🎫'),
  T('bounty-seas', 'Bounty of the Seas', 'high', '#122636', ['⚓', '🧭', '🗺️', '🦜', '⚔️', '🏴‍☠️'], '🌊', '💎'),
  T('primal-hunt', 'Primal Hunt', 'high', '#1f2412', ['🦴', '🪨', '🔥', '🦣', '🐅', '🪃'], '⚡', '🥚'),
  T('lucky-lanterns', 'Lucky Lanterns', 'low', '#301418', ['🏮', '🎆', '🍊', '🐟', '🀄', '🐲'], '✨', '🧧'),
  T('vault-breakers', 'Vault Breakers', 'high', '#12261c', ['🧨', '🔦', '🪛', '💼', '🚔', '🕵️'], '💎', '💵', ['hot']),
  T('nordic-runes', 'Nordic Runes', 'med', '#1a2430', ['🪨', '🕯️', '🐏', '🦌', '⚡', '🧙'], '🔨', '🛡️'),
  T('safari-drums', 'Safari Drums', 'med', '#2c2612', ['🥁', '🦓', '🦒', '🐘', '🌅', '🦁'], '🌍', '🪘'),
  T('pixel-quest', 'Pixel Quest', 'low', '#141c34', ['🕹️', '👾', '🍄', '🗝️', '🛡️', '🐉'], '⭐', '💾'),
  T('moonlit-manor', 'Moonlit Manor', 'high', '#1c1428', ['🕯️', '🪞', '🕷️', '🦇', '🗝️', '👻'], '🌙', '⚱️'),
  T('harvest-gold', 'Harvest Gold', 'low', '#2a2610', ['🌾', '🍎', '🎃', '🐓', '🚜', '🧑‍🌾'], '☀️', '🥧'),
  T('titan-thunder', 'Titan Thunder', 'high', '#1a2038', ['⚡', '🏛️', '🌩️', '🦅', '🔱', '🗿'], '🌟', '⚱️', ['hot']),
  T('sweet-shop', 'Sweet Shop', 'low', '#33163a', ['🧁', '🍩', '🍫', '🍓', '🍒', '🍰'], '🌈', '🍯'),
  T('ice-kingdom', 'Ice Kingdom', 'med', '#14283a', ['❄️', '🧊', '🦌', '🐧', '🏰', '👸'], '💠', '🗝️'),
  T('rio-carnival', 'Rio Carnival', 'med', '#33143a', ['🪘', '🎭', '🦜', '🍹', '🏖️', '💃'], '🌟', '🎫'),
  T('dwarven-forge', 'Dwarven Forge', 'high', '#2a1c10', ['⚒️', '🪨', '🔥', '⛏️', '💎', '🧔'], '🛡️', '🪙'),
  T('starlight-spins', 'Starlight Spins', 'low', '#1a1638', ['✨', '🌙', '☄️', '🪐', '🔭', '🌟'], '💫', '🎆'),
  T('jade-dragon', 'Jade Dragon', 'high', '#122a1e', ['🀄', '🏮', '🎋', '🐢', '🪷', '🐉'], '☯️', '🧧', ['new']),
  T('outlaw-express', 'Outlaw Express', 'med', '#2e2010', ['🚂', '💼', '🔫', '🐎', '🌵', '🤠'], '⭐', '💰'),
  T('mermaid-lagoon', 'Mermaid Lagoon', 'med', '#0f2a34', ['🐚', '🪸', '🐡', '🦀', '🌊', '🧜‍♀️'], '💠', '🗝️'),
  T('phantom-opera', 'Phantom Opera', 'high', '#241030', ['🎭', '🎻', '🕯️', '🪞', '🌹', '👤'], '🎼', '🎫'),
  T('golden-koi-pond', 'Golden Koi Pond', 'low', '#1a2820', ['🪷', '🍥', '🎋', '🐢', '🌸', '🐟'], '☯️', '🧧'),
  T('meteor-miners', 'Meteor Miners', 'high', '#141834', ['⚙️', '🔩', '🛰️', '☄️', '🪐', '👽'], '🌌', '💎'),
  T('gladiator-arena', 'Gladiator Arena', 'high', '#2a1610', ['🛡️', '⚔️', '🏛️', '🦁', '🏆', '🪖'], '👑', '📜', ['hot']),
  T('cupcake-cash', 'Cupcake Cash', 'low', '#301838', ['🧁', '🍬', '🍭', '🥧', '🍒', '🎂'], '🌟', '🍯'),
  T('storm-chasers', 'Storm Chasers', 'high', '#16202e', ['🌪️', '⛈️', '🚙', '📡', '⚡', '🌩️'], '🌀', '📻'),
  T('emerald-temple', 'Emerald Temple', 'med', '#122614', ['🗿', '🌿', '🐍', '🦜', '💚', '🏛️'], '💎', '🗝️'),
  T('viking-voyage', 'Viking Voyage', 'med', '#1c2632', ['🛶', '🪓', '🐏', '🧭', '🌊', '🧔'], '🔨', '🛡️'),
  T('lucky-piggy', 'Lucky Piggy', 'low', '#301c28', ['🪙', '💵', '🍀', '💎', '🎀', '🐷'], '⭐', '🎁'),
  T('sultan-spins', 'Sultan Spins', 'med', '#2e2410', ['🕌', '🐪', '🫖', '💍', '🪔', '🤴'], '⭐', '🧿'),
  T('bone-diggers', 'Bone Diggers', 'high', '#252012', ['🦴', '⛏️', '🪨', '🥚', '🦖', '🧭'], '⚡', '💎'),
  T('bloom-fortune', 'Bloom Fortune', 'low', '#26142a', ['🌸', '🌷', '🌻', '🦋', '🐞', '🌺'], '✨', '🍯'),
  T('atlas-riches', 'Atlas Riches', 'med', '#1c2434', ['🧭', '🗺️', '⛵', '🏝️', '🧳', '🌍'], '⭐', '💰'),
  T('inferno-reels', 'Inferno Reels', 'high', '#2e1208', ['🔥', '🌋', '💀', '⛓️', '👹', '😈'], '☄️', '💎'),
  T('pearl-diver', 'Pearl Diver', 'med', '#0e2632', ['🦪', '🐚', '🐟', '🫧', '🤿', '🧜'], '🌊', '💠'),
  T('rune-scrolls', 'Rune Scrolls', 'high', '#1e1a30', ['📜', '🕯️', '🪄', '🔮', '📖', '🧙'], '✨', '🗝️'),
  T('honey-heist', 'Honey Heist', 'med', '#2e2410', ['🍯', '🐝', '🌻', '🧺', '🪵', '🐻'], '☀️', '🎁'),
  T('midnight-jazz', 'Midnight Jazz', 'low', '#181438', ['🎷', '🎺', '🥁', '🍸', '🎩', '🎼'], '✨', '🎫'),
  T('crystal-crowns', 'Crystal Crowns', 'high', '#1c1638', ['💠', '💎', '🔮', '🪄', '👑', '🏰'], '✨', '🗝️'),
  T('savanna-sun', 'Savanna Sun', 'med', '#2e2814', ['🦓', '🦒', '🌳', '🦏', '🌅', '🦁'], '☀️', '🥁'),
  T('lucky-fortune-cat', 'Lucky Fortune Cat', 'low', '#2e1418', ['🪙', '🏮', '🍊', '🎋', '🀄', '🐱'], '✨', '🧧', ['hot']),
];

/* ---------------- playable UI ---------------- */
function mountSlot(theme) {
  return function mount(root) {
    const model = MODELS[theme.model];
    const cells = [];               // cells[reel][row]
    let busy = false;

    /* Reel strips: each reel is a tall column of symbol images. The visible
       window shows ROWS of them; spinning translates the strip and lands it
       on the result. */
    const STRIP = 18;                       // symbols per strip, cycled
    const sym = (i) => `art/sym/${theme.id}/${i}.webp`;
    const strips = [];                      // strips[reel] = { node, imgs }

    const reelsWrap = el('div.reels', {
      style: { gridTemplateColumns: `repeat(${REELS}, 1fr)` },
    });

    for (let r = 0; r < REELS; r++) {
      const imgs = [];
      const strip = el('div.strip');
      for (let i = 0; i < STRIP; i++) {
        const im = el('img.symi', {
          src: sym(rndInt(8)), alt: '', loading: 'eager', decoding: 'async',
          draggable: 'false',
        });
        imgs.push(im);
        strip.append(el('div.cellw', {}, im));
      }
      const window_ = el('div.reel', {}, strip);
      cells[r] = [];
      strips[r] = { strip, imgs };
      reelsWrap.append(window_);
    }

    const machine = el('div.slot-machine', {},
      el('div.cab-art', {
        'aria-hidden': 'true',
        style: { backgroundImage: `url("art/${theme.id}.webp")` },
      }),
      el('div.cab-top', { 'aria-hidden': 'true' }),
      el('div.reel-window', {}, reelsWrap),
      el('div.cab-bot', { 'aria-hidden': 'true' }));

    const banner = el('div.freespin-banner', { hidden: true });
    const msg = msgLine();

    const paytable = el('div.paytable', {},
      theme.syms.map((_, i) => {
        const pay = i === SCAT
          ? `${model.scatter[2]}x`
          : `${Math.round(model.pays[i][2] * model.calib)}x`;
        return el('div.pt', {},
          el('img.pt-sym', { src: sym(i), alt: '', loading: 'lazy' }),
          i === WILD ? 'WILD' : i === SCAT ? 'SCAT' : '×5',
          el('b', {}, pay));
      }));

    const bp = betPanel({
      start: 20, min: 0.2, action: 'SPIN',
      onAction: () => doSpin(),
    });

    /* The strip is offset in CSS cell units, not measured pixels: measuring a
       cell mid-layout was landing the reel a fraction off and slicing symbols
       across the row boundaries. */
    const OFFSET = `translateY(calc(var(--cell) * ${-(STRIP - ROWS)}))`;

    /**
     * Spin one reel: fill the strip with random symbols, drop the final ROWS
     * into the landing slots, then translate from a long way up down to rest.
     */
    function spinReel(r, column) {
      const { strip, imgs } = strips[r];
      for (let i = 0; i < STRIP; i++) imgs[i].src = sym(rndInt(8));
      // the last ROWS cells of the strip are what ends up in the window
      for (let y = 0; y < ROWS; y++) imgs[STRIP - ROWS + y].src = sym(column[y]);

      strip.style.transition = 'none';
      strip.style.transform = OFFSET;
      void strip.offsetHeight;                       // flush before animating
      strip.classList.add('spinning');
    }

    function landReel(r, dur) {
      const { strip } = strips[r];
      strip.style.transition = `transform ${dur}ms cubic-bezier(.16,.85,.3,1.06)`;
      strip.style.transform = 'translateY(0)';
      strip.classList.remove('spinning');
    }

    async function animateReveal(grid) {
      clearHits();
      const stopTick = ticker('reelTick', 70);

      for (let r = 0; r < REELS; r++) spinReel(r, grid[r]);
      await sleep(240);

      for (let r = 0; r < REELS; r++) {
        landReel(r, 620);
        play('reelStop');
        await sleep(170);
      }
      await sleep(480);
      stopTick();
    }

    /* the visible window cells, for win highlighting */
    function windowCell(r, y) {
      return strips[r].strip.children[STRIP - ROWS + y];
    }
    function clearHits() {
      for (let r = 0; r < REELS; r++)
        for (const c of strips[r].strip.children) c.classList.remove('hit');
    }
    function highlight(res) {
      for (const w of res.wins)
        for (const [r, y] of w.cells) windowCell(r, y).classList.add('hit');
      if (res.scatters >= 3) {
        for (let r = 0; r < REELS; r++)
          for (let y = 0; y < ROWS; y++)
            if (windowCell(r, y).firstChild.src.endsWith(`/${SCAT}.webp`))
              windowCell(r, y).classList.add('hit');
      }
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

      if (total > bet) {
        wallet.pay(total);
        const x = total / bet;
        msg.win(total - bet, x >= 20 ? 'MEGA WIN' : x >= 8 ? 'BIG WIN' : 'WIN', bet);
        if (x >= 20) toast(`${theme.name}: ${x.toFixed(1)}× hit!`, 'win');
      } else if (total > 0) {
        // paid something back but less than the stake — say so, do not call it a win
        wallet.pay(total);
        msg.set(`Paid back $${fmt(total)} of your $${fmt(bet)} spin`, 'push');
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
        `Volatility <code>${model.label}</code> · line bet = total bet ÷ 20.`,
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
