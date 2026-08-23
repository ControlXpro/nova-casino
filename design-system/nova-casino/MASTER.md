# Nova Casino — Design System (MASTER)

Global source of truth. Page overrides live in `pages/<page>.md` and win over this file.

Generated with `ui-ux-pro-max --design-system --variance 7 --motion 5 --density 8`,
then hand-corrected. **Deviations from the tool output are listed at the bottom with reasons.**

Visual reference: the 1win.com product surface — dark navy shell, electric-blue +
gold accents, dense game grids, promo rail, mobile bottom tab bar.
**Reference for layout and colour language only.** No 1win logo, wordmark, brand
asset or copy is reproduced, and nothing here should read as an actual gambling
operator (see "Non-negotiables").

---

## Dials

| Dial | Value | Meaning |
|---|---|---|
| Variance | 7/10 | Balanced / modern — bold blocks, not brutalist |
| Motion | 5/10 | Standard — scroll/stagger reveals, 150–300ms micro-interactions |
| Density | 8/10 | Dense / dashboard — 8–32px spacing scale, tight game grids |

## Style

**Vibrant & Block-based** (DB match, product type `Gaming`).
Keywords: bold, energetic, block layout, high colour contrast, dark-first.
Landing pattern: **Feature-Rich Showcase** — promo rail → live proof → dense category grids.

## Colour tokens

Dark-first. There is no light theme; the shell is always dark (`color-scheme: dark`).

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0b0f1a` | App background |
| `--surface` | `#131a2a` | Cards, panels, game tiles |
| `--surface-2` | `#1b2437` | Raised: inputs, chips, hover |
| `--line` | `#243048` | Borders, dividers |
| `--brand` | `#1f6dff` | Primary action, links, active nav |
| `--brand-hi` | `#4b8cff` | Brand hover / focus ring |
| `--gold` | `#ffc531` | CTA (sign up, spin, bet), balance |
| `--gold-hi` | `#ffd875` | Gold hover |
| `--on-gold` | `#241a00` | Text on gold — 12.6:1 |
| `--txt` | `#eaf0ff` | Primary text — 15.4:1 on `--bg` |
| `--dim` | `#93a1bf` | Secondary text — 6.1:1 on `--bg` |
| `--win` | `#2ee06a` | Wins, positive delta |
| `--lose` | `#ff4d6a` | Losses, errors |
| `--live` | `#ff3b5c` | Live/hot badge dot |

All pairs used for text meet **≥4.5:1**; `--dim` on `--surface` is 5.3:1.

## Spacing (density 8)

`--s1 4px · --s2 8px · --s3 12px · --s4 16px · --s5 24px · --s6 32px`
Section rhythm 16/24/32. Grid gap 8–10px. Radius: `--r-sm 8px · --r 12px · --r-lg 18px · --r-pill 999px`.

## Typography

**Flat Design Mobile (System Bold)** pairing — Inter for both heading and body (DB match).
Weights 400/600/700/800. Base 16px, line-height 1.5, tabular numerals for money
(`font-variant-numeric: tabular-nums`) so balances do not jitter.
`JetBrains Mono` retained for figures inside games (multipliers, dice, card values).

## Motion (tier: Standard)

Stagger List — `opacity 0 → 1, scale .92 → 1, y 16 → 0`, `duration .4s`,
`stagger .06 grid:'auto'`, ease `back.out(1.4)`.
Implemented in **CSS** (no GSAP dependency — this project has no build step and
ships zero third-party JS). Micro-interactions 150–250ms. Everything inside
`@media (prefers-reduced-motion: reduce)` collapses to instant.

## Components

- **Topbar** — logo, desktop nav pills, search, balance chip, gold CTA. Sticky, 56px.
- **Sidebar** — desktop ≥1024px, SVG category icons + counts.
- **Category rail** — horizontal scroll-snap chips, sticky under topbar on mobile.
- **Promo rail** — 3 scroll-snap slides, dots, auto-advance 6s (pauses on hover/focus).
- **Wins ticker** — marquee of recent play-money wins, `aria-hidden`, pauses on reduced-motion.
- **Game tile** — 4:3 art, badge, title, RTP/volatility meta. Min tile 132px mobile.
- **Bottom tab bar** — ≤5 items, mobile only, safe-area padded.

## Non-negotiables

1. **No emoji as structural icons.** Nav, tabs and controls use inline SVG (Lucide-style,
   1.8px stroke, 20/24px tokens). Emoji remain only as *game content* — slot reel
   symbols, card suits, dice pips — which is artwork, not iconography.
2. **Touch targets ≥44px**, 8px+ apart. Bottom nav respects `env(safe-area-inset-bottom)`.
3. **The play-money framing must stay louder than the styling.** A site that looks
   like a real operator carries more risk of being mistaken for one, so the age gate,
   the "PLAY MONEY" badge in the topbar, and the footer disclaimer are not optional
   and must not be visually de-emphasised.
4. Focus rings never removed. `:focus-visible` = 2px `--brand-hi` + 2px offset.
5. No horizontal page scroll at 320px. Wide content scrolls inside its own container.

## Deviations from tool output

| Tool said | Used instead | Why |
|---|---|---|
| Pattern: *Newsletter / Content First* | *Feature-Rich Showcase* | Misroute — the query matched a newsletter pattern for a 56-game casino lobby. The `--domain product` search for `Gaming` returns Feature-Rich Showcase, which is correct. |
| Palette: neon purple `#7C3AED` + rose `#F43F5E` | Navy + electric blue `#1f6dff` + gold `#ffc531` | No DB palette matched navy/electric-blue/gold; the closest were a light rose social palette and a light legal navy. **This palette is derived from the visual reference, not a DB match.** |
| Type: Russo One / Chakra Petch | Inter / Inter | Russo One reads as an esports poster face. The reference surface uses a neutral bold grotesk; the DB's *Flat Design Mobile (System Bold)* pairing is the match. |
| Motion: GSAP snippet | CSS equivalent | Project ships no dependencies and has no build step. Same curve and stagger, implemented natively. |
