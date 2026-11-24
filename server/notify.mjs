// Thông báo: nhận đơn hàng mới từ trang tranh trúc chỉ (trucchi.moclinh.vn) qua webhook có chữ ký,
// lưu vào bảng notifications và đẩy Web Push (VAPID, mã hóa aes128gcm theo RFC 8291/8292) tới các thiết bị đã bật.
// Chỉ dùng node:crypto, không cần thư viện ngoài.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const fromB64u = (s) => Buffer.from(String(s), 'base64url');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

export function setupNotify({ db, dataDir, publicUrl, send, fail, readBody, readJson }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, source TEXT NOT NULL, ext_id TEXT NOT NULL,
      title TEXT NOT NULL, body TEXT NOT NULL, url TEXT, data TEXT, created INTEGER NOT NULL, read INTEGER NOT NULL DEFAULT 0, UNIQUE (user_id, source, ext_id));
    CREATE INDEX IF NOT EXISTS notifications_user ON notifications (user_id, created);
    CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created INTEGER NOT NULL);
  `);

  const SECRET = process.env.TRUCCHI_WEBHOOK_SECRET || '';
  const NOTIFY_USERS = String(process.env.TRUCCHI_NOTIFY_USERS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

  // ---------- khóa VAPID: tạo một lần, lưu trong thư mục dữ liệu ----------
  const vapidFile = path.join(dataDir, 'vapid.json');
  let vapid;
  try { vapid = JSON.parse(fs.readFileSync(vapidFile, 'utf8')); } catch { /* chưa có */ }
  if (!vapid?.privatePem || !vapid?.publicKey) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const jwk = publicKey.export({ format: 'jwk' });
    vapid = { privatePem: privateKey.export({ format: 'pem', type: 'pkcs8' }), publicKey: b64u(Buffer.concat([Buffer.from([4]), fromB64u(jwk.x), fromB64u(jwk.y)])) };
    fs.writeFileSync(vapidFile, JSON.stringify(vapid), { mode: 0o600 });
  }
  const vapidKey = crypto.createPrivateKey(vapid.privatePem);

  function vapidAuth(endpoint) {
    const aud = new URL(endpoint).origin;
    const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
    const claims = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: publicUrl.startsWith('https://') ? publicUrl : 'mailto:admin@localhost' }));
    const sig = crypto.sign('sha256', Buffer.from(`${head}.${claims}`), { key: vapidKey, dsaEncoding: 'ieee-p1363' });
    return `vapid t=${head}.${claims}.${b64u(sig)}, k=${vapid.publicKey}`;
  }

  // Mã hóa nội dung theo RFC 8291 (Content-Encoding: aes128gcm, một bản ghi).
  function encrypt(sub, payload) {
    const uaPublic = fromB64u(sub.p256dh);
    const authSecret = fromB64u(sub.auth);
    const ecdh = crypto.createECDH('prime256v1');
    const asPublic = ecdh.generateKeys();
    const shared = ecdh.computeSecret(uaPublic);
    const prkKey = hmac(authSecret, shared);
    const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
    const salt = crypto.randomBytes(16);
    const prk = hmac(salt, ikm);
    const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
    const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
    const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
    const body = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
    const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
    return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
  }

  async function pushTo(userId, message) {
    const subs = db.prepare('SELECT * FROM push_subs WHERE user_id = ?').all(userId);
    await Promise.all(subs.map(async (s) => {
      try {
        const r = await fetch(s.endpoint, {
          method: 'POST', body: encrypt(s, JSON.stringify(message)), signal: AbortSignal.timeout(10000),
          headers: { Authorization: vapidAuth(s.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high' },
        });
        // Thiết bị đã gỡ đăng ký hoặc hết hạn: xóa để không gửi nữa.
        if (r.status === 404 || r.status === 410) db.prepare('DELETE FROM push_subs WHERE endpoint = ?').run(s.endpoint);
        else if (!r.ok) console.error(`Web Push ${new URL(s.endpoint).host}: HTTP ${r.status}`);
      } catch (e) { console.error('Web Push:', e.message); }
    }));
  }

  function recipients() {
    if (NOTIFY_USERS.length) {
      return db.prepare('SELECT id, username, email FROM users').all()
        .filter((u) => NOTIFY_USERS.includes(String(u.username).toLowerCase()) || (u.email && NOTIFY_USERS.includes(u.email.toLowerCase())))
        .map((u) => u.id);
    }
    const first = db.prepare('SELECT id FROM users ORDER BY created LIMIT 1').get();
    return first ? [first.id] : [];
  }

  const clip = (v, n) => String(v ?? '').slice(0, n);

  // ---------- webhook từ trang tranh trúc chỉ (máy chủ gọi máy chủ, không dùng cookie) ----------
  async function trucchiHook(req, res) {
    if (SECRET.length < 16) return fail(res, 503, 'hook_not_configured');
    const raw = await readBody(req, 64 << 10);
    const ts = String(req.headers['x-trucchi-timestamp'] || '');
    const sig = String(req.headers['x-trucchi-signature'] || '');
    if (!/^\d{10,16}$/.test(ts) || Math.abs(Date.now() - Number(ts)) > 5 * 60e3) return fail(res, 401, 'bad_timestamp');
    const want = crypto.createHmac('sha256', SECRET).update(`${ts}.`).update(raw).digest();
    const got = /^[0-9a-f]{64}$/.test(sig) ? Buffer.from(sig, 'hex') : Buffer.alloc(0);
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return fail(res, 401, 'bad_signature');
    let o;
    try { o = JSON.parse(raw.toString('utf8')); } catch { return fail(res, 400, 'bad_json'); }
    if (o?.suKien !== 'don-hang-moi' || !/^DH\d{1,12}$/.test(String(o.maDon || ''))) return fail(res, 400, 'bad_event');

    const choices = Array.isArray(o.luaChon) ? o.luaChon.slice(0, 8).map((c) => clip(c?.ten, 60)).filter(Boolean) : [];
    const title = `Đơn tranh mới ${o.maDon}`;
    const body = [`${clip(o.hoTen, 80)} · ${clip(o.soDienThoai, 20)}`, choices.join(' · '), clip(o.ghiChu, 200)].filter(Boolean).join('\n');
    const link = /^https:\/\/[^\s]+$/.test(String(o.xemTai || '')) ? clip(o.xemTai, 300) : null;
    const data = JSON.stringify({ maDon: o.maDon, taoLuc: clip(o.taoLuc, 40), hoTen: clip(o.hoTen, 80), soDienThoai: clip(o.soDienThoai, 20), ghiChu: clip(o.ghiChu, 500),
      luaChon: Array.isArray(o.luaChon) ? o.luaChon.slice(0, 8).map((c) => ({ nhom: clip(c?.nhom, 40), ten: clip(c?.ten, 60) })) : [] });

    const now = Date.now();
    let created = 0;
    for (const userId of recipients()) {
      const id = crypto.randomBytes(12).toString('base64url');
      const r = db.prepare('INSERT OR IGNORE INTO notifications (id, user_id, source, ext_id, title, body, url, data, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, userId, 'trucchi', o.maDon, title, body, link, data, now);
      if (r.changes) { created++; pushTo(userId, { id, title, body, url: '/#notifications', tag: `trucchi-${o.maDon}` }).catch(() => {}); }
    }
    return send(res, 200, { ok: true, created });
  }

  // ---------- API cho người dùng đã đăng nhập ----------
  async function userApi(req, res, url, user) {
    const p = url.pathname; const m = req.method;
    if (p === '/api/notifications' && m === 'GET') {
      const items = db.prepare('SELECT id, source, title, body, url, data, created, read FROM notifications WHERE user_id = ? ORDER BY created DESC LIMIT 100').all(user.id)
        .map((n) => ({ ...n, read: !!n.read, data: n.data ? JSON.parse(n.data) : null }));
      const unread = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0').get(user.id).n;
      return send(res, 200, { items, unread });
    }
    if (p === '/api/notifications/read' && m === 'POST') {
      const { ids, all } = await readJson(req, 64 << 10);
      if (all) db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(user.id);
      else for (const id of (Array.isArray(ids) ? ids.slice(0, 200) : [])) db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(String(id), user.id);
      return send(res, 200, { ok: true });
    }
    if (p === '/api/push/key' && m === 'GET') return send(res, 200, { key: vapid.publicKey });
    if (p === '/api/push/subscribe' && m === 'POST') {
      const { endpoint, keys } = await readJson(req, 8 << 10);
      if (!/^https:\/\/[^\s]{10,800}$/.test(String(endpoint || '')) || !keys?.p256dh || !keys?.auth) return fail(res, 400, 'bad_subscription');
      if (fromB64u(keys.p256dh).length !== 65 || fromB64u(keys.auth).length !== 16) return fail(res, 400, 'bad_subscription');
      db.prepare('INSERT INTO push_subs (endpoint, user_id, p256dh, auth, created) VALUES (?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth')
        .run(endpoint, user.id, String(keys.p256dh), String(keys.auth), Date.now());
      return send(res, 200, { ok: true });
    }
    if (p === '/api/push/unsubscribe' && m === 'POST') {
      const { endpoint } = await readJson(req, 8 << 10);
      db.prepare('DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?').run(String(endpoint || ''), user.id);
      return send(res, 200, { ok: true });
    }
    if (p === '/api/push/test' && m === 'POST') {
      await pushTo(user.id, { id: 'test', title: 'Avenor', body: 'Thông báo trên thiết bị này đã hoạt động.', url: '/#notifications', tag: 'avenor-test' });
      return send(res, 200, { ok: true, devices: db.prepare('SELECT COUNT(*) AS n FROM push_subs WHERE user_id = ?').get(user.id).n });
    }
    return fail(res, 404, 'not_found');
  }

  return { trucchiHook, userApi, encrypt };
}
