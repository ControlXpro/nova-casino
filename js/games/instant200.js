/* Binds the 200-game catalogue to the twenty instant engines.

   The catalogue is generated data (tools/catalog200.py); the engines are hand
   written. This module is the only place that knows about both, so adding a
   variant means adding one catalogue row and nothing else. */
import { CATALOG200 } from './catalog200.js';
import {
  aim, picks, path, pump, race, duel, shuffleGame, match3, wires, spots,
} from './engines-a.js';
import {
  streak, wheelx, dig, ladder, catchGame, safe, burstGame, drawGame, trail, fuse,
} from './engines-b.js';

const ENGINES = {
  aim, picks, path, pump, race, duel, shuffle: shuffleGame, match3, wires, spots,
  streak, wheelx, dig, ladder, catch: catchGame, safe, burst: burstGame,
  draw: drawGame, trail, fuse,
};

/* Published return for each engine, measured by tools/rtp.mjs rather than
   asserted. Shown on the card so the number the player sees is the number the
   simulation produced. */
const RTP = {
  aim: 99.0, picks: 97.0, path: 99.0, pump: 99.0, race: 99.0, duel: 99.0,
  shuffle: 99.0, match3: 95.5, wires: 99.0, spots: 96.0,
  streak: 99.0, wheelx: 96.8, dig: 99.0, ladder: 99.0, catch: 99.0,
  safe: 99.0, burst: 96.0, draw: 96.2, trail: 95.0, fuse: 98.0,
};

const VOL = {
  aim: 'Low', picks: 'Medium', path: 'High', pump: 'High', race: 'Medium',
  duel: 'Low', shuffle: 'Medium', match3: 'Medium', wires: 'Medium', spots: 'High',
  streak: 'High', wheelx: 'Medium', dig: 'High', ladder: 'High', catch: 'Low',
  safe: 'High', burst: 'Medium', draw: 'High', trail: 'Medium', fuse: 'High',
};

/* Spread "hot"/"new" badges deterministically so the lobby has texture without
   every one of the 200 shouting for attention. */
const badge = (i) => (i % 17 === 3 ? ['hot'] : i % 23 === 5 ? ['new'] : []);

/* Two of the original catalogue ids collided with existing slot themes, which
   silently shadowed those games in the lobby's id map and overwrote their card
   art on disk. Fail loudly instead of shipping a duplicate. */
const seen = new Set();
for (const t of CATALOG200) {
  if (seen.has(t.id)) throw new Error(`duplicate game id "${t.id}" in CATALOG200`);
  seen.add(t.id);
}

export const instant200 = CATALOG200.map((t, i) => {
  const make = ENGINES[t.eng];
  if (!make) throw new Error(`no engine "${t.eng}" for game "${t.id}"`);
  return {
    id: t.id,
    name: t.name,
    cat: t.cat,
    icon: t.emblem,
    art: `linear-gradient(160deg, ${t.accent}33, #0b0d1c)`,
    rtp: RTP[t.eng],
    vol: VOL[t.eng],
    tags: badge(i),
    mount: make(t),
  };
});

/* Stage theming for the new games, in the shape themes.js expects. */
export const instant200Themes = Object.fromEntries(CATALOG200.map((t) => [t.id, {
  accent: t.accent,
  bg: `radial-gradient(115% 85% at 50% -12%, ${t.accent}26, transparent 60%),
       linear-gradient(160deg, ${t.accent}14, #0b0f1a)`,
  motif: t.motif,
  emblem: t.emblem,
}]));
