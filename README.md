# 🎰 Nova Casino

**A free-to-play social casino. 56 games. Zero real money.**

Nova Casino is a static, client-side casino simulation. Every balance is virtual
play credits with **no cash value**. There is no payment processing, no deposits,
no withdrawals, no prizes, and no way to convert anything here into money.

> ⚠️ This is entertainment and a demonstration of casino game maths — not a
> gambling operator. Practice play does not predict results in real gambling.
> 18+. If gambling is a problem for you: [BeGambleAware](https://www.begambleaware.org) ·
> [Gambling Therapy](https://www.gamblingtherapy.org) · [NCPG (US)](https://www.ncpgambling.org).

---

## The games (56)

| Category | Count | Titles |
|---|---|---|
| **Slots** | 28 | Book of Sunrise, Neon Fruits, Dragon's Hoard, Pharaoh's Gold, Wild Buffalo, Sweet Cluster, Pirate's Bounty, Aztec Sun, Wolf Moon, Diamond Sevens, Gates of Fortune, Lucky Koi, Space Miners, Viking Fury, Safari King, Mystic Fairy, Cash Vault, Wild West Gold, Joker Bells, Ocean Riches, Samurai Blade, Voodoo Nights, Bonanza Mine, Frozen Fortune, Cleopatra's Eye, Retro Vegas, Reel Fisher, Fire & Ice Reels |
| **Table** | 8 | Blackjack Classic, Double Deck Blackjack, Baccarat, European Roulette, American Roulette, Sic Bo, Craps, Red Dog, Casino War |
| **Poker** | 5 | Jacks or Better, Deuces Wild, Joker Poker, Three Card Poker, Caribbean Stud |
| **Instant** | 11 | Crash, Mines, Plinko, Dice, Limbo, Wheel of Fortune, Coin Flip, Tower, Penalty Shootout, Rock Paper Scissors, Hi-Lo |
| **Lottery** | 3 | Keno, Bingo 75, Scratch Gold |

Every game has its own themed stage — background, accent colour, decorative
motif and bespoke animations — plus a rules panel stating its payouts and
mechanics.

## Design

The interface follows `design-system/nova-casino/MASTER.md` (dark navy shell,
electric-blue + gold accents, dense grids, mobile tab bar). Each of the 56 games
gets a distinct stage theme from `js/themes.js`, and `js/fx.js` provides the
shared celebration layer — tiered win overlays, particle bursts, count-up
counters and press ripples — on top of per-game animations (reel bounce,
3D card deals, an orbiting roulette ball, 3D coin and dice, tile flips).

RTP figures are no longer surfaced in the UI. The maths is unchanged and the
simulator below still verifies it.

## How it is built

No framework, no build step, no dependencies. Plain ES modules served as static
files.

```
index.html
css/style.css
js/
  core.js          RNG, wallet, storage, DOM helpers
  ui.js            bet panel, playing cards, poker evaluator
  auth.js          local accounts (PBKDF2-SHA256)
  app.js           lobby, routing, account gate
  games/
    slots.js       5×3 / 20-line engine + 28 themes
    cards.js       blackjack, baccarat, video poker, stud games
    table.js       roulette, sic bo, craps, keno, bingo
    instant.js     crash, mines, plinko, dice, limbo, tower…
tools/rtp.mjs      Monte-Carlo RTP verifier for the slot maths
```

### Randomness

All outcomes come from `crypto.getRandomValues`, with rejection sampling in
`rndInt()` so integer ranges are unbiased. There is no seeding and no
server — nothing about a result is predetermined by the site.

### The maths is real

The 28 slots share three tuned math models. The payout scalar on each model was
fitted by simulation so the RTP printed in the game matches what the engine
actually pays:

```bash
node tools/rtp.mjs 1500000
# low   stated  96.1%  measured  96.38%  drift +0.28%
# med   stated  95.5%  measured  95.78%  drift +0.28%
# high  stated  94.8%  measured  95.02%  drift +0.22%
```

The instant games use exact inverse-odds pricing with a flat 1% edge — Mines
pays `0.99 × C(25,k) ÷ C(25−m,k)`, Dice pays `99 ÷ win chance`, Crash and Limbo
draw from `0.99 ÷ (1 − r)`. Table games follow real rules: European roulette is
2.70% house edge, American 5.26%, baccarat banker 1.06%, pass line 1.41%.

## Accounts

Players can create a username and password, or continue as a guest. **These are
local browser accounts, not real authentication:**

- Everything is stored in this browser's `localStorage`. There is no server and
  nothing is uploaded anywhere.
- Passwords are stretched with **PBKDF2-SHA256, 210,000 iterations** and a
  random 16-byte per-user salt. Only the digest is stored — never the password.
- Failed logins are rate-limited with a lockout after 5 attempts, and the key
  derivation runs even for unknown usernames so timing does not leak whether an
  account exists.
- **This still offers no protection against anyone with access to the device.**
  Users are told so on the sign-up screen and asked not to reuse a real password.
- Each account gets its own play balance. Clearing site data deletes both.

## Running it locally

Any static file server works — ES modules will not load over `file://`.

```bash
python -m http.server 4173
```

Then open <http://localhost:4173>.

## Deployment

Served as a static site from GitHub Pages off the `main` branch. No build,
no CI, no secrets — push and it is live.

## Licence

MIT. The game names and artwork are original; this project is not affiliated
with any real casino or game studio.
