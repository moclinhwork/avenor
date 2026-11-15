// Máy chủ Avenor cho VPS: phục vụ giao diện (dist/), đăng nhập, lưu dữ liệu theo tài khoản,
// ảnh tải lên và đồng bộ Strava qua Strava API. Không cần thư viện ngoài (Node >= 22.13).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
const STATIC_DIR = process.env.STATIC_DIR || path.resolve('dist');
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SECURE = PUBLIC_URL.startsWith('https://');
const ALLOW_SIGNUP = process.env.ALLOW_SIGNUP === '1';
const STRAVA_ID = process.env.STRAVA_CLIENT_ID || '';
const STRAVA_SECRET = process.env.STRAVA_CLIENT_SECRET || '';
const SESSION_DAYS = 60;
const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE = !!(GOOGLE_ID && GOOGLE_SECRET);
const ALLOWED_EMAILS = String(process.env.ALLOWED_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
// Khi đã bật Google, mặc định tắt đăng nhập bằng mật khẩu (đặt PASSWORD_LOGIN=1 để giữ).
const PASSWORD_LOGIN = process.env.PASSWORD_LOGIN ? process.env.PASSWORD_LOGIN === '1' : !GOOGLE;

fs.mkdirSync(path.join(DATA_DIR, 'photos'), { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'avenor.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL COLLATE NOCASE, pass TEXT NOT NULL, created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS docs (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL, json TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (user_id, id));
  CREATE TABLE IF NOT EXISTS strava (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, athlete TEXT, access TEXT NOT NULL, refresh TEXT NOT NULL, expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, created INTEGER NOT NULL);
`);
db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
if (!db.prepare("SELECT 1 FROM pragma_table_info('users') WHERE name = 'email'").get()) db.exec('ALTER TABLE users ADD COLUMN email TEXT');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email)');

// ---------- tiện ích ----------
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const newId = () => crypto.randomBytes(12).toString('base64url');
function hashPass(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}
function checkPass(pw, stored) {
  const [, s, k] = String(stored).split('$');
  if (!s || !k) return false;
  const key = crypto.scryptSync(pw, Buffer.from(s, 'base64'), 64, { N: 16384, r: 8, p: 1 });
  const want = Buffer.from(k, 'base64');
  return want.length === key.length && crypto.timingSafeEqual(want, key);
}
const cookies = (req) => Object.fromEntries(String(req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
const cookie = (name, val, maxAge) => `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${SECURE ? '; Secure' : ''}`;
function send(res, status, body, headers = {}) {
  const data = body === undefined ? '' : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}
const fail = (res, status, code) => send(res, status, { error: code });
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('too_large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req, limit = 4 << 20) {
  try { return JSON.parse((await readBody(req, limit)).toString('utf8') || '{}'); } catch (e) { if (e.status) throw e; throw Object.assign(new Error('bad_json'), { status: 400 }); }
}

// Giới hạn số lần đăng nhập sai theo IP.
const attempts = new Map();
function limited(ip) {
  const now = Date.now(); const a = attempts.get(ip) || { n: 0, t: now };
  if (now - a.t > 15 * 60e3) { a.n = 0; a.t = now; }
  attempts.set(ip, a);
  return a.n >= 10;
}
const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

function sessionUser(req) {
  const t = cookies(req).avenor_session;
  if (!t) return null;
  const row = db.prepare('SELECT u.id, u.username, s.expires FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(sha(t));
  if (!row || row.expires < Date.now()) return null;
  return { id: row.id, username: row.username };
}
function startSession(res, userId) {
  const t = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)').run(sha(t), userId, Date.now() + SESSION_DAYS * 864e5);
  return cookie('avenor_session', t, SESSION_DAYS * 86400);
}

// ---------- Strava ----------
async function stravaToken(userId) {
  const row = db.prepare('SELECT * FROM strava WHERE user_id = ?').get(userId);
  if (!row) return null;
  if (row.expires * 1000 > Date.now() + 60e3) return row.access;
  const r = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: STRAVA_ID, client_secret: STRAVA_SECRET, grant_type: 'refresh_token', refresh_token: row.refresh }),
  });
  if (!r.ok) { if (r.status === 400 || r.status === 401) db.prepare('DELETE FROM strava WHERE user_id = ?').run(userId); return null; }
  const j = await r.json();
  db.prepare('UPDATE strava SET access = ?, refresh = ?, expires = ? WHERE user_id = ?').run(j.access_token, j.refresh_token, j.expires_at, userId);
  return j.access_token;
}

// ---------- tuyến API ----------
async function api(req, res, url) {
  const p = url.pathname;
  const m = req.method;
  // Chống CSRF: mọi yêu cầu ghi phải có header riêng (trình duyệt không tự gửi từ trang khác).
  if (m !== 'GET' && m !== 'HEAD' && req.headers['x-avenor'] !== '1') return fail(res, 403, 'csrf');

  if (p === '/api/health') return send(res, 200, { ok: true });

  if (p === '/api/me' && m === 'GET') {
    const u = sessionUser(req);
    const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    return send(res, 200, { user: u, canSignup: PASSWORD_LOGIN && (ALLOW_SIGNUP || users === 0), password: PASSWORD_LOGIN, google: GOOGLE, strava: !!(STRAVA_ID && STRAVA_SECRET) });
  }
  if (p === '/api/auth/google' && m === 'GET') {
    if (!GOOGLE) return fail(res, 503, 'google_not_configured');
    const state = crypto.randomBytes(16).toString('base64url');
    const q = new URLSearchParams({ client_id: GOOGLE_ID, redirect_uri: `${PUBLIC_URL}/api/auth/google/callback`, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
    return send(res, 302, '', { Location: `https://accounts.google.com/o/oauth2/v2/auth?${q}`, 'Set-Cookie': cookie('avenor_g_state', state, 600) });
  }
  if (p === '/api/auth/google/callback' && m === 'GET') {
    const back = (err, extra = []) => send(res, 302, '', { Location: err ? `/#login?err=${err}` : '/', 'Set-Cookie': [cookie('avenor_g_state', '', 0), ...extra] });
    const state = url.searchParams.get('state');
    if (!GOOGLE || !state || state !== cookies(req).avenor_g_state) return back('state');
    if (url.searchParams.get('error')) return back('denied');
    const tr = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: url.searchParams.get('code') || '', client_id: GOOGLE_ID, client_secret: GOOGLE_SECRET, redirect_uri: `${PUBLIC_URL}/api/auth/google/callback`, grant_type: 'authorization_code' }),
    });
    if (!tr.ok) return back('token');
    const tok = await tr.json();
    const ur = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } });
    if (!ur.ok) return back('token');
    const info = await ur.json();
    const email = String(info.email || '').toLowerCase();
    if (!email || info.email_verified !== true) return back('unverified');
    if (!ALLOWED_EMAILS.includes(email)) return back('not_allowed');
    let row = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!row) {
      const id = newId();
      db.prepare('INSERT INTO users (id, username, pass, created, email) VALUES (?, ?, ?, ?, ?)').run(id, email, '!google', Date.now(), email);
      row = { id };
    }
    return back(null, [startSession(res, row.id)]);
  }
  if ((p === '/api/signup' || p === '/api/login') && m === 'POST' && !PASSWORD_LOGIN) return fail(res, 403, 'password_disabled');
  if (p === '/api/signup' && m === 'POST') {
    const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    if (!ALLOW_SIGNUP && users > 0) return fail(res, 403, 'signup_closed');
    const { username, password } = await readJson(req, 4096);
    const name = String(username || '').trim();
    if (!/^[\p{L}\p{N}._@-]{3,40}$/u.test(name)) return fail(res, 400, 'bad_username');
    if (String(password || '').length < 8) return fail(res, 400, 'weak_password');
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(name)) return fail(res, 409, 'taken');
    const id = newId();
    db.prepare('INSERT INTO users (id, username, pass, created) VALUES (?, ?, ?, ?)').run(id, name, hashPass(String(password)), Date.now());
    return send(res, 200, { user: { id, username: name } }, { 'Set-Cookie': startSession(res, id) });
  }
  if (p === '/api/login' && m === 'POST') {
    const ip = clientIp(req);
    if (limited(ip)) return fail(res, 429, 'too_many');
    const { username, password } = await readJson(req, 4096);
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').trim());
    if (!row || !checkPass(String(password || ''), row.pass)) { attempts.get(ip).n++; return fail(res, 401, 'bad_login'); }
    attempts.delete(ip);
    return send(res, 200, { user: { id: row.id, username: row.username } }, { 'Set-Cookie': startSession(res, row.id) });
  }
  if (p === '/api/logout' && m === 'POST') {
    const t = cookies(req).avenor_session;
    if (t) db.prepare('DELETE FROM sessions WHERE token = ?').run(sha(t));
    return send(res, 200, { ok: true }, { 'Set-Cookie': cookie('avenor_session', '', 0) });
  }

  // Strava callback được trình duyệt mở trực tiếp nên cần phiên đăng nhập.
  const user = sessionUser(req);
  if (!user) return fail(res, 401, 'auth');

  if (p === '/api/password' && m === 'POST') {
    if (!PASSWORD_LOGIN) return fail(res, 403, 'password_disabled');
    const { current, next } = await readJson(req, 4096);
    const row = db.prepare('SELECT pass FROM users WHERE id = ?').get(user.id);
    if (!checkPass(String(current || ''), row.pass)) return fail(res, 401, 'bad_login');
    if (String(next || '').length < 8) return fail(res, 400, 'weak_password');
    db.prepare('UPDATE users SET pass = ? WHERE id = ?').run(hashPass(String(next)), user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    return send(res, 200, { ok: true }, { 'Set-Cookie': startSession(res, user.id) });
  }

  // Dữ liệu: mỗi module một tài liệu JSON.
  if (p === '/api/data' && m === 'GET') {
    const since = Number(url.searchParams.get('since') || 0);
    const rows = db.prepare('SELECT id, json, updated FROM docs WHERE user_id = ? AND updated > ?').all(user.id, since);
    const total = db.prepare('SELECT COUNT(*) AS n FROM docs WHERE user_id = ?').get(user.id).n;
    return send(res, 200, { docs: rows, total, now: Date.now() });
  }
  const dm = p.match(/^\/api\/data\/([a-z][a-z0-9_-]{0,40})$/);
  if (dm && m === 'PUT') {
    const { json } = await readJson(req, 8 << 20);
    if (typeof json !== 'string') return fail(res, 400, 'bad_doc');
    try { JSON.parse(json); } catch { return fail(res, 400, 'bad_doc'); }
    const updated = Date.now();
    db.prepare('INSERT INTO docs (user_id, id, json, updated) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, id) DO UPDATE SET json = excluded.json, updated = excluded.updated').run(user.id, dm[1], json, updated);
    return send(res, 200, { updated });
  }

  // Ảnh
  if (p === '/api/photos' && m === 'POST') {
    const type = String(req.headers['content-type'] || '');
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return fail(res, 415, 'not_image');
    const buf = await readBody(req, 8 << 20);
    const id = newId();
    fs.writeFileSync(path.join(DATA_DIR, 'photos', id), buf);
    db.prepare('INSERT INTO photos (id, user_id, type, created) VALUES (?, ?, ?, ?)').run(id, user.id, type, Date.now());
    return send(res, 200, { id, url: `/api/photos/${id}` });
  }
  const pm = p.match(/^\/api\/photos\/([A-Za-z0-9_-]{8,40})$/);
  if (pm) {
    const row = db.prepare('SELECT * FROM photos WHERE id = ? AND user_id = ?').get(pm[1], user.id);
    if (!row) return fail(res, 404, 'not_found');
    const file = path.join(DATA_DIR, 'photos', row.id);
    if (m === 'GET') return send(res, 200, fs.readFileSync(file), { 'Content-Type': row.type, 'Cache-Control': 'private, max-age=31536000, immutable' });
    if (m === 'DELETE') { fs.rmSync(file, { force: true }); db.prepare('DELETE FROM photos WHERE id = ?').run(row.id); return send(res, 200, { ok: true }); }
  }

  // Strava
  if (p === '/api/strava/status' && m === 'GET') {
    const row = db.prepare('SELECT athlete FROM strava WHERE user_id = ?').get(user.id);
    return send(res, 200, { configured: !!(STRAVA_ID && STRAVA_SECRET), connected: !!row, athlete: row?.athlete || null });
  }
  if (p === '/api/strava/connect' && m === 'GET') {
    if (!STRAVA_ID) return fail(res, 503, 'strava_not_configured');
    const state = crypto.randomBytes(16).toString('base64url');
    const q = new URLSearchParams({ client_id: STRAVA_ID, response_type: 'code', redirect_uri: `${PUBLIC_URL}/api/strava/callback`, approval_prompt: 'auto', scope: 'read,activity:read_all', state });
    return send(res, 302, '', { Location: `https://www.strava.com/oauth/authorize?${q}`, 'Set-Cookie': cookie('avenor_strava_state', state, 600) });
  }
  if (p === '/api/strava/callback' && m === 'GET') {
    const back = (r) => send(res, 302, '', { Location: `/#health?strava=${r}`, 'Set-Cookie': cookie('avenor_strava_state', '', 0) });
    const state = url.searchParams.get('state');
    if (!state || state !== cookies(req).avenor_strava_state) return back('state');
    if (url.searchParams.get('error')) return back('denied');
    const scope = url.searchParams.get('scope') || '';
    if (!scope.includes('activity:read')) return back('scope');
    const r = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: STRAVA_ID, client_secret: STRAVA_SECRET, code: url.searchParams.get('code'), grant_type: 'authorization_code' }),
    });
    if (!r.ok) return back('token');
    const j = await r.json();
    const athlete = [j.athlete?.firstname, j.athlete?.lastname].filter(Boolean).join(' ') || null;
    db.prepare('INSERT INTO strava (user_id, athlete, access, refresh, expires) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET athlete = excluded.athlete, access = excluded.access, refresh = excluded.refresh, expires = excluded.expires')
      .run(user.id, athlete, j.access_token, j.refresh_token, j.expires_at);
    return back('ok');
  }
  if (p === '/api/strava/disconnect' && m === 'POST') {
    const tok = await stravaToken(user.id).catch(() => null);
    if (tok) await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { Authorization: `Bearer ${tok}` } }).catch(() => {});
    db.prepare('DELETE FROM strava WHERE user_id = ?').run(user.id);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/strava/activities' && m === 'GET') {
    const tok = await stravaToken(user.id);
    if (!tok) return fail(res, 409, 'strava_not_connected');
    const after = Math.max(0, Number(url.searchParams.get('after') || 0));
    const out = [];
    for (let page = 1; page <= 5; page++) {
      const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`, { headers: { Authorization: `Bearer ${tok}` } });
      if (r.status === 429) return fail(res, 429, 'rate_limited');
      if (r.status === 401) return fail(res, 409, 'strava_not_connected');
      if (!r.ok) return fail(res, 502, 'strava_error');
      const list = await r.json();
      out.push(...list.map((a) => ({ id: a.id, name: a.name, sport_type: a.sport_type, type: a.type, distance: a.distance, moving_time: a.moving_time, start_date_local: a.start_date_local })));
      if (list.length < 100) break;
    }
    return send(res, 200, { activities: out });
  }
  return fail(res, 404, 'not_found');
}

// ---------- tệp tĩnh ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
};
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  let file = path.join(STATIC_DIR, path.normalize(rel).replace(/^([.][.][/\\])+/, ''));
  if (!file.startsWith(STATIC_DIR)) return fail(res, 400, 'bad_path');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(STATIC_DIR, 'index.html');
  const ext = path.extname(file);
  const immutable = file.includes(`${path.sep}assets${path.sep}`);
  res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache', ...SEC_HEADERS });
  fs.createReadStream(file).pipe(res);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else if (req.method === 'GET' || req.method === 'HEAD') serveStatic(req, res, url);
    else fail(res, 405, 'method');
  } catch (e) {
    if (!res.headersSent) fail(res, e.status || 500, e.status ? e.message : 'server_error');
    if (!e.status) console.error(e);
  }
}).listen(PORT, () => console.log(`Avenor chạy tại cổng ${PORT} (${PUBLIC_URL})`));
