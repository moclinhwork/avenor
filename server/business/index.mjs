// Business: API cho module Business của Avenor (/api/business/*).
// - Quyền: chỉ tài khoản trong BUSINESS_USERS (tên đăng nhập hoặc email, cách nhau dấu phẩy); để trống = tài khoản tạo đầu tiên.
// - Token OAuth mã hoá AES-256-GCM bằng khoá data/business.key (quyền 600), không bao giờ trả về trình duyệt.
// - Số liệu bên ngoài lưu theo ngày trong biz_daily; màn hình chỉ đọc từ đây. Đồng bộ chạy nền theo lịch của từng nguồn,
//   hoặc khi bấm làm mới (tối thiểu 2 phút giữa hai lần, một nguồn chỉ một lượt đồng bộ cùng lúc).
// - Lỗi đồng bộ: giữ nguyên số liệu thành công gần nhất, ghi trạng thái và thời điểm.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { SOURCES, AuthError, http, GOOGLE_ID, GOOGLE_SECRET, GOOGLE_SCOPES, googleRefresh, META_ID, META_SECRET, META_SERVER_TOKEN, TIKTOK_KEY, TIKTOK_SECRET, TIKTOK_SCOPES, tiktokRefresh } from './sources.mjs';
import { salesRange, salesInfo, SALES_URL, SALES_DB, EXCLUDE } from './sales.mjs';

export const BIZ_TZ = 'Asia/Ho_Chi_Minh';
const MANUAL_GAP = 2 * 60e3;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Ngày theo múi giờ bất kỳ, dạng YYYY-MM-DD.
export const dayIn = (tz, t = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: tz || BIZ_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
export const addDay = (d, k) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };
export const spanDays = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5) + 1;

export function setupBusiness({ db, dataDir, publicUrl, send, fail, readJson, cookie, cookies }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS biz_cred (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider TEXT NOT NULL, label TEXT, scopes TEXT, enc TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS biz_conn (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, name TEXT NOT NULL, cred_id TEXT,
      account_id TEXT NOT NULL, account_name TEXT, tz TEXT, currency TEXT, status TEXT NOT NULL, error TEXT, last_ok INTEGER, last_try INTEGER, meta TEXT, created INTEGER NOT NULL, UNIQUE (user_id, type, account_id));
    CREATE TABLE IF NOT EXISTS biz_daily (conn_id TEXT NOT NULL REFERENCES biz_conn(id) ON DELETE CASCADE, d TEXT NOT NULL, json TEXT NOT NULL, fetched INTEGER NOT NULL, PRIMARY KEY (conn_id, d));
    CREATE TABLE IF NOT EXISTS biz_extra (conn_id TEXT NOT NULL REFERENCES biz_conn(id) ON DELETE CASCADE, k TEXT NOT NULL, json TEXT NOT NULL, fetched INTEGER NOT NULL, PRIMARY KEY (conn_id, k));
  `);

  // ---------- khoá mã hoá token ----------
  const keyFile = path.join(dataDir, 'business.key');
  if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(32).toString('base64'), { mode: 0o600 });
  const KEY = Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'base64');
  const seal = (obj) => { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', KEY, iv); const b = Buffer.concat([c.update(JSON.stringify(obj)), c.final()]); return [iv, c.getAuthTag(), b].map((x) => x.toString('base64')).join('.'); };
  const unseal = (s) => { const [iv, tag, b] = s.split('.').map((x) => Buffer.from(x, 'base64')); const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv); d.setAuthTag(tag); return JSON.parse(Buffer.concat([d.update(b), d.final()]).toString('utf8')); };
  const newId = () => crypto.randomBytes(9).toString('base64url');

  // ---------- quyền ----------
  const ALLOWED = String(process.env.BUSINESS_USERS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  function allowed(user) {
    if (ALLOWED.length) {
      const row = db.prepare('SELECT username, email FROM users WHERE id = ?').get(user.id);
      return !!row && (ALLOWED.includes(String(row.username).toLowerCase()) || (row.email && ALLOWED.includes(row.email.toLowerCase())));
    }
    return db.prepare('SELECT id FROM users ORDER BY created LIMIT 1').get()?.id === user.id;
  }

  // ---------- nhà cung cấp OAuth ----------
  const PROVIDERS = {
    google: { ready: () => !!(GOOGLE_ID && GOOGLE_SECRET), refresh: googleRefresh },
    meta: { ready: () => !!(META_SERVER_TOKEN || (META_ID && META_SECRET)), refresh: null },
    tiktok: { ready: () => !!(TIKTOK_KEY && TIKTOK_SECRET), refresh: tiktokRefresh },
  };
  const redirect = (p) => `${publicUrl}/api/business/oauth/${p}/callback`;

  function credRow(id, userId) { return db.prepare('SELECT * FROM biz_cred WHERE id = ? AND user_id = ?').get(id, userId); }
  function saveCred(userId, provider, label, scopes, tok, existingId) {
    const now = Date.now();
    const same = existingId ? credRow(existingId, userId) : db.prepare('SELECT * FROM biz_cred WHERE user_id = ? AND provider = ? AND label = ?').get(userId, provider, label || '');
    if (same) {
      const old = unseal(same.enc);
      db.prepare('UPDATE biz_cred SET enc = ?, scopes = ?, label = ?, updated = ? WHERE id = ?').run(seal({ ...tok, refresh: tok.refresh || old.refresh }), scopes, label || same.label, now, same.id);
      // Đăng nhập lại: các kết nối dùng thông tin này hết "Needs authorization".
      db.prepare("UPDATE biz_conn SET status = 'connected', error = NULL WHERE cred_id = ? AND status = 'needs_auth'").run(same.id);
      return same.id;
    }
    const id = newId();
    db.prepare('INSERT INTO biz_cred (id, user_id, provider, label, scopes, enc, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, userId, provider, label || '', scopes, seal(tok), now, now);
    return id;
  }
  // Token Meta của máy chủ (System User, đặt bằng deploy/set-business.sh) dùng như một thông tin đăng nhập cố định.
  function metaServerCred(userId) {
    if (!META_SERVER_TOKEN) return null;
    const row = db.prepare("SELECT id FROM biz_cred WHERE user_id = ? AND provider = 'meta' AND label = 'server-token'").get(userId);
    if (row) return row.id;
    return saveCred(userId, 'meta', 'server-token', 'ads_read', { access: META_SERVER_TOKEN, server: true });
  }

  async function accessFor(cred) {
    let tok = unseal(cred.enc);
    if (tok.server && cred.provider === 'meta') return META_SERVER_TOKEN || tok.access;
    if (tok.expires && tok.expires < Date.now() + 30e3) {
      const p = PROVIDERS[cred.provider];
      if (!p?.refresh || !tok.refresh) throw new AuthError();
      tok = await p.refresh(tok);
      db.prepare('UPDATE biz_cred SET enc = ?, updated = ? WHERE id = ?').run(seal(tok), Date.now(), cred.id);
    }
    return tok.access;
  }

  // ---------- kết nối ----------
  const parseConn = (r) => r && ({ ...r, meta: r.meta ? JSON.parse(r.meta) : {} });
  const connOf = (id, userId) => parseConn(db.prepare('SELECT * FROM biz_conn WHERE id = ? AND user_id = ?').get(id, userId));
  function publicConn(c) {
    const src = c.type === 'sales' ? null : SOURCES[c.type];
    return {
      id: c.id, type: c.type, name: c.name, accountId: c.account_id, accountName: c.account_name, tz: c.tz || src?.reportTz || BIZ_TZ, currency: c.currency || '',
      status: inflight.has(c.id) ? 'syncing' : c.status, error: c.error || null, lastOk: c.last_ok || null, lastTry: c.last_try || null,
      syncEveryH: c.type === 'sales' ? 0 : src?.syncEveryH || 6, reportTz: src?.reportTz || null, snapshot: !!src?.snapshot, lagDays: src?.lagDays || 0,
      openUrl: c.type === 'sales' ? SALES_URL : src?.open?.(c) || null, studioUrl: src?.studio?.(c) || null,
      meta: { hasConversions: c.meta.hasConversions ?? null, conversionLabel: c.meta.conversionLabel || null, subscribers: c.meta.subscribers ?? null, statsAt: c.meta.statsAt || null, username: c.meta.username || null, thumb: c.meta.thumb || null, handle: c.meta.handle || null },
    };
  }
  const setStatus = (id, status, error) => db.prepare('UPDATE biz_conn SET status = ?, error = ? WHERE id = ?').run(status, error || null, id);

  // ---------- đồng bộ ----------
  const inflight = new Map();
  function sync(conn, { from, to, manual } = {}) {
    if (inflight.has(conn.id)) return inflight.get(conn.id);
    const src = SOURCES[conn.type];
    const job = (async () => {
      const now = Date.now();
      db.prepare('UPDATE biz_conn SET last_try = ? WHERE id = ?').run(now, conn.id);
      try {
        const cred = conn.cred_id && db.prepare('SELECT * FROM biz_cred WHERE id = ?').get(conn.cred_id);
        if (!cred) throw new AuthError();
        const access = await accessFor(cred);
        const tz = src.reportTz || conn.tz || BIZ_TZ;
        const today = dayIn(tz);
        const first = !conn.last_ok;
        const end = to && to < today ? to : today;
        const start = from || addDay(today, -((first ? src.initial : src.lookback) - 1));
        const r = await src.daily(conn, access, start, end, dayIn(BIZ_TZ));
        const up = db.prepare('INSERT INTO biz_daily (conn_id, d, json, fetched) VALUES (?, ?, ?, ?) ON CONFLICT(conn_id, d) DO UPDATE SET json = excluded.json, fetched = excluded.fetched');
        const t = Date.now();
        db.exec('BEGIN');
        try {
          const seen = new Set();
          for (const d of r.days || []) { if (!ISO.test(d.d)) continue; seen.add(d.d); const { d: day, ...rest } = d; up.run(conn.id, day, JSON.stringify(rest), t); }
          // Nguồn có số liệu theo ngày: ngày không có dòng nào là ngày bằng 0 (hợp lệ), trừ các nguồn chụp số (TikTok).
          // YouTube trễ vài ngày: ngày gần đây chưa có dòng là "chưa có số liệu", không ghi bằng 0.
          const settled = addDay(today, -(src.lagDays || 0));
          if (!src.snapshot) for (let d = start; d <= end && d <= settled; d = addDay(d, 1)) if (!seen.has(d)) up.run(conn.id, d, JSON.stringify({ empty: true }), t);
          db.exec('COMMIT');
        } catch (e) { db.exec('ROLLBACK'); throw e; }
        const meta = { ...conn.meta, ...(r.meta || {}) };
        db.prepare("UPDATE biz_conn SET status = 'connected', error = NULL, last_ok = ?, meta = ? WHERE id = ?").run(Date.now(), JSON.stringify(meta), conn.id);
        db.prepare('DELETE FROM biz_extra WHERE conn_id = ? AND fetched < ?').run(conn.id, Date.now() - (manual ? 0 : 6 * 3600e3));
        return { ok: true, days: (r.days || []).length };
      } catch (e) {
        const auth = e instanceof AuthError;
        setStatus(conn.id, auth ? 'needs_auth' : 'error', auth ? (e.message === 'missing_permission' ? 'Permission missing for this account. Reconnect and allow read access.' : 'Access expired or was revoked. Reconnect to continue.') : String(e.message || e).slice(0, 240));
        if (!auth) console.error(`Business sync ${conn.type}/${conn.account_id}:`, e.message);
        return { ok: false, error: auth ? 'needs_auth' : 'error' };
      } finally { inflight.delete(conn.id); }
    })();
    inflight.set(conn.id, job);
    return job;
  }

  // Lịch đồng bộ: mỗi 10 phút xem nguồn nào đến hạn theo syncEveryH (bỏ qua nguồn cần đăng nhập lại).
  const tick = () => {
    for (const r of db.prepare("SELECT * FROM biz_conn WHERE type != 'sales' AND status != 'needs_auth'").all()) {
      const c = parseConn(r); const src = SOURCES[c.type];
      if (!src) continue;
      if (!c.last_try || Date.now() - c.last_try > src.syncEveryH * 3600e3) sync(c).catch(() => {});
    }
  };
  setTimeout(tick, 30e3).unref?.();
  setInterval(tick, 10 * 60e3).unref?.();

  // ---------- Sales: đọc trực tiếp (chỉ đọc), có bộ nhớ đệm 60 giây ----------
  const salesCache = new Map();
  function salesCached(from, to, cut) {
    const k = `${from}|${to}|${cut || ''}`;
    const hit = salesCache.get(k);
    if (hit && Date.now() - hit.at < 60e3) return hit;
    const v = { ...salesRange(from, to, cut), at: Date.now() };
    salesCache.set(k, v);
    if (salesCache.size > 60) salesCache.delete(salesCache.keys().next().value);
    return v;
  }
  function salesConn(userId) {
    let c = parseConn(db.prepare("SELECT * FROM biz_conn WHERE user_id = ? AND type = 'sales'").get(userId));
    return c;
  }

  const providersInfo = () => ({
    sales: { configured: fs.existsSync(SALES_DB), missing: fs.existsSync(SALES_DB) ? [] : [`SALES_DB (${SALES_DB} not found in the container)`], url: SALES_URL, exclude: EXCLUDE },
    ...Object.fromEntries(Object.entries(SOURCES).map(([k, s]) => [k, { label: s.label, provider: s.provider, configured: s.missing().length === 0, missing: s.missing(), syncEveryH: s.syncEveryH, reportTz: s.reportTz || null, metaServerToken: k === 'meta_ads' && !!META_SERVER_TOKEN }])),
  });

  // ---------- API ----------
  async function userApi(req, res, url, user) {
    const p = url.pathname; const m = req.method;
    if (!allowed(user)) return fail(res, 403, 'business_forbidden');
    const q = (k) => url.searchParams.get(k) || '';

    if (p === '/api/business/connections' && m === 'GET') {
      const rows = db.prepare('SELECT * FROM biz_conn WHERE user_id = ? ORDER BY created').all(user.id).map(parseConn);
      const creds = db.prepare('SELECT id, provider, label, updated FROM biz_cred WHERE user_id = ?').all(user.id);
      return send(res, 200, { now: Date.now(), tz: BIZ_TZ, today: dayIn(BIZ_TZ), providers: providersInfo(), connections: rows.map(publicConn), creds: creds.map((c) => ({ ...c, label: c.label === 'server-token' ? 'Server token' : c.label })) });
    }

    // Bắt đầu OAuth: chuyển trình duyệt sang trang cấp quyền của nhà cung cấp.
    const om = p.match(/^\/api\/business\/oauth\/(google|meta|tiktok)\/(start|callback)$/);
    if (om && m === 'GET') {
      const [, prov, step] = om;
      const back = (qs) => send(res, 302, '', { Location: `/#business?v=connections&${qs}`, 'Set-Cookie': cookie('avenor_biz_state', '', 0) });
      if (step === 'start') {
        const type = q('type');
        if (!SOURCES[type] || SOURCES[type].provider !== prov) return fail(res, 400, 'bad_type');
        if (SOURCES[type].missing().length) return back(`err=not_configured&type=${type}`);
        const state = `${crypto.randomBytes(16).toString('base64url')}.${type}.${q('cred') || ''}`;
        let loc;
        if (prov === 'google') loc = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: GOOGLE_ID, redirect_uri: redirect('google'), response_type: 'code', access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'false', scope: ['openid', 'email', ...GOOGLE_SCOPES[type]].join(' '), state })}`;
        else if (prov === 'meta') {
          if (!META_ID) { metaServerCred(user.id); return back(`type=${type}&cred=${metaServerCred(user.id)}`); }
          loc = `https://www.facebook.com/${process.env.META_API_VERSION || 'v26.0'}/dialog/oauth?${new URLSearchParams({ client_id: META_ID, redirect_uri: redirect('meta'), scope: 'ads_read', state })}`;
        } else loc = `https://www.tiktok.com/v2/auth/authorize/?${new URLSearchParams({ client_key: TIKTOK_KEY, scope: TIKTOK_SCOPES.join(','), response_type: 'code', redirect_uri: redirect('tiktok'), state })}`;
        return send(res, 302, '', { Location: loc, 'Set-Cookie': cookie('avenor_biz_state', state, 900) });
      }
      const state = q('state');
      if (!state || state !== cookies(req).avenor_biz_state) return back('err=state');
      const [, type, reCred] = state.split('.');
      if (q('error')) return back(`err=denied&type=${type}`);
      try {
        let credId;
        if (prov === 'google') {
          const t = await http('https://oauth2.googleapis.com/token', { method: 'POST', form: { code: q('code'), client_id: GOOGLE_ID, client_secret: GOOGLE_SECRET, redirect_uri: redirect('google'), grant_type: 'authorization_code' } });
          const granted = String(t.scope || '');
          if (!GOOGLE_SCOPES[type].every((s) => granted.includes(s))) return back(`err=scope&type=${type}`);
          let email = '';
          try { email = JSON.parse(Buffer.from(String(t.id_token).split('.')[1], 'base64url').toString()).email || ''; } catch { /* bỏ qua */ }
          credId = saveCred(user.id, 'google', `${email || 'Google'} · ${type}`, granted, { access: t.access_token, refresh: t.refresh_token, expires: Date.now() + (t.expires_in - 60) * 1000 }, reCred || undefined);
        } else if (prov === 'meta') {
          const t = await http(`https://graph.facebook.com/${process.env.META_API_VERSION || 'v26.0'}/oauth/access_token?${new URLSearchParams({ client_id: META_ID, client_secret: META_SECRET, redirect_uri: redirect('meta'), code: q('code') })}`);
          // Đổi sang token dài hạn (~60 ngày). Hết hạn thì kết nối chuyển "Needs authorization".
          const l = await http(`https://graph.facebook.com/${process.env.META_API_VERSION || 'v26.0'}/oauth/access_token?${new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: META_ID, client_secret: META_SECRET, fb_exchange_token: t.access_token })}`);
          const me = await http(`https://graph.facebook.com/me?${new URLSearchParams({ fields: 'name', access_token: l.access_token })}`).catch(() => ({}));
          credId = saveCred(user.id, 'meta', me.name || 'Meta', 'ads_read', { access: l.access_token, expires: l.expires_in ? Date.now() + l.expires_in * 1000 : null }, reCred || undefined);
        } else {
          const t = await http('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', form: { client_key: TIKTOK_KEY, client_secret: TIKTOK_SECRET, code: q('code'), grant_type: 'authorization_code', redirect_uri: redirect('tiktok') } });
          if (!t?.access_token) return back(`err=token&type=${type}`);
          const granted = String(t.scope || '');
          if (!['user.info.stats', 'video.list'].every((s) => granted.includes(s))) return back(`err=scope&type=${type}`);
          credId = saveCred(user.id, 'tiktok', `TikTok ${String(t.open_id || '').slice(0, 6)}`, granted, { access: t.access_token, refresh: t.refresh_token, expires: Date.now() + (t.expires_in - 60) * 1000 }, reCred || undefined);
        }
        return back(`type=${type}&cred=${credId}${reCred ? '&re=1' : ''}`);
      } catch (e) {
        console.error('Business OAuth', prov, e.message);
        return back(`err=token&type=${type}`);
      }
    }

    // Danh sách tài khoản / property / kênh chọn được sau khi cấp quyền.
    if (p === '/api/business/accounts' && m === 'GET') {
      const type = q('type');
      if (type === 'sales') {
        try { const info = salesInfo(); return send(res, 200, { accounts: [{ id: 'sales', name: 'Mộc Linh Sales', tz: BIZ_TZ, currency: 'VND', info }] }); }
        catch (e) { return send(res, 200, { accounts: [], error: e.message, detail: e.detail || null }); }
      }
      const src = SOURCES[type];
      if (!src) return fail(res, 400, 'bad_type');
      const credId = q('cred') || (type === 'meta_ads' ? metaServerCred(user.id) : '');
      const cred = credId && credRow(credId, user.id);
      if (!cred || cred.provider !== src.provider) return fail(res, 404, 'cred_not_found');
      try { return send(res, 200, { accounts: await src.listAccounts(await accessFor(cred)), cred: cred.id }); }
      catch (e) { return send(res, 200, { accounts: [], error: e instanceof AuthError ? 'needs_auth' : String(e.message || e).slice(0, 240) }); }
    }

    if (p === '/api/business/connections' && m === 'POST') {
      const b = await readJson(req, 16 << 10);
      const type = String(b.type || '');
      if (type !== 'sales' && !SOURCES[type]) return fail(res, 400, 'bad_type');
      const accountId = type === 'sales' ? 'sales' : String(b.accountId || '').slice(0, 80);
      if (!accountId) return fail(res, 400, 'bad_account');
      let credId = null;
      if (type !== 'sales') {
        const cred = credRow(String(b.cred || ''), user.id);
        if (!cred || cred.provider !== SOURCES[type].provider) return fail(res, 400, 'cred_not_found');
        credId = cred.id;
      } else { try { salesInfo(); } catch (e) { return send(res, 400, { error: e.message, detail: e.detail || null }); } }
      const clip = (v, k) => String(v || '').slice(0, k);
      const meta = b.meta && typeof b.meta === 'object' ? { handle: clip(b.meta.handle, 80), thumb: /^https:\/\//.test(b.meta.thumb || '') ? clip(b.meta.thumb, 400) : '', username: clip(b.meta.username, 80) } : {};
      const existing = db.prepare('SELECT id FROM biz_conn WHERE user_id = ? AND type = ? AND account_id = ?').get(user.id, type, accountId);
      const id = existing?.id || newId();
      db.prepare(`INSERT INTO biz_conn (id, user_id, type, name, cred_id, account_id, account_name, tz, currency, status, meta, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'connected', ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, cred_id = excluded.cred_id, account_name = excluded.account_name, tz = excluded.tz, currency = excluded.currency, status = 'connected', error = NULL`)
        .run(id, user.id, type, clip(b.name || b.accountName || SOURCES[type]?.label || 'Sales', 80), credId, accountId, clip(b.accountName, 120), clip(b.tz || (type === 'sales' ? BIZ_TZ : ''), 60), clip(b.currency || (type === 'sales' ? 'VND' : ''), 8), JSON.stringify(meta), Date.now());
      if (type === 'sales') db.prepare('UPDATE biz_conn SET last_ok = ?, last_try = ? WHERE id = ?').run(Date.now(), Date.now(), id);
      else sync(connOf(id, user.id)).catch(() => {});
      return send(res, 200, { connection: publicConn(connOf(id, user.id)) });
    }

    const cm = p.match(/^\/api\/business\/connections\/([A-Za-z0-9_-]{6,20})(\/sync)?$/);
    if (cm) {
      const c = connOf(cm[1], user.id);
      if (!c) return fail(res, 404, 'not_found');
      if (cm[2] && m === 'POST') {
        if (c.type === 'sales') {
          try { salesCache.clear(); const info = salesInfo(); db.prepare("UPDATE biz_conn SET status = 'connected', error = NULL, last_ok = ?, last_try = ? WHERE id = ?").run(Date.now(), Date.now(), c.id); return send(res, 200, { ok: true, info, connection: publicConn(connOf(c.id, user.id)) }); }
          catch (e) { db.prepare("UPDATE biz_conn SET status = 'error', error = ?, last_try = ? WHERE id = ?").run(`${e.message}${e.detail ? ` (${e.detail})` : ''}`, Date.now(), c.id); return send(res, 200, { ok: false, error: e.message, connection: publicConn(connOf(c.id, user.id)) }); }
        }
        if (!inflight.has(c.id) && c.last_try && Date.now() - c.last_try < MANUAL_GAP) return send(res, 200, { ok: false, error: 'too_soon', retryIn: Math.ceil((MANUAL_GAP - (Date.now() - c.last_try)) / 1000), connection: publicConn(c) });
        const wait = url.searchParams.get('wait') === '1';
        const job = sync(c, { manual: true });
        const r = wait ? await job : { ok: true, started: true };
        return send(res, 200, { ...r, connection: publicConn(connOf(c.id, user.id)) });
      }
      if (!cm[2] && m === 'PATCH') {
        const b = await readJson(req, 4096);
        if (b.name) db.prepare('UPDATE biz_conn SET name = ? WHERE id = ?').run(String(b.name).slice(0, 80), c.id);
        if (b.tz) db.prepare('UPDATE biz_conn SET tz = ? WHERE id = ?').run(String(b.tz).slice(0, 60), c.id);
        return send(res, 200, { connection: publicConn(connOf(c.id, user.id)) });
      }
      if (!cm[2] && m === 'DELETE') {
        db.prepare('DELETE FROM biz_conn WHERE id = ?').run(c.id);
        // Không còn kết nối nào dùng thông tin đăng nhập này: xoá luôn token (và thu hồi với Google).
        if (c.cred_id && !db.prepare('SELECT 1 FROM biz_conn WHERE cred_id = ?').get(c.cred_id)) {
          const cred = db.prepare('SELECT * FROM biz_cred WHERE id = ?').get(c.cred_id);
          if (cred?.provider === 'google') { try { const t = unseal(cred.enc); fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t.refresh || t.access)}`, { method: 'POST' }).catch(() => {}); } catch { /* bỏ qua */ } }
          if (cred && cred.label !== 'server-token') db.prepare('DELETE FROM biz_cred WHERE id = ?').run(c.cred_id);
        }
        return send(res, 200, { ok: true });
      }
    }

    // Số liệu theo ngày của một kết nối trong khoảng [from, to].
    if (p === '/api/business/data' && m === 'GET') {
      const from = q('from'), to = q('to');
      if (!ISO.test(from) || !ISO.test(to) || from > to || spanDays(from, to) > 400) return fail(res, 400, 'bad_range');
      const c = connOf(q('id'), user.id);
      if (!c) return fail(res, 404, 'not_found');
      if (c.type === 'sales') {
        const cut = /^\d{2}:\d{2}$/.test(q('cut')) ? q('cut') : '';
        try {
          const r = salesCached(from, to, cut);
          if (c.status !== 'connected') db.prepare("UPDATE biz_conn SET status = 'connected', error = NULL WHERE id = ?").run(c.id);
          db.prepare('UPDATE biz_conn SET last_ok = ?, last_try = ? WHERE id = ?').run(r.at, r.at, c.id);
          return send(res, 200, { connection: publicConn(connOf(c.id, user.id)), days: r.days, extra: r.extra, fetchedAt: r.at, complete: true });
        } catch (e) {
          db.prepare("UPDATE biz_conn SET status = 'error', error = ?, last_try = ? WHERE id = ?").run(`${e.message}${e.detail ? ` (${e.detail})` : ''}`, Date.now(), c.id);
          return send(res, 200, { connection: publicConn(connOf(c.id, user.id)), days: null, error: e.message });
        }
      }
      const src = SOURCES[c.type];
      const rows = db.prepare('SELECT d, json, fetched FROM biz_daily WHERE conn_id = ? AND d >= ? AND d <= ? ORDER BY d').all(c.id, from, to);
      const today = dayIn(src.reportTz || c.tz || BIZ_TZ);
      const have = new Set(rows.map((r) => r.d));
      let missing = 0;
      if (!src.snapshot) {
        let lo = null, hi = null;
        const settled = addDay(today, -(src.lagDays || 0));
        for (let d = from; d <= to && d <= settled; d = addDay(d, 1)) if (!have.has(d)) { missing++; lo = lo || d; hi = d; }
        // Thiếu ngày cũ (ngoài lượt đồng bộ định kỳ): lấy bổ sung một lần, chạy nền.
        if (missing && c.status === 'connected' && !inflight.has(c.id)) sync(c, { from: lo, to: hi }).catch(() => {});
      }
      const days = rows.map((r) => { const o = JSON.parse(r.json); return o.empty ? { d: r.d } : { d: r.d, ...o }; });
      const fetchedAt = rows.length ? Math.min(...rows.map((r) => r.fetched)) : null;
      return send(res, 200, { connection: publicConn(connOf(c.id, user.id)), days, missing, complete: missing === 0, fetchedAt, today });
    }

    // Số liệu chi tiết (video nổi bật, trang đích...) có bộ nhớ đệm 6 giờ; lỗi thì trả bản cũ kèm stale.
    if (p === '/api/business/extra' && m === 'GET') {
      const from = q('from'), to = q('to');
      if (!ISO.test(from) || !ISO.test(to) || from > to) return fail(res, 400, 'bad_range');
      const c = connOf(q('id'), user.id);
      if (!c) return fail(res, 404, 'not_found');
      const src = SOURCES[c.type];
      if (!src?.extra) return send(res, 200, { extra: null });
      const k = `${from}|${to}`;
      const row = db.prepare('SELECT json, fetched FROM biz_extra WHERE conn_id = ? AND k = ?').get(c.id, k);
      if (row && Date.now() - row.fetched < 6 * 3600e3) return send(res, 200, { extra: JSON.parse(row.json), fetchedAt: row.fetched });
      const key = `x:${c.id}:${k}`;
      try {
        if (!inflight.has(key)) inflight.set(key, (async () => { const cred = db.prepare('SELECT * FROM biz_cred WHERE id = ?').get(c.cred_id); if (!cred) throw new AuthError(); return src.extra(c, await accessFor(cred), from, to); })().finally(() => inflight.delete(key)));
        const extra = await inflight.get(key);
        db.prepare('INSERT INTO biz_extra (conn_id, k, json, fetched) VALUES (?, ?, ?, ?) ON CONFLICT(conn_id, k) DO UPDATE SET json = excluded.json, fetched = excluded.fetched').run(c.id, k, JSON.stringify(extra), Date.now());
        return send(res, 200, { extra, fetchedAt: Date.now() });
      } catch (e) {
        if (e instanceof AuthError) setStatus(c.id, 'needs_auth', 'Access expired or was revoked. Reconnect to continue.');
        return send(res, 200, { extra: row ? JSON.parse(row.json) : null, fetchedAt: row?.fetched || null, stale: !!row, error: e instanceof AuthError ? 'needs_auth' : String(e.message || e).slice(0, 200) });
      }
    }
    return fail(res, 404, 'not_found');
  }

  return { userApi, allowed, sync };
}
