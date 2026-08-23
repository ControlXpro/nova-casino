/* Nova Casino — lobby, routing, wallet UI, account gate. */
import { el, $, $$, clear, fmt, wallet, onWallet, toast } from './core.js';
import { auth, validate } from './auth.js';
import { slotGames } from './games/slots.js';
import { cardGames } from './games/cards.js';
import { tableGames } from './games/table.js';
import { instantGames } from './games/instant.js';

const GAMES = [...instantGames, ...cardGames, ...tableGames, ...slotGames];
const byId = new Map(GAMES.map((g) => [g.id, g]));

const CATS = [
  { key: 'all', icon: '🏠', label: 'All Games' },
  { key: 'popular', icon: '🔥', label: 'Popular' },
  { key: 'slots', icon: '🎰', label: 'Slots' },
  { key: 'table', icon: '🃏', label: 'Table' },
  { key: 'poker', icon: '♠️', label: 'Poker' },
  { key: 'instant', icon: '⚡', label: 'Instant' },
  { key: 'lottery', icon: '🎫', label: 'Lottery' },
];
const countIn = (k) => (k === 'all' ? GAMES.length
  : k === 'popular' ? GAMES.filter((g) => g.tags?.length).length
  : GAMES.filter((g) => g.cat === k).length);

let cat = 'all';
let query = '';

/* ---------------- wallet UI ---------------- */
const balEl = $('#balance');
function paintWallet(state, dir) {
  balEl.textContent = fmt(state.balance);
  balEl.classList.remove('flash-up', 'flash-dn');
  void balEl.offsetWidth;
  if (dir) balEl.classList.add(dir === 'up' ? 'flash-up' : 'flash-dn');
  $('#statWagered').textContent = fmt(state.wagered);
  $('#statReturned').textContent = fmt(state.returned);
  const net = state.returned - state.wagered;
  const netEl = $('#statNet');
  netEl.textContent = (net >= 0 ? '+' : '') + fmt(net);
  netEl.style.color = net > 0 ? 'var(--win)' : net < 0 ? 'var(--lose)' : '';
  $('#statRounds').textContent = state.rounds;
}
onWallet(paintWallet);

/* ---------------- lobby ---------------- */
function gameCard(g) {
  const badge = g.tags?.includes('hot') ? el('div.badge.hot', {}, 'HOT')
    : g.tags?.includes('new') ? el('div.badge.new', {}, 'NEW') : null;
  const card = el('button.card', { type: 'button', title: g.name },
    badge,
    el('div.card-art', { style: { background: g.art } }, g.icon),
    el('div.card-body', {},
      el('div.card-title', {}, g.name),
      el('div.card-meta', {}, el('span', {}, `RTP ${g.rtp}%`), el('span', {}, g.vol))));
  card.addEventListener('click', () => { location.hash = '#/game/' + g.id; });
  return card;
}
function section(title, list) {
  if (!list.length) return null;
  return el('div', {},
    el('div.sec-head', {}, el('h3', {}, title), el('span', {}, `${list.length} games`)),
    el('div.grid', {}, list.map(gameCard)));
}
function renderLobby() {
  const lobby = $('#lobby');
  clear(lobby);
  $('#gameView').hidden = true;
  lobby.hidden = false;

  const q = query.trim().toLowerCase();
  let list = GAMES;
  if (q) list = GAMES.filter((g) => g.name.toLowerCase().includes(q) || g.cat.includes(q));
  else if (cat === 'popular') list = GAMES.filter((g) => g.tags?.length);
  else if (cat !== 'all') list = GAMES.filter((g) => g.cat === cat);

  if (q) {
    lobby.append(section(`Results for “${query}”`, list));
    if (!list.length) lobby.append(el('div.empty', {}, `Nothing matches “${query}”. Try “slot”, “poker” or “dice”.`));
    return;
  }

  if (cat === 'all') {
    lobby.append(el('div.hero', {},
      el('h2', {}, 'Play ', el('em', {}, `${GAMES.length} casino games`), ' — for free.'),
      el('p', {}, 'Slots, blackjack, roulette, video poker, crash, mines and more. Every balance is play credits: nothing here costs money, and nothing here pays money.'),
      el('div.hero-tags', {},
        el('span.tag', {}, '🎰 28 slots'),
        el('span.tag', {}, '🃏 Live-style tables'),
        el('span.tag', {}, '⚡ Instant games'),
        el('span.tag', {}, '🔒 No deposits, ever'))));
    lobby.append(section('🔥 Popular now', GAMES.filter((g) => g.tags?.length)));
    lobby.append(section('⚡ Instant win', GAMES.filter((g) => g.cat === 'instant')));
    lobby.append(section('🃏 Table games', GAMES.filter((g) => g.cat === 'table')));
    lobby.append(section('♠️ Poker', GAMES.filter((g) => g.cat === 'poker')));
    lobby.append(section('🎫 Lottery & scratch', GAMES.filter((g) => g.cat === 'lottery')));
    lobby.append(section('🎰 Slots', GAMES.filter((g) => g.cat === 'slots')));
  } else {
    lobby.append(section(CATS.find((c) => c.key === cat).label, list));
  }
}

/* ---------------- game view ---------------- */
function renderGame(id) {
  const g = byId.get(id);
  if (!g) { location.hash = '#/lobby'; return; }
  const view = $('#gameView');
  clear(view);
  $('#lobby').hidden = true;
  view.hidden = false;

  const stage = el('div.stage');
  view.append(
    el('div.gv-head', {},
      el('div.gv-ico', {}, g.icon),
      el('div', {}, el('h2', {}, g.name),
        el('div.gv-sub', {}, `${g.cat.toUpperCase()} · RTP ${g.rtp}% · volatility ${g.vol}`)),
      el('a.btn.btn-ghost.gv-back', { href: '#/lobby' }, '← Lobby')),
    stage);

  try {
    g.mount(stage);
  } catch (err) {
    console.error(err);
    stage.append(el('div.empty', {}, 'This game failed to load. Please refresh the page.'));
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------------- routing ---------------- */
function route() {
  const h = location.hash || '#/lobby';
  const m = h.match(/^#\/game\/(.+)$/);
  if (m) renderGame(decodeURIComponent(m[1]));
  else { renderLobby(); }
  $('#sidebar').classList.remove('open');
}
addEventListener('hashchange', route);

/* ---------------- sidebar ---------------- */
function buildNav() {
  const nav = $('#catNav');
  clear(nav);
  for (const c of CATS) {
    const b = el('button.cat-btn' + (c.key === cat ? '.on' : ''), { type: 'button' },
      el('i', {}, c.icon), c.label, el('u', {}, countIn(c.key)));
    b.addEventListener('click', () => {
      cat = c.key; query = ''; $('#search').value = '';
      buildNav();
      if (location.hash.startsWith('#/game/')) location.hash = '#/lobby';
      else renderLobby();
    });
    nav.append(b);
  }
}

/* ---------------- account gate ---------------- */
function accountGate(onDone) {
  const overlay = el('div.age-gate');
  const card = el('div.age-card');
  overlay.append(card);
  document.body.append(overlay);

  let mode = 'login';
  const userIn = el('input.auth-in', { type: 'text', placeholder: 'username', autocomplete: 'username', maxlength: 20 });
  const passIn = el('input.auth-in', { type: 'password', placeholder: 'password', autocomplete: 'current-password' });
  const pass2In = el('input.auth-in', { type: 'password', placeholder: 'repeat password', autocomplete: 'new-password' });
  const errEl = el('div.auth-err');
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
    el('div.age-logo', {}, '🎰'),
    el('h1', {}, 'NOVA ', el('span', {}, 'CASINO')),
    el('p.age-sub', {}, 'Your play balance is saved to this account'),
    tabs,
    el('div.auth-form', {},
      el('label.auth-row', {}, el('span', {}, 'USERNAME'), userIn),
      el('label.auth-row', {}, el('span', {}, 'PASSWORD'), passIn),
      el('label.auth-row', { hidden: mode === 'login' }, el('span', {}, 'REPEAT PASSWORD'), pass2In),
      errEl, submit),
    el('div.auth-or', {}, 'or'),
    guest,
    el('p.age-help', {},
      'Accounts are stored ', el('b', {}, 'only in this browser'), ' — there is no server and nothing is uploaded. ',
      'Passwords are hashed with PBKDF2-SHA256 before being saved, but a device-local login is not real security. ',
      el('b', {}, 'Never reuse a password you use anywhere else.'), ' Clearing site data deletes the account and its play balance.'));

  setMode('login');
  setTimeout(() => userIn.focus(), 60);
}

/* ---------------- account chip ---------------- */
function paintUser(session) {
  const chip = $('#userChip');
  clear(chip);
  if (!session) return;
  chip.append(
    el('span.uc-name', {}, session.guest ? '👤 Guest' : '👤 ' + session.name),
    el('button.btn.btn-ghost.btn-sm', {
      type: 'button',
      onclick: () => {
        auth.logOut();
        location.hash = '#/lobby';
        location.reload();
      },
    }, session.guest ? 'Sign up' : 'Log out'));
}

/* ---------------- boot ---------------- */
function startSession() {
  const s = auth.session();
  wallet.useProfile(s ? s.key : 'guest');
  paintUser(s);
  buildNav();
  route();
}

function boot() {
  $('#search').addEventListener('input', (e) => {
    query = e.target.value;
    if (location.hash.startsWith('#/game/')) location.hash = '#/lobby';
    else renderLobby();
  });
  $('#navToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
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
