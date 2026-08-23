/* Simulated table companions and leaderboards.

   These are BOTS, not people. Nothing here talks to a server and no other
   human is at your table — the names are generated locally each round so the
   floor feels alive. Everywhere they surface they are labelled as simulated,
   because presenting invented players as real ones would be a lie the player
   can't check. */
import { rndInt, rnd, pick, shuffle, round2 } from './core.js';

const ADJ = ['Lucky', 'Silent', 'Golden', 'Neon', 'Rapid', 'Iron', 'Wild', 'Royal', 'Turbo',
  'Shadow', 'Crimson', 'Frost', 'Atomic', 'Velvet', 'Cosmic', 'Diamond', 'Midnight', 'Solar',
  'Rogue', 'Electric', 'Mystic', 'Savage', 'Chrome', 'Lunar', 'Blazing', 'Quiet', 'Nova'];
const NOUN = ['Fox', 'Tiger', 'Ace', 'Raven', 'Shark', 'Wolf', 'Falcon', 'Viper', 'Panda',
  'Comet', 'Joker', 'Rider', 'Ghost', 'Bison', 'Koi', 'Hawk', 'Dice', 'Kraken', 'Cobra',
  'Phoenix', 'Bandit', 'Drifter', 'Lynx', 'Orca', 'Sparrow', 'Titan', 'Wasp'];
const SUFFIX = ['', '', '', '_', '.', 'X', '77', '99', '_x'];

/** A plausible-looking player handle. */
export function randomName() {
  const base = pick(ADJ) + pick(NOUN);
  const tail = pick(SUFFIX);
  const num = rnd() < 0.55 ? String(rndInt(9000) + 100) : '';
  return (base + tail + num).slice(0, 16);
}

/** N distinct handles. */
export function randomNames(n) {
  const out = new Set();
  let guard = 0;
  while (out.size < n && guard++ < 200) out.add(randomName());
  return [...out];
}

const FLAGS = ['🇬🇧', '🇩🇪', '🇧🇷', '🇮🇳', '🇯🇵', '🇨🇦', '🇦🇺', '🇪🇸', '🇵🇱', '🇳🇬',
  '🇲🇽', '🇮🇹', '🇹🇷', '🇰🇷', '🇸🇪', '🇿🇦', '🇦🇷', '🇵🇭', '🇫🇷', '🇳🇱'];
export const randomFlag = () => pick(FLAGS);

/* ── blackjack basic strategy (used to play the bot seats) ── */
/**
 * Returns 'hit' | 'stand' | 'double' for a simulated seat.
 * A trimmed basic-strategy chart — good enough that the bots look competent.
 */
export function basicStrategy(total, soft, canDouble, dealerUp) {
  const up = dealerUp === 1 ? 11 : Math.min(dealerUp, 10);

  if (soft) {
    if (total >= 19) return 'stand';
    if (total === 18) return up >= 9 ? 'hit' : (canDouble && up >= 3 && up <= 6 ? 'double' : 'stand');
    if (total === 17) return canDouble && up >= 3 && up <= 6 ? 'double' : 'hit';
    if (total >= 15) return canDouble && up >= 4 && up <= 6 ? 'double' : 'hit';
    return canDouble && up >= 5 && up <= 6 ? 'double' : 'hit';
  }

  if (total >= 17) return 'stand';
  if (total >= 13) return up <= 6 ? 'stand' : 'hit';
  if (total === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit';
  if (total === 11) return canDouble ? 'double' : 'hit';
  if (total === 10) return canDouble && up <= 9 ? 'double' : 'hit';
  if (total === 9) return canDouble && up >= 3 && up <= 6 ? 'double' : 'hit';
  return 'hit';
}

/** A bot's stake for a round, loosely scaled to the player's own bet. */
export function botStake(playerBet) {
  const factor = pick([0.4, 0.5, 1, 1, 1, 2, 2, 4]);
  return round2(Math.max(1, playerBet * factor));
}

/* ── leaderboard ─────────────────────────────────────────────
   A simulated board. It is generated fresh in the browser and labelled as
   such in the UI — it is decoration, never presented as real results. */
export function leaderboard(games, n = 8) {
  const names = randomNames(n);
  const rows = names.map((name) => {
    const g = pick(games);
    const mult = pick([2.1, 3.4, 5.6, 8.2, 12.5, 24, 41, 78, 120, 260, 540]);
    const stake = pick([5, 10, 25, 50, 100, 250]);
    return {
      name,
      flag: randomFlag(),
      game: g.name,
      gameId: g.id,
      mult,
      win: round2(stake * mult),
    };
  });
  return rows.sort((a, b) => b.win - a.win);
}
