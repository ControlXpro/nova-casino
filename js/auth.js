/* Local player accounts.
   IMPORTANT: this is a static site with no backend. Accounts live only in this
   browser's localStorage. Passwords are never stored in the clear — they are
   stretched with PBKDF2-SHA256 (210k iterations, per-user random salt) and only
   the digest is kept — but a device-local store is NOT real authentication and
   offers no protection against anyone with access to this machine.
   Players are told exactly that on the sign-up screen. */

const ACC_KEY = 'nova.accounts.v1';
const SESSION_KEY = 'nova.session.v1';
const ITERATIONS = 210000;

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function readAll() {
  try { return JSON.parse(localStorage.getItem(ACC_KEY) || '{}'); } catch { return {}; }
}
function writeAll(obj) {
  try { localStorage.setItem(ACC_KEY, JSON.stringify(obj)); return true; }
  catch { return false; }
}

async function derive(password, saltBytes, iterations = ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' }, keyMaterial, 256);
  return b64(bits);
}

/** Constant-time-ish string compare so a wrong password does not leak position. */
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function validate(username, password) {
  if (!USERNAME_RE.test(username)) return 'Username must be 3–20 letters, numbers or underscores.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 200) return 'Password is too long.';
  if (/^\d+$/.test(password)) return 'Use more than digits — add letters or symbols.';
  return null;
}

export const auth = {
  count() { return Object.keys(readAll()).length; },

  exists(username) { return !!readAll()[username.toLowerCase()]; },

  async signUp(username, password) {
    const err = validate(username, password);
    if (err) throw new Error(err);
    const all = readAll();
    const key = username.toLowerCase();
    if (all[key]) throw new Error('That username is already taken on this device.');

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(password, salt);
    all[key] = {
      u: username, salt: b64(salt), hash, iter: ITERATIONS,
      created: new Date().toISOString(), fails: 0, lockUntil: 0,
    };
    if (!writeAll(all)) throw new Error('Could not save the account — browser storage is full or blocked.');
    this.setSession(key);
    return all[key];
  },

  async logIn(username, password) {
    const all = readAll();
    const key = username.toLowerCase();
    const rec = all[key];
    // Always run the KDF so a missing user costs the same time as a wrong password.
    const salt = rec ? unb64(rec.salt) : new Uint8Array(16);
    const hash = await derive(password, salt, rec?.iter || ITERATIONS);

    if (!rec) throw new Error('No account with that username on this device.');
    if (rec.lockUntil && Date.now() < rec.lockUntil) {
      const secs = Math.ceil((rec.lockUntil - Date.now()) / 1000);
      throw new Error(`Too many attempts. Try again in ${secs}s.`);
    }
    if (!safeEqual(hash, rec.hash)) {
      rec.fails = (rec.fails || 0) + 1;
      if (rec.fails >= 5) { rec.lockUntil = Date.now() + 30000; rec.fails = 0; }
      writeAll(all);
      throw new Error('Incorrect password.');
    }
    rec.fails = 0; rec.lockUntil = 0; rec.lastLogin = new Date().toISOString();
    writeAll(all);
    this.setSession(key);
    return rec;
  },

  async changePassword(username, oldPassword, newPassword) {
    await this.logIn(username, oldPassword);
    const err = validate(username, newPassword);
    if (err) throw new Error(err);
    const all = readAll();
    const rec = all[username.toLowerCase()];
    const salt = crypto.getRandomValues(new Uint8Array(16));
    rec.salt = b64(salt); rec.hash = await derive(newPassword, salt); rec.iter = ITERATIONS;
    writeAll(all);
  },

  /** Deletes the login record. The play balance under that profile is removed too. */
  deleteAccount(username) {
    const all = readAll();
    const key = username.toLowerCase();
    delete all[key];
    writeAll(all);
    try { localStorage.removeItem(`nova.casino.v1:${key}`); } catch { /* ignore */ }
    if (this.session()?.key === key) this.logOut();
  },

  setSession(key) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ key, at: Date.now() })); } catch { /* ignore */ }
  },
  session() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!s) return null;
      if (s.key === 'guest') return { key: 'guest', name: 'Guest', guest: true };
      const rec = readAll()[s.key];
      return rec ? { key: s.key, name: rec.u, created: rec.created } : null;
    } catch { return null; }
  },
  playAsGuest() { this.setSession('guest'); return { key: 'guest', name: 'Guest', guest: true }; },
  logOut() { try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } },
};
