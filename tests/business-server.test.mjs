// node --test tests/*.test.mjs — máy chủ Business: Sales (CSDL giả cùng cấu trúc tt_don), đồng bộ nguồn ngoài với fetch giả.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avbiz-'));
const salesDb = path.join(dir, 'ketoan.db');
process.env.SALES_DB = salesDb;
process.env.META_ACCESS_TOKEN = 'test-server-token';

// Đơn 24–28/11/2026 theo đúng số liệu trang Sales (/api/tk/kinhdoanh): 21 đơn tính doanh số, 85.302.000 ₫.
{
  const s = new DatabaseSync(salesDb);
  s.exec(`CREATE TABLE tt_don (id INTEGER PRIMARY KEY, ma TEXT, ngay TEXT, tong REAL, giam REAL, phi_ship REAL, trang_thai TEXT, nguon TEXT);
          CREATE TABLE tt_don_ct (id INTEGER PRIMARY KEY, don_id INTEGER, ma_hang TEXT, ten_hang TEXT, so_luong REAL, don_gia REAL, thanh_tien REAL);`);
  const ins = s.prepare('INSERT INTO tt_don (ma, ngay, tong, giam, phi_ship, trang_thai, nguon) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const ct = s.prepare('INSERT INTO tt_don_ct (don_id, ma_hang, ten_hang, so_luong, thanh_tien) VALUES (?, ?, ?, ?, ?)');
  const add = (ngay, tong, st, giam = 0, ship = 0) => { const r = ins.run('DH', ngay, tong, giam, ship, st, 'Facebook'); ct.run(r.lastInsertRowid, 'SP1', 'Tranh Sen', 1, tong + giam - ship); };
  add('2026-11-28 14:42', 1450000, 'cho_duyet', 0, 50000);
  for (let i = 0; i < 14; i++) add(`2026-11-${24 + (i % 4)} 1${i % 10}:00`, i < 13 ? 4650000 : 65177000 - 13 * 4650000, 'dang_sx');
  add('2026-11-26 09:00', 7200000, 'wait_submit');
  add('2026-11-27 10:00', 2025000, 'shipped', 225000);
  add('2026-11-25 11:00', 2025000, 'delivered'); add('2026-11-25 12:00', 2025000, 'delivered');
  add('2026-11-24 08:48', 2700000, 'packing', 100000); add('2026-11-27 18:27', 2700000, 'packing');
  add('2026-11-26 10:00', 9900000, 'canceled');   // không tính doanh số
  add('2026-11-27 10:00', 3000000, 'returned');   // không tính doanh số
  add('2026-11-27 11:00', 1000000, 'nhap');       // nháp: không tính cả đơn tạo mới
  add('26/11/2026 15:00', 0, 'returning');        // ngày dạng DD/MM/YYYY
  s.close();
}

const { salesRange, salesInfo } = await import('../server/business/sales.mjs');
const { setupBusiness } = await import('../server/business/index.mjs');

test('Sales revenue matches the Sales report API', () => {
  const r = salesRange('2026-11-24', '2026-11-28');
  const sum = (k) => r.days.reduce((a, d) => a + d[k], 0);
  assert.equal(sum('revenue'), 85302000);
  assert.equal(sum('orders'), 21);
  assert.equal(sum('created'), 24, 'created includes canceled/returned/returning, excludes draft');
  assert.equal(sum('canceled'), 3);
  assert.equal(sum('discount'), 325000);
  assert.ok(r.extra.statuses.find((x) => x.status === 'canceled' && !x.counted));
  assert.equal(r.extra.products[0].name, 'Tranh Sen');
  assert.equal(salesInfo().items, 'tt_don_ct');
});

test('Sales cut time compares the same hours', () => {
  const r = salesRange('2026-11-28', '2026-11-28', '12:00');
  assert.equal(r.days.length, 0, 'order at 14:42 is after the cut');
  assert.equal(salesRange('2026-11-28', '2026-11-28', '15:00').days[0].orders, 1);
  assert.equal(salesRange('2026-11-01', '2026-11-02').days.length, 0, 'no orders = no rows (client fills zeros)');
});

// ---------- máy chủ: quyền, kết nối, đồng bộ ----------
const db = new DatabaseSync(path.join(dir, 'avenor.db'));
db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT, pass TEXT, created INTEGER, email TEXT); INSERT INTO users VALUES ('u1','owner','x',1,NULL),('u2','other','x',2,NULL);");
const out = [];
const send = (res, status, body) => { res.status = status; res.body = body; out.push(body); };
const fail = (res, status, code) => send(res, status, { error: code });
let nextBody = {};
const readJson = async () => nextBody;
const biz = setupBusiness({ db, dataDir: dir, publicUrl: 'https://x.test', send, fail, readJson, cookie: () => '', cookies: () => ({}) });
async function call(method, p, body, user = { id: 'u1' }) {
  nextBody = body || {};
  const res = {};
  await biz.userApi({ method, headers: {} }, res, new URL(`https://x.test${p}`), user);
  return res;
}

test('Business API checks the Avenor user', async () => {
  assert.equal((await call('GET', '/api/business/connections', null, { id: 'u2' })).status, 403);
  const r = await call('GET', '/api/business/connections');
  assert.equal(r.status, 200); assert.equal(r.body.connections.length, 0);
  assert.equal(r.body.providers.sales.configured, true);
  assert.equal(r.body.providers.google_ads.configured, false);
  assert.ok(r.body.providers.google_ads.missing.includes('GOOGLE_ADS_DEVELOPER_TOKEN'));
});

test('Sales connection: connect, read range, zero days', async () => {
  const c = await call('POST', '/api/business/connections', { type: 'sales', name: 'Mộc Linh Sales' });
  assert.equal(c.body.connection.status, 'connected');
  const d = await call('GET', `/api/business/data?id=${c.body.connection.id}&from=2026-11-24&to=2026-11-28`);
  assert.equal(d.body.days.reduce((a, x) => a + x.revenue, 0), 85302000);
  assert.equal(d.body.complete, true);
  assert.equal((await call('GET', `/api/business/data?id=${c.body.connection.id}&from=2026-11-28&to=2026-11-01`)).status, 400);
});

const realFetch = globalThis.fetch;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('Meta Ads: list accounts, sync, needs authorization, error keeps last data', async () => {
  let mode = 'ok';
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (mode === 'expired') return json(400, { error: { message: 'Error validating access token', code: 190 } });
    if (mode === 'down') return json(500, { error: { message: 'Service temporarily unavailable', code: 2 } });
    if (u.includes('/me/adaccounts')) return json(200, { data: [{ account_id: '42', name: 'Shop', currency: 'VND', timezone_name: 'Asia/Ho_Chi_Minh', account_status: 1 }] });
    if (u.includes('/insights')) return json(200, { data: [
      { date_start: '2026-11-27', spend: '100000', impressions: '5000', clicks: '50', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '7' }] },
      { date_start: '2026-11-28', spend: '0', impressions: '0', clicks: '0' },
    ] });
    return json(404, { error: { message: 'unexpected ' + u } });
  };
  try {
    const acc = await call('GET', '/api/business/accounts?type=meta_ads');
    assert.equal(acc.body.accounts[0].id, '42');
    const c = await call('POST', '/api/business/connections', { type: 'meta_ads', cred: acc.body.cred, accountId: '42', accountName: 'Shop', currency: 'VND', tz: 'Asia/Ho_Chi_Minh' });
    const id = c.body.connection.id;
    const s = await call('POST', `/api/business/connections/${id}/sync?wait=1`);
    // Đồng bộ đầu tiên đã chạy ngay khi tạo; lần bấm tay chờ đồng bộ đó xong rồi trả kết quả.
    assert.equal(s.body.connection.status, 'connected');
    const row = db.prepare("SELECT json FROM biz_daily WHERE conn_id = ? AND d = '2026-11-27'").get(id);
    assert.equal(JSON.parse(row.json).spend, 100000);
    assert.equal(JSON.parse(row.json).conversions, null, 'no purchase tracking → conversions hidden');
    assert.equal(JSON.parse(row.json).messaging, 7);
    // Bấm làm mới quá sớm: không gọi API lần nữa.
    const again = await call('POST', `/api/business/connections/${id}/sync`);
    assert.equal(again.body.error, 'too_soon');
    // Token hết hạn → Needs authorization, dữ liệu cũ còn nguyên.
    mode = 'expired';
    db.prepare('UPDATE biz_conn SET last_try = 0 WHERE id = ?').run(id);
    await call('POST', `/api/business/connections/${id}/sync?wait=1`);
    let conn = (await call('GET', '/api/business/connections')).body.connections.find((x) => x.id === id);
    assert.equal(conn.status, 'needs_auth');
    assert.ok(db.prepare('SELECT 1 FROM biz_daily WHERE conn_id = ?').get(id));
    // Lỗi máy chủ nguồn → Error, giữ thời điểm thành công gần nhất.
    mode = 'down';
    db.prepare("UPDATE biz_conn SET last_try = 0, status = 'connected' WHERE id = ?").run(id);
    await call('POST', `/api/business/connections/${id}/sync?wait=1`);
    conn = (await call('GET', '/api/business/connections')).body.connections.find((x) => x.id === id);
    assert.equal(conn.status, 'error'); assert.ok(conn.lastOk); assert.match(conn.error, /unavailable/);
    const d = await call('GET', `/api/business/data?id=${id}&from=2026-11-27&to=2026-11-27`);
    assert.equal(d.body.days[0].spend, 100000, 'last good data still served');
    // Ngắt kết nối: xoá số liệu đã lưu.
    await call('DELETE', `/api/business/connections/${id}`);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM biz_daily WHERE conn_id = ?').get(id).n, 0);
  } finally { globalThis.fetch = realFetch; }
});

test('tokens are stored encrypted', () => {
  const row = db.prepare("SELECT enc FROM biz_cred WHERE provider = 'meta'").get();
  assert.ok(row && !row.enc.includes('test-server-token'));
  assert.equal((fs.statSync(path.join(dir, 'business.key')).mode & 0o777).toString(8), '600');
});
