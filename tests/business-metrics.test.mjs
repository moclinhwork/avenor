// node --test tests/  — quy tắc số liệu của module Business
import test from 'node:test';
import assert from 'node:assert/strict';
import { period, total, delta, series, adsTotals, salesTotals, webTotals, ytTotals, ttTotals, sumSpend, goalProgress, attention, fmtDelta } from '../src/modules/business/metrics.js';

const at = (s) => Date.parse(s); // giờ UTC

test('periods use Vietnam time, week starts Monday, compare same span', () => {
  // 2026-11-28 14:30 giờ VN (thứ Bảy) = 07:30 UTC
  const now = at('2026-11-28T07:30:00Z');
  const t = period('today', { now });
  assert.equal(t.from, '2026-11-28'); assert.equal(t.prev.from, '2026-11-27'); assert.equal(t.prev.cut, '14:30');
  const w = period('week', { now });
  assert.equal(w.from, '2026-11-23'); assert.equal(w.prev.from, '2026-11-16'); assert.equal(w.prev.to, '2026-11-21');
  const m = period('month', { now });
  assert.equal(m.from, '2026-11-01'); assert.equal(m.prev.from, '2026-10-01'); assert.equal(m.prev.to, '2026-10-28');
  // 23:30 UTC ngày 30/11 đã là 01/12 ở VN
  assert.equal(period('today', { now: at('2026-11-30T23:30:00Z') }).from, '2026-12-01');
  // Chủ nhật vẫn thuộc tuần bắt đầu thứ Hai trước đó
  assert.equal(period('week', { now: at('2026-11-29T05:00:00Z') }).from, '2026-11-23');
});

test('month edge: 31st compares with whole shorter previous month', () => {
  const m = period('month', { now: at('2026-03-31T05:00:00Z') });
  assert.equal(m.prev.to, '2026-02-28'); assert.equal(m.prev.cut, undefined);
  const j = period('month', { now: at('2026-01-15T05:00:00Z') });
  assert.equal(j.prev.from, '2025-12-01'); assert.equal(j.prev.to, '2025-12-15');
});

test('custom period: previous = same length right before, future clipped', () => {
  const c = period('custom', { from: '2026-11-10', to: '2026-11-16', now: at('2026-11-28T05:00:00Z') });
  assert.equal(c.prev.from, '2026-11-03'); assert.equal(c.prev.to, '2026-11-09'); assert.equal(c.live, false); assert.equal(c.prev.cut, undefined);
  const f = period('custom', { from: '2026-11-25', to: '2026-12-31', now: at('2026-11-28T05:00:00Z') });
  assert.equal(f.to, '2026-11-28');
});

test('zero is valid, missing is null, prev 0 gives absolute change', () => {
  assert.equal(total([{ d: '2026-11-01' }, { d: '2026-11-02' }], 'revenue'), 0);
  assert.equal(total([], 'revenue'), null);
  assert.equal(total([{ d: 'x', spend: 5, conversions: null }], 'conversions'), null);
  assert.deepEqual(delta(5, 0), { kind: 'fromZero', abs: 5 });
  assert.deepEqual(delta(0, 0), { kind: 'same', abs: 0 });
  assert.equal(delta(null, 3), null);
  assert.equal(delta(150, 100).pct, 50);
  assert.equal(fmtDelta(delta(5, 0)), '+5 (from 0)');
  assert.equal(fmtDelta(delta(0, 0)), 'No change');
});

test('ratios come from totals, not averages of daily ratios', () => {
  const days = [{ d: 'a', spend: 100, impressions: 1000, clicks: 10, conversions: 1, convValue: 0 }, { d: 'b', spend: 900, impressions: 1000, clicks: 90, conversions: 9, convValue: 0 }];
  const t = adsTotals(days);
  assert.equal(t.ctr, 5); // 100 / 2000, không phải trung bình (1% + 9%) / 2
  assert.equal(t.cpc, 10); assert.equal(t.cpa, 100);
  assert.equal(t.roas, null, 'ROAS hidden without conversion value');
  assert.equal(adsTotals([{ d: 'a', spend: 10, impressions: 0, clicks: 0 }]).ctr, null);
  const s = salesTotals([{ d: 'a', revenue: 300, orders: 2, created: 3 }, { d: 'b', revenue: 0, orders: 0, created: 0 }]);
  assert.equal(s.aov, 150); assert.equal(s.created, 3);
  assert.equal(salesTotals([{ d: 'a', revenue: 0, orders: 0 }]).aov, null);
  assert.equal(webTotals([{ d: 'a', sessions: 200, engagedSessions: 50 }, { d: 'b', sessions: 0, engagedSessions: 0 }]).engagement, 25);
  assert.deepEqual(ytTotals([{ d: 'a', views: 10, watchMinutes: 120, subsGained: 5, subsLost: 2 }]), { views: 10, watchHours: 2, subsGained: 5, subsLost: 2, net: 3 });
});

test('chart series uses the same rows as the totals', () => {
  const days = [{ d: '2026-11-01', revenue: 100 }, { d: '2026-11-02' }];
  const s = series(days, '2026-11-01', '2026-11-03', 'revenue');
  assert.deepEqual(s.map((x) => x.v), [100, 0, null]);
  assert.equal(s.reduce((a, x) => a + (x.v || 0), 0), total(days, 'revenue'));
});

test('tiktok follower change from snapshots', () => {
  const t = ttTotals([{ d: '2026-11-09', followers: 100 }, { d: '2026-11-12', followers: 130 }], '2026-11-10');
  assert.equal(t.change, 30); assert.equal(t.followers, 130);
  assert.equal(ttTotals([{ d: '2026-11-12', followers: 130 }], '2026-11-10').change, null);
});

test('ad spend only added up in the same currency', () => {
  const r = sumSpend([{ spend: 100, currency: 'VND' }, { spend: 5, currency: 'USD' }, { spend: 50, currency: 'VND', tz: 'America/Los_Angeles' }]);
  assert.equal(r.total, 150); assert.equal(r.skipped.length, 1); assert.equal(r.tzMismatch.length, 1);
  assert.equal(sumSpend([{ spend: 5, currency: 'USD' }]).total, null);
});

test('monthly goal keeps the real number when passed', () => {
  const g = goalProgress(100, 130, '2026-11-15');
  assert.equal(g.over, 30); assert.equal(g.remaining, 0); assert.equal(g.pct, 130);
  assert.equal(goalProgress(0, 10), null);
});

test('needs attention: auth, errors, stale data, thresholds', () => {
  const now = at('2026-11-28T05:00:00Z');
  const a = attention({
    now,
    connections: [
      { id: '1', name: 'Meta', status: 'needs_auth', syncEveryH: 3 },
      { id: '2', name: 'GA4', status: 'error', error: 'boom', syncEveryH: 3 },
      { id: '3', name: 'YT', status: 'connected', syncEveryH: 12, lastOk: now - 30 * 3600e3 },
      { id: '4', name: 'Ads', status: 'connected', syncEveryH: 3, lastOk: now - 3600e3 },
    ],
    values: { revenue: 1000, periodLabel: 'Today' },
    thresholds: [{ id: 't', metric: 'revenue', op: 'below', value: '5000' }, { id: 'u', metric: 'revenue', op: 'above', value: '5000' }],
  });
  assert.deepEqual(a.map((x) => x.id), ['auth-1', 'err-2', 'old-3', 'th-t']);
});
