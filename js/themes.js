import { instant200Themes } from './games/instant200.js';
/* Per-game visual identity.
   Each game gets its own stage background, accent colour and decorative motif,
   so no two games look alike. Applied to `.stage` as CSS custom properties in
   app.js — game code never needs to know about it.

   accent  : drives buttons, glows, active states inside that game
   bg      : the stage backdrop
   motif   : a `.stage-motif` decoration class (see css/style.css)
   emblem  : large watermark glyph behind the play area                    */

const T = (accent, bg, motif, emblem) => ({ accent, bg, motif, emblem });

const felt = (h) =>
  `radial-gradient(120% 90% at 50% -10%, hsl(${h} 42% 22%), hsl(${h} 46% 9%) 62%, #080b14)`;
const neon = (a, b) =>
  `radial-gradient(110% 80% at 20% -10%, ${a}, transparent 58%), linear-gradient(160deg, ${b}, #080b14)`;

export const GAME_THEMES = {
  /* ── instant ─────────────────────────────────────────── */
  crash:        T('#ff7a45', neon('#ff7a4533', '#141b34'), 'stars',   '🚀'),
  mines:        T('#2ee06a', neon('#2ee06a2b', '#0f2a1e'), 'grid',    '💣'),
  plinko:       T('#8b5cf6', neon('#8b5cf633', '#1d1638'), 'dots',    '🔺'),
  dice:         T('#3ad8ff', neon('#3ad8ff2b', '#0f2436'), 'diag',    '🎲'),
  limbo:        T('#ffc531', neon('#ffc53129', '#2a2210'), 'rise',    '📈'),
  wheel:        T('#ff4d6a', neon('#ff4d6a2b', '#2c1424'), 'rays',    '🎡'),
  'coin-flip':  T('#ffc531', neon('#ffc53133', '#2b2210'), 'shine',   '🪙'),
  tower:        T('#4b8cff', neon('#4b8cff2e', '#111d3a'), 'bricks',  '🗼'),
  penalty:      T('#2ee06a', felt(140),                     'pitch',   '⚽'),
  rps:          T('#ff4d6a', neon('#ff4d6a2b', '#2e1030'), 'diag',    '✊'),
  'hi-lo':      T('#3ad8ff', neon('#3ad8ff2b', '#161a3a'), 'diag',    '🔼'),

  /* ── table ───────────────────────────────────────────── */
  blackjack:      T('#2ee06a', felt(152), 'felt',  '♠'),
  'blackjack-dd': T('#3ad8ff', felt(196), 'felt',  '♦'),
  baccarat:       T('#ff4d6a', felt(348), 'felt',  '♥'),
  'roulette-eu':  T('#2ee06a', felt(150), 'wheel', '🎡'),
  'roulette-us':  T('#4b8cff', felt(214), 'wheel', '🎡'),
  'sic-bo':       T('#ffc531', felt(28),  'felt',  '🎲'),
  craps:          T('#2ee06a', felt(166), 'felt',  '🎲'),
  'red-dog':      T('#ff7a45', felt(14),  'felt',  '🐕'),
  'casino-war':   T('#ffc531', felt(36),  'felt',  '⚔'),

  /* ── poker ───────────────────────────────────────────── */
  'video-poker-jb':    T('#4b8cff', felt(220), 'felt', '🂡'),
  'video-poker-dw':    T('#8b5cf6', felt(266), 'felt', '2'),
  'video-poker-joker': T('#ff4d6a', felt(320), 'felt', '🃏'),
  'three-card-poker':  T('#2ee06a', felt(164), 'felt', '♣'),
  'caribbean-stud':    T('#3ad8ff', felt(190), 'felt', '🏝'),

  /* ── lottery ─────────────────────────────────────────── */
  keno:           T('#8b5cf6', neon('#8b5cf62e', '#1c1638'), 'dots',  '🔢'),
  'bingo-75':     T('#ffc531', neon('#ffc5312b', '#2c2110'), 'balls', '🎱'),
  'scratch-gold': T('#ffc531', neon('#ffc53133', '#31240f'), 'shine', '🎫'),
};

/* Slots inherit their reel-theme colour; each of the 28 already has its own
   `bg`, so they only need an accent + motif to stay distinct from one another. */
const SLOT_ACCENTS = {
  'book-of-sunrise': '#ffc531', 'neon-fruits': '#3ad8ff', 'dragons-hoard': '#ff4d6a',
  'pharaohs-gold': '#ffc531', 'wild-buffalo': '#ff7a45', 'sweet-cluster': '#ff7ad1',
  'pirates-bounty': '#3ad8ff', 'aztec-sun': '#ffb020', 'wolf-moon': '#8fb4ff',
  'diamond-sevens': '#8b5cf6', 'gates-of-fortune': '#ffd24a', 'lucky-koi': '#ff6b5c',
  'space-miners': '#4b8cff', 'viking-fury': '#7fd8ff', 'safari-king': '#ffb020',
  'mystic-fairy': '#c79bff', 'cash-vault': '#2ee06a', 'wild-west-gold': '#e8a33d',
  'joker-bells': '#ff7ad1', 'ocean-riches': '#3ad8ff', 'samurai-blade': '#ff4d6a',
  'voodoo-nights': '#a56bff', 'bonanza-mine': '#ffc531', 'frozen-fortune': '#7fe3ff',
  'cleopatras-eye': '#ffd24a', 'retro-vegas': '#ff5cc8', 'reel-fisher': '#2ee06a',
  'fire-and-ice': '#ff8a5c',
};
const SLOT_MOTIFS = ['rays', 'dots', 'diag', 'shine', 'grid'];

export function themeFor(game) {
  const t = GAME_THEMES[game.id] || instant200Themes[game.id];
  if (t) return t;
  if (game.cat === 'slots') {
    const accent = SLOT_ACCENTS[game.id] || '#ffc531';
    const i = Object.keys(SLOT_ACCENTS).indexOf(game.id);
    return {
      accent,
      bg: `radial-gradient(115% 85% at 50% -12%, ${accent}22, transparent 58%), ${game.art}`,
      motif: SLOT_MOTIFS[(i < 0 ? 0 : i) % SLOT_MOTIFS.length],
      emblem: game.icon,
    };
  }
  return T('#ffc531', 'linear-gradient(160deg,#131a2a,#0b0f1a)', 'diag', game.icon);
}
