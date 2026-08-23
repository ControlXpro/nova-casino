/* Nova Casino — lobby, routing, wallet UI, account gate. */
import { el, $, $$, clear, fmt, wallet, onWallet, toast } from './core.js';
import { auth, validate } from './auth.js';
import { themeFor } from './themes.js';
import { installRipple } from './fx.js';
import { sound, play } from './sound.js';
import { dailyBonusCard, promoCards, tournaments, bigWinBoard } from './lobby-sections.js';
import { slotGames } from './games/slots.js';
import { cardGames } from './games/cards.js';
import { tableGames } from './games/table.js';
import { instantGames } from './games/instant.js';
import { moreGames } from './games/more.js';

const GAMES = [...instantGames, ...moreGames, ...cardGames, ...tableGames, ...slotGames];
const byId = new Map(GAMES.map((g) => [g.id, g]));

/* ── icons ──────────────────────────────────────────────────
   Inline SVG, one stroke system (see css `svg{}`). Emoji are used only as
   game artwork — never as structural icons. */
const PATHS = {
  home: '<path d="m3 10.5 9-7.5 9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  flame: '<path d="M12 2c2 3.5 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3.4 2-4.5.2 1.3 1 2.2 2 2.5-.5-2.5 0-5 1-7Z"/>',
  reels: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M9 6v12M15 6v12"/>',
  cards: '<rect x="3" y="4" width="11" height="16" rx="2"/><path d="M17 6.5 20.5 8a1 1 0 0 1 .6 1.3l-4 11"/>',
  spade: '<path d="M12 3c-1.6 3-6 5-6 8.4A3.4 3.4 0 0 0 12 13.8 3.4 3.4 0 0 0 18 11.4C18 8 13.6 6 12 3Z"/><path d="M12 14v7M9.5 21h5"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  ticket: '<path d="M3 9V7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 6v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-6Z"/><path d="M14 6.5v11"/>',
  user: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  logout: '<path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 8 6 12l4 4M6 12h9"/>',
};
const ico = (name, cls = '') =>
  el('span', { html: `<svg viewBox="0 0 24 24" aria-hidden="true" class="${cls}">${PATHS[name]}</svg>`,
    style: { display: 'contents' } });

const CATS = [
  { key: 'all', icon: 'home', label: 'All Games' },
  { key: 'popular', icon: 'flame', label: 'Popular' },
  { key: 'slots', icon: 'reels', label: 'Slots' },
  { key: 'table', icon: 'cards', label: 'Table' },
  { key: 'poker', icon: 'spade', label: 'Poker' },
  { key: 'instant', icon: 'zap', label: 'Instant' },
  { key: 'lottery', icon: 'ticket', label: 'Lottery' },
];
const inCat = (k) => (k === 'all' ? GAMES
  : k === 'popular' ? GAMES.filter((g) => g.tags?.length)
  : GAMES.filter((g) => g.cat === k));

let cat = 'all';
let query = '';

/* ── wallet UI ────────────────────────────────────────────── */
const balEl = $('#balance');
function paintWallet(state, dir) {
  balEl.textContent = fmt(state.balance);
  balEl.classList.remove('flash-up', 'flash-dn');
  void balEl.offsetWidth;
  if (dir) balEl.classList.add(dir === 'up' ? 'flash-up' : 'flash-dn');
}
onWallet(paintWallet);

/* ── promo rail ───────────────────────────────────────────── */
const SLIDES = [
  { kicker: 'Welcome', art: '🎰',
    bg: 'linear-gradient(100deg,#0b0f1aee,#0b0f1a66 55%,transparent), url("art/_hero.webp") center/cover',
    h: ['Play ', '106 casino games', ' — for free.'],
    p: 'Slots, blackjack, roulette, crash, mines and more. Every balance is play credits: nothing here costs money, and nothing here pays money.',
    cta: 'Browse all games', go: 'all' },
  { kicker: 'Open source', art: '🎲', bg: 'linear-gradient(100deg,#0f2a1e,#2ee06a2e 60%,#0b0f1a)',
    h: ['Real casino maths, ', 'fully open', '.'],
    p: 'Every result comes from the browser crypto RNG. The whole engine is on GitHub — read it, run it, check it yourself.',
    cta: 'Read the source', href: 'https://github.com/ControlXpro/nova-casino' },
  { kicker: 'Tournaments', art: '🏆',
    bg: 'linear-gradient(100deg,#0b0f1aee,#0b0f1a66 55%,transparent), url("art/_tournament.webp") center/cover',
    h: ['Daily ', 'tournaments', ' and streak bonuses.'],
    p: 'Claim a bonus every day, climb the boards, and play thirteen instant games priced on exact inverse odds.',
    cta: 'Play instant games', go: 'instant' },
];
function promoRail() {
  const rail = el('div.promo.noscroll');
  const dots = el('div.promo-dots');
  SLIDES.forEach((s, i) => {
    const cta = s.href
      ? el('a.btn.btn-gold', { href: s.href, target: '_blank', rel: 'noopener' }, s.cta)
      : el('button.btn.btn-gold', { type: 'button', onclick: () => setCat(s.go) }, s.cta);
    rail.append(el('div.promo-slide', { style: { background: s.bg } },
      el('div.promo-art', { 'aria-hidden': 'true' }, s.art),
      el('div.promo-body', {},
        el('span.promo-kicker', {}, s.kicker),
        el('h2', {}, s.h[0], el('em', {}, s.h[1]), s.h[2]),
        el('p', {}, s.p),
        cta)));
    const d = el('button' + (i === 0 ? '.on' : ''), { type: 'button', 'aria-label': `Slide ${i + 1}` });
    d.addEventListener('click', () => scrollTo(i));
    dots.append(d);
  });

  const scrollTo = (i) => rail.scrollTo({ left: i * rail.clientWidth, behavior: 'smooth' });
  let idx = 0, timer = 0;
  const tick = () => { idx = (idx + 1) % SLIDES.length; scrollTo(idx); };
  const start = () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    timer = setInterval(tick, 6000);
  };
  const stop = () => clearInterval(timer);
  rail.addEventListener('pointerenter', stop);
  rail.addEventListener('pointerleave', start);
  rail.addEventListener('focusin', stop);
  rail.addEventListener('scroll', () => {
    const i = Math.round(rail.scrollLeft / Math.max(1, rail.clientWidth));
    if (i !== idx) { idx = i; [...dots.children].forEach((d, n) => d.classList.toggle('on', n === i)); }
  }, { passive: true });
  start();
  return el('div', {}, rail, dots);
}

/* ── recent-rounds ticker ─────────────────────────────────────
   Deliberately shows the player's OWN real results, not invented
   "recent winners" — fabricated social proof is a dark pattern, and on a
   play-money site it would be fake data dressed up as real. */
function ticker() {
  const recent = wallet.recent.filter((r) => r.p > 0).slice(0, 14);
  if (recent.length < 3) return null;
  const items = recent.map((r) => {
    const g = byId.get(r.g);
    return el('span.tick', {},
      el('i', { 'aria-hidden': 'true' }, g?.icon ?? '🎲'),
      g?.name ?? r.g,
      el('b', {}, '+' + fmt(r.p)));
  });
  const track = el('div.ticker-track', {}, items, items.map((n) => n.cloneNode(true)));
  if (recent.length < 6) track.style.animation = 'none';
  return el('div.ticker', {},
    el('div.ticker-tag', {}, el('span.ticker-dot'), 'Your wins'),
    el('div', { style: { overflow: 'hidden', flex: '1' }, 'aria-hidden': 'true' }, track));
}

/* ── lobby ────────────────────────────────────────────────── */
function gameCard(g, i) {
  const badge = g.tags?.includes('hot') ? el('div.badge.hot', {}, 'HOT')
    : g.tags?.includes('new') ? el('div.badge.new', {}, 'NEW') : null;
  const card = el('button.card', {
    type: 'button', title: g.name,
    'aria-label': `${g.name} — ${g.cat}, ${g.vol} volatility`,
    style: { '--d': Math.min(i, 14) * 28 + 'ms' },
  },
    badge,
    el('div.card-art', { style: { background: g.art } },
      el('img.card-img', {
        src: `art/${g.id}.webp`, alt: '', loading: 'lazy', decoding: 'async',
        onerror: (e) => { e.target.remove(); },
      }),
      el('span.em', { 'aria-hidden': 'true' }, g.icon)),
    el('div.card-body', {},
      el('div.card-title', {}, g.name),
      el('div.card-meta', {}, el('span.vol', {}, g.vol), el('span.play', {}, 'PLAY'))));
  card.addEventListener('click', () => { location.hash = '#/game/' + g.id; });
  return card;
}
function section(iconName, title, list) {
  if (!list.length) return null;
  return el('div', {},
    el('div.sec-head', {},
      el('h3', {}, iconName ? ico(iconName) : null, title),
      el('span.count', {}, list.length)),
    el('div.grid', {}, list.map(gameCard)));
}

function chipRail() {
  const rail = el('div.chips.noscroll', { role: 'tablist', 'aria-label': 'Game categories' });
  for (const c of CATS) {
    const b = el('button.chip-btn' + (c.key === cat ? '.on' : ''), {
      type: 'button', role: 'tab', 'aria-selected': c.key === cat ? 'true' : 'false',
    }, ico(c.icon), c.label);
    b.addEventListener('click', () => setCat(c.key));
    rail.append(b);
  }
  return rail;
}

const activeTimers = [];
function stopTimers() {
  while (activeTimers.length) activeTimers.pop()?.stop?.();
}

function renderLobby() {
  stopTimers();
  const lobby = $('#lobby');
  clear(lobby);
  $('#gameView').hidden = true;
  lobby.hidden = false;

  const q = query.trim().toLowerCase();
  if (q) {
    const list = GAMES.filter((g) => g.name.toLowerCase().includes(q) || g.cat.includes(q));
    lobby.append(chipRail());
    if (list.length) lobby.append(section('search', `Results for “${query}”`, list));
    else lobby.append(el('div.empty', {}, ico('search'),
      el('div', {}, `Nothing matches “${query}”.`),
      el('div', { style: { marginTop: '6px', fontSize: '13px' } }, 'Try “slot”, “poker”, “dice” or “roulette”.')));
    return;
  }

  if (cat === 'all') {
    lobby.append(promoRail());
    const t = ticker();
    if (t) lobby.append(t);
    lobby.append(chipRail());
    lobby.append(section('flame', 'Popular now', inCat('popular')));

    /* bonuses + simulated boards */
    lobby.append(el('div.sec-head', {}, el('h3', {}, ico('ticket'), 'Bonuses & tournaments')));
    lobby.append(el('div.two-col', {},
      dailyBonusCard(() => renderLobby()),
      bigWinBoard(GAMES, (id) => { location.hash = '#/game/' + id; })));
    const tv = tournaments((c) => setCat(c));
    activeTimers.push(tv);
    lobby.append(tv);
    lobby.append(promoCards());

    lobby.append(section('zap', 'Instant win', inCat('instant')));
    lobby.append(section('cards', 'Table games', inCat('table')));
    lobby.append(section('spade', 'Poker', inCat('poker')));
    lobby.append(section('ticket', 'Lottery & scratch', inCat('lottery')));
    lobby.append(section('reels', 'Slots', inCat('slots')));
  } else {
    const c = CATS.find((x) => x.key === cat);
    lobby.append(chipRail());
    lobby.append(section(c.icon, c.label, inCat(cat)));
  }
}

function setCat(key) {
  cat = key; query = ''; $('#search').value = '';
  paintNav();
  closeNav();
  if (location.hash.startsWith('#/game/')) location.hash = '#/lobby';
  else { renderLobby(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
}

/* ── game view ────────────────────────────────────────────── */
function renderGame(id) {
  const g = byId.get(id);
  if (!g) { location.hash = '#/lobby'; return; }
  stopTimers();
  const view = $('#gameView');
  clear(view);
  $('#lobby').hidden = true;
  view.hidden = false;

  const t = themeFor(g);
  const stage = el('div.stage.motif-' + t.motif, {
    style: { '--accent': t.accent, '--stage-bg': t.bg },
  }, el('div.stage-emblem', { 'aria-hidden': 'true' }, t.emblem));

  const back = el('a.btn.btn-ghost.gv-back', { href: '#/lobby' }, ico('back'), 'Lobby');
  view.style.setProperty('--accent', t.accent);
  view.append(
    el('div.gv-head', {},
      el('div.gv-ico', { 'aria-hidden': 'true', style: { background: t.bg } },
        el('img', { src: `art/${g.id}.webp`, alt: '', loading: 'lazy',
          onerror: (e) => e.target.remove() }),
        el('span', {}, g.icon)),
      el('div', {},
        el('h2', {}, g.name),
        el('div.gv-sub', {},
          el('span', {}, g.cat.toUpperCase()),
          el('span', {}, `${g.vol} volatility`),
          el('span', {}, 'PLAY MONEY'))),
      back),
    stage);

  try {
    g.mount(stage);
  } catch (err) {
    console.error(err);
    stage.append(el('div.empty', {}, 'This game failed to load. Please refresh the page.'));
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── nav ──────────────────────────────────────────────────── */
function paintNav() {
  const nav = $('#catNav');
  clear(nav);
  for (const c of CATS) {
    const b = el('button.cat-btn' + (c.key === cat ? '.on' : ''), {
      type: 'button', 'aria-current': c.key === cat ? 'page' : null,
    }, ico(c.icon), c.label, el('span.n', {}, inCat(c.key).length));
    b.addEventListener('click', () => setCat(c.key));
    nav.append(b);
  }

  const bar = $('#tabbar');
  clear(bar);
  for (const c of [CATS[0], CATS[1], CATS[2], CATS[5]]) {
    const b = el('button.tab' + (c.key === cat ? '.on' : ''), {
      type: 'button', 'aria-current': c.key === cat ? 'page' : null,
    }, ico(c.icon), el('span', {}, c.label.replace(' Games', '')));
    b.addEventListener('click', () => setCat(c.key));
    bar.append(b);
  }
  const acct = el('button.tab', { type: 'button' }, ico('user'), el('span', {}, 'Account'));
  acct.addEventListener('click', () => openNav());
  bar.append(acct);
}
const openNav = () => {
  $('#sidebar').classList.add('open');
  $('#scrim').hidden = false;
  $('#navToggle').setAttribute('aria-expanded', 'true');
};
const closeNav = () => {
  $('#sidebar').classList.remove('open');
  $('#scrim').hidden = true;
  $('#navToggle').setAttribute('aria-expanded', 'false');
};

/* ── routing ──────────────────────────────────────────────── */
function route() {
  const m = (location.hash || '#/lobby').match(/^#\/game\/(.+)$/);
  if (m) renderGame(decodeURIComponent(m[1]));
  else renderLobby();
  closeNav();
}
addEventListener('hashchange', route);

/* ── account gate ─────────────────────────────────────────── */
function accountGate(onDone) {
  const overlay = el('div.gate');
  const card = el('div.gate-card');
  overlay.append(card);
  document.body.append(overlay);

  let mode = 'login';
  const userIn = el('input.auth-in', { type: 'text', placeholder: 'username', autocomplete: 'username', maxlength: 20 });
  const passIn = el('input.auth-in', { type: 'password', placeholder: 'password', autocomplete: 'current-password' });
  const pass2In = el('input.auth-in', { type: 'password', placeholder: 'repeat password', autocomplete: 'new-password' });
  const errEl = el('div.auth-err', { role: 'alert' });
  const submit = el('button.btn.btn-gold.btn-lg.btn-block', { type: 'button' }, 'LOG IN');

  const tabs = el('div.auth-tabs', {},
    ['login', 'signup'].map((m) => {
      const b = el('button.auth-tab' + (m === mode ? '.on' : ''), { type: 'button', dataset: { m } },
        m === 'login' ? 'Log in' : 'Create account');
      b.addEventListener('click', () => setMode(m));
      return b;
    }));

  function setMode(m) {
    mode = m;
    $$('.auth-tab', tabs).forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    pass2In.parentElement.hidden = m === 'login';
    passIn.setAttribute('autocomplete', m === 'login' ? 'current-password' : 'new-password');
    submit.textContent = m === 'login' ? 'LOG IN' : 'CREATE ACCOUNT';
    errEl.textContent = '';
  }

  async function go() {
    errEl.textContent = '';
    const u = userIn.value.trim(), p = passIn.value;
    submit.disabled = true; submit.textContent = 'WORKING…';
    try {
      if (mode === 'signup') {
        if (p !== pass2In.value) throw new Error('The two passwords do not match.');
        const err = validate(u, p);
        if (err) throw new Error(err);
        await auth.signUp(u, p);
        toast(`Welcome, ${u}! 10,000 play credits added.`, 'win');
      } else {
        await auth.logIn(u, p);
        toast(`Welcome back, ${u}.`);
      }
      overlay.remove();
      onDone();
    } catch (e) {
      errEl.textContent = e.message;
      submit.disabled = false;
      setMode(mode);
    }
  }
  submit.addEventListener('click', go);
  for (const i of [userIn, passIn, pass2In]) i.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });

  const guest = el('button.btn.btn-ghost.btn-block', { type: 'button' }, 'Continue as guest');
  guest.addEventListener('click', () => { auth.playAsGuest(); overlay.remove(); onDone(); });

  card.append(
    el('div.gate-logo', { 'aria-hidden': 'true' }, '🎰'),
    el('h1.gate-title', {}, 'NOVA', el('span', {}, 'CASINO')),
    el('p.gate-sub', {}, 'Your play balance is saved to this account'),
    tabs,
    el('div.auth-form', {},
      el('label.auth-row', {}, el('span', {}, 'Username'), userIn),
      el('label.auth-row', {}, el('span', {}, 'Password'), passIn),
      el('label.auth-row', { hidden: true }, el('span', {}, 'Repeat password'), pass2In),
      errEl, submit),
    el('div.auth-or', {}, 'OR'),
    guest,
    el('p.gate-help', {},
      'Accounts are stored ', el('b', {}, 'only in this browser'), ' — there is no server and nothing is uploaded. ',
      'Passwords are hashed with PBKDF2-SHA256 before being saved, but a device-local login is not real security. ',
      el('b', {}, 'Never reuse a password you use anywhere else.'), ' Clearing site data deletes the account and its play balance.'));

  setMode('login');
  setTimeout(() => userIn.focus(), 60);
}

/* ── account chip ─────────────────────────────────────────── */
function paintUser(session) {
  const chip = $('#userChip');
  clear(chip);
  if (!session) return;
  chip.append(
    el('span.uc-name', {}, ico('user'), session.guest ? 'Guest' : session.name),
    el('button.btn.btn-sm' + (session.guest ? '.btn-gold' : '.btn-ghost'), {
      type: 'button',
      'aria-label': session.guest ? 'Create an account' : 'Log out',
      onclick: () => { auth.logOut(); location.hash = '#/lobby'; location.reload(); },
    }, session.guest ? 'Sign up' : ico('logout')));
}

/* ── boot ─────────────────────────────────────────────────── */
function startSession() {
  const s = auth.session();
  wallet.useProfile(s ? s.key : 'guest');
  paintUser(s);
  paintNav();
  route();
}

function boot() {
  installRipple();
  $('#search').addEventListener('input', (e) => {
    query = e.target.value;
    if (location.hash.startsWith('#/game/')) location.hash = '#/lobby';
    else renderLobby();
  });
  $('#navToggle').addEventListener('click', () =>
    ($('#sidebar').classList.contains('open') ? closeNav() : openNav()));
  $('#scrim').addEventListener('click', closeNav);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });

  const sndBtn = $('#soundBtn');
  const paintSound = () => {
    sndBtn.innerHTML = sound.enabled
      ? '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6M21 9l-5 6"/></svg>';
    sndBtn.setAttribute('aria-label', sound.enabled ? 'Mute sound' : 'Unmute sound');
    sndBtn.classList.toggle('muted', !sound.enabled);
  };
  sndBtn.addEventListener('click', () => { sound.toggle(); paintSound(); });
  paintSound();

  $('#topupBtn').addEventListener('click', () => {
    wallet.topUp(5000);
    toast('+5,000 play credits. They are free and worthless — that is the point.', 'win');
  });
  $('#resetBtn').addEventListener('click', () => {
    if (confirm('Reset this account back to 10,000 play credits and clear session stats?')) {
      wallet.reset();
      toast('Account reset.');
    }
  });

  const gate = $('#ageGate');
  const afterAge = () => {
    gate.classList.add('hide');
    if (auth.session()) startSession();
    else accountGate(startSession);
  };
  if (wallet.ageOk) afterAge();
  else $('#ageAccept').addEventListener('click', () => { wallet.acceptAge(); afterAge(); });

  paintWallet({ balance: wallet.balance, ...wallet.stats });
}
boot();
