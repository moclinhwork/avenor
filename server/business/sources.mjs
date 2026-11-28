// Business → các nguồn dữ liệu bên ngoài: Google Ads, Meta Ads, GA4, YouTube, TikTok.
// Mỗi nguồn chỉ xin quyền ĐỌC báo cáo. Token được mã hoá và giữ ở máy chủ (xem index.mjs), không bao giờ gửi về trình duyệt.
// Phiên bản API kiểm tra ngày 28/11/2026: Google Ads API v26 (10/2026), Graph / Marketing API v26.0 (07/2026),
// GA4 Data API v1beta + Admin API v1beta, YouTube Data API v3 + YouTube Analytics API v2, TikTok Display API v2.
const env = (k, d = '') => process.env[k] || d;

export class AuthError extends Error { constructor(m = 'needs_authorization') { super(m); this.code = 'needs_authorization'; } }
export class SourceError extends Error { constructor(m, status) { super(m); this.code = 'source_error'; this.status = status; } }

export async function http(url, { method = 'GET', headers = {}, body, form, timeout = 20000 } = {}) {
  const init = { method, headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(timeout) };
  if (form) { init.body = new URLSearchParams(form); init.headers['Content-Type'] = 'application/x-www-form-urlencoded'; }
  else if (body !== undefined) { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json'; }
  let r;
  try { r = await fetch(url, init); } catch (e) { throw new SourceError(e.name === 'TimeoutError' ? 'timeout' : 'network'); }
  let j = null;
  const text = await r.text();
  try { j = text ? JSON.parse(text) : null; } catch { j = { raw: text.slice(0, 200) }; }
  if (r.status === 401 || j?.error === 'invalid_grant' || j?.error?.code === 190 || j?.error?.status === 'UNAUTHENTICATED') throw new AuthError();
  if (!r.ok || (j?.error && j.error.code !== 'ok' && typeof j.error === 'object' && j.error.message)) {
    const msg = j?.error?.message || j?.error_description || j?.error?.code || `http_${r.status}`;
    if (/CLOUD_PROJECT_NOT_APPROVED|DEVELOPER_TOKEN_NOT_APPROVED/.test(text)) throw new SourceError('Google Cloud project needs Google Ads API Explorer access (Cloud Console > Google Ads API > Overview > Request access)', r.status);
    if (r.status === 403 && /permission|scope|insufficient/i.test(String(msg))) throw new AuthError('missing_permission');
    throw new SourceError(String(msg).slice(0, 240), r.status);
  }
  return j;
}

const ymd = (s) => s.replace(/-/g, '');
const fromYmd = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const n = (v) => (v == null || v === '' ? 0 : Number(v));

// ---------------- Google (một OAuth client cho Ads, GA4, YouTube; mỗi nguồn xin đúng phạm vi cần) ----------------
export const GOOGLE_ID = env('BIZ_GOOGLE_CLIENT_ID', env('GOOGLE_CLIENT_ID'));
export const GOOGLE_SECRET = env('BIZ_GOOGLE_CLIENT_SECRET', env('GOOGLE_CLIENT_SECRET'));
const ADS_VER = env('GOOGLE_ADS_API_VERSION', 'v26');
// Từ 9/2026 Google bỏ developer token (quyền truy cập theo Cloud project); chỉ gửi header nếu còn đặt.
const ADS_DEV = env('GOOGLE_ADS_DEVELOPER_TOKEN');
const ADS_LOGIN = env('GOOGLE_ADS_LOGIN_CUSTOMER_ID').replace(/\D/g, '');
export const GOOGLE_SCOPES = {
  google_ads: ['https://www.googleapis.com/auth/adwords'],
  ga4: ['https://www.googleapis.com/auth/analytics.readonly'],
  youtube: ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/yt-analytics.readonly'],
};
export async function googleRefresh(tok) {
  const j = await http('https://oauth2.googleapis.com/token', { method: 'POST', form: { client_id: GOOGLE_ID, client_secret: GOOGLE_SECRET, refresh_token: tok.refresh, grant_type: 'refresh_token' } });
  return { ...tok, access: j.access_token, expires: Date.now() + (j.expires_in - 60) * 1000 };
}
const adsHeaders = (access, loginId) => ({ Authorization: `Bearer ${access}`, ...(ADS_DEV ? { 'developer-token': ADS_DEV } : {}), ...(loginId ? { 'login-customer-id': loginId } : {}) });
async function gaql(access, customer, query, loginId) {
  const out = [];
  let pageToken;
  do {
    const j = await http(`https://googleads.googleapis.com/${ADS_VER}/customers/${customer}/googleAds:search`, { method: 'POST', headers: adsHeaders(access, loginId), body: { query, ...(pageToken ? { pageToken } : {}) } });
    out.push(...(j?.results || []));
    pageToken = j?.nextPageToken;
  } while (pageToken);
  return out;
}

// ---------------- Meta ----------------
const META_VER = env('META_API_VERSION', 'v26.0');
export const META_ID = env('META_APP_ID');
export const META_SECRET = env('META_APP_SECRET');
export const META_SERVER_TOKEN = env('META_ACCESS_TOKEN');
const graph = (path, access, params = {}) => http(`https://graph.facebook.com/${META_VER}/${path}?${new URLSearchParams({ ...params, access_token: access })}`);
const PURCHASE = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_web_purchase'];
const MESSAGING = 'onsite_conversion.messaging_conversation_started_7d';
const pickAction = (arr, types) => { for (const t of types) { const a = (arr || []).find((x) => x.action_type === t); if (a) return n(a.value); } return null; };

// ---------------- TikTok ----------------
export const TIKTOK_KEY = env('TIKTOK_CLIENT_KEY');
export const TIKTOK_SECRET = env('TIKTOK_CLIENT_SECRET');
export const TIKTOK_SCOPES = ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'];
export async function tiktokRefresh(tok) {
  const j = await http('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', form: { client_key: TIKTOK_KEY, client_secret: TIKTOK_SECRET, grant_type: 'refresh_token', refresh_token: tok.refresh } });
  if (!j?.access_token) throw new AuthError();
  return { ...tok, access: j.access_token, refresh: j.refresh_token || tok.refresh, expires: Date.now() + (j.expires_in - 60) * 1000 };
}
const TT_VIDEO_FIELDS = 'id,title,video_description,cover_image_url,create_time,share_url,view_count,like_count,comment_count,share_count,duration';

// ---------------- định nghĩa nguồn ----------------
// configured(): biến môi trường còn thiếu. listAccounts(access): tài khoản chọn được. daily(): số liệu theo ngày (theo múi giờ báo cáo của nguồn).
export const SOURCES = {
  google_ads: {
    label: 'Google Ads', provider: 'google', group: 'marketing', syncEveryH: 3, lookback: 4, initial: 62,
    missing: () => [!GOOGLE_ID && 'BIZ_GOOGLE_CLIENT_ID', !GOOGLE_SECRET && 'BIZ_GOOGLE_CLIENT_SECRET'].filter(Boolean),
    async listAccounts(access) {
      const j = await http(`https://googleads.googleapis.com/${ADS_VER}/customers:listAccessibleCustomers`, { headers: adsHeaders(access) });
      const ids = (j?.resourceNames || []).map((r) => r.split('/')[1]).slice(0, 30);
      const out = [];
      for (const id of ids) {
        try {
          const [row] = await gaql(access, id, 'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager FROM customer LIMIT 1', ADS_LOGIN || undefined);
          const c = row?.customer || {};
          if (c.manager) continue;
          out.push({ id, name: c.descriptiveName || `Customer ${id}`, currency: c.currencyCode || '', tz: c.timeZone || '' });
        } catch (e) { if (e instanceof AuthError) throw e; out.push({ id, name: `Customer ${id}`, error: e.message }); }
      }
      return out;
    },
    async daily(conn, access, from, to) {
      const login = conn.meta?.loginId || ADS_LOGIN || undefined;
      const rows = await gaql(access, conn.account_id, `SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM customer WHERE segments.date BETWEEN '${from}' AND '${to}'`, login);
      let hasConv = conn.meta?.hasConversions;
      if (hasConv == null) {
        try { hasConv = (await gaql(access, conn.account_id, "SELECT conversion_action.id FROM conversion_action WHERE conversion_action.status = 'ENABLED' LIMIT 1", login)).length > 0; } catch { hasConv = null; }
      }
      return {
        meta: { hasConversions: hasConv },
        days: rows.map((r) => ({ d: r.segments.date, spend: n(r.metrics.costMicros) / 1e6, impressions: n(r.metrics.impressions), clicks: n(r.metrics.clicks), conversions: hasConv ? n(r.metrics.conversions) : null, convValue: hasConv ? n(r.metrics.conversionsValue) : null })),
      };
    },
    open: () => 'https://ads.google.com/aw/overview',
  },
  meta_ads: {
    label: 'Meta Ads', provider: 'meta', group: 'marketing', syncEveryH: 3, lookback: 4, initial: 62,
    missing: () => (META_SERVER_TOKEN || (META_ID && META_SECRET) ? [] : ['META_APP_ID + META_APP_SECRET (or META_ACCESS_TOKEN)']),
    async listAccounts(access) {
      const j = await graph('me/adaccounts', access, { fields: 'name,account_id,currency,timezone_name,account_status', limit: '100' });
      return (j?.data || []).map((a) => ({ id: a.account_id, name: a.name || `act_${a.account_id}`, currency: a.currency || '', tz: a.timezone_name || '', inactive: a.account_status !== 1 }));
    },
    async daily(conn, access, from, to) {
      const out = [];
      let next = `https://graph.facebook.com/${META_VER}/act_${conn.account_id}/insights?${new URLSearchParams({ level: 'account', time_increment: '1', time_range: JSON.stringify({ since: from, until: to }), fields: 'spend,impressions,clicks,actions,action_values', limit: '100', access_token: access })}`;
      let guard = 0;
      while (next && guard++ < 10) {
        const j = await http(next);
        for (const r of j?.data || []) {
          const purchases = pickAction(r.actions, PURCHASE);
          const value = pickAction(r.action_values, PURCHASE);
          out.push({ d: r.date_start, spend: n(r.spend), impressions: n(r.impressions), clicks: n(r.clicks), conversions: purchases, convValue: value, messaging: pickAction(r.actions, [MESSAGING]) });
        }
        next = j?.paging?.next || null;
      }
      const hasConv = out.some((d) => d.conversions != null);
      return { meta: { hasConversions: hasConv, conversionLabel: 'Purchases' }, days: out.map((d) => ({ ...d, conversions: hasConv ? (d.conversions || 0) : null, convValue: hasConv ? (d.convValue || 0) : null })) };
    },
    open: (c) => `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(c.account_id)}`,
  },
  ga4: {
    label: 'Website · GA4', provider: 'google', group: 'marketing', syncEveryH: 3, lookback: 3, initial: 62,
    missing: () => [!GOOGLE_ID && 'BIZ_GOOGLE_CLIENT_ID', !GOOGLE_SECRET && 'BIZ_GOOGLE_CLIENT_SECRET'].filter(Boolean),
    async listAccounts(access) {
      const j = await http('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200', { headers: { Authorization: `Bearer ${access}` } });
      const out = [];
      for (const a of j?.accountSummaries || []) for (const p of a.propertySummaries || []) out.push({ id: p.property.split('/')[1], name: `${p.displayName} · ${a.displayName}` });
      for (const p of out.slice(0, 20)) {
        try { const d = await http(`https://analyticsadmin.googleapis.com/v1beta/properties/${p.id}`, { headers: { Authorization: `Bearer ${access}` } }); p.tz = d.timeZone || ''; p.currency = d.currencyCode || ''; } catch { /* bỏ qua */ }
      }
      return out;
    },
    async daily(conn, access, from, to) {
      const j = await http(`https://analyticsdata.googleapis.com/v1beta/properties/${conn.account_id}:runReport`, { method: 'POST', headers: { Authorization: `Bearer ${access}` }, body: {
        dateRanges: [{ startDate: from, endDate: to }], dimensions: [{ name: 'date' }],
        metrics: ['activeUsers', 'sessions', 'screenPageViews', 'engagedSessions', 'keyEvents'].map((name) => ({ name })), limit: 1000, keepEmptyRows: true,
      } });
      return { days: (j?.rows || []).map((r) => { const v = r.metricValues.map((m) => n(m.value)); return { d: fromYmd(r.dimensionValues[0].value), activeUsers: v[0], sessions: v[1], views: v[2], engagedSessions: v[3], keyEvents: v[4] }; }) };
    },
    async extra(conn, access, from, to) {
      const run = (body) => http(`https://analyticsdata.googleapis.com/v1beta/properties/${conn.account_id}:runReport`, { method: 'POST', headers: { Authorization: `Bearer ${access}` }, body: { dateRanges: [{ startDate: from, endDate: to }], ...body } });
      const [tot, ch, lp, ev] = await Promise.all([
        run({ metrics: [{ name: 'activeUsers' }] }),
        run({ dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 8 }),
        run({ dimensions: [{ name: 'landingPage' }], metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 8 }),
        run({ dimensions: [{ name: 'eventName' }], metrics: [{ name: 'keyEvents' }], orderBys: [{ metric: { metricName: 'keyEvents' }, desc: true }], limit: 10 }),
      ]);
      const rows = (j) => (j?.rows || []).map((r) => ({ k: r.dimensionValues?.[0]?.value || '', v: r.metricValues.map((m) => n(m.value)) }));
      return {
        uniqueUsers: n(tot?.rows?.[0]?.metricValues?.[0]?.value),
        channels: rows(ch).map((r) => ({ name: r.k, sessions: r.v[0] })),
        landing: rows(lp).map((r) => ({ path: r.k, sessions: r.v[0], engaged: r.v[1] })),
        keyEvents: rows(ev).filter((r) => r.v[0] > 0).map((r) => ({ name: r.k, count: r.v[0] })),
      };
    },
    open: (c) => `https://analytics.google.com/analytics/web/#/p${encodeURIComponent(c.account_id)}/reports/intelligenthome`,
  },
  youtube: {
    label: 'YouTube', provider: 'google', group: 'channels', syncEveryH: 12, lookback: 5, initial: 62,
    // YouTube Analytics tính ngày theo giờ Thái Bình Dương (PT) và thường trễ 2–3 ngày.
    reportTz: 'America/Los_Angeles', lagDays: 3,
    missing: () => [!GOOGLE_ID && 'BIZ_GOOGLE_CLIENT_ID', !GOOGLE_SECRET && 'BIZ_GOOGLE_CLIENT_SECRET'].filter(Boolean),
    async listAccounts(access) {
      const j = await http('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', { headers: { Authorization: `Bearer ${access}` } });
      return (j?.items || []).map((c) => ({ id: c.id, name: c.snippet?.title || c.id, tz: 'America/Los_Angeles', meta: { handle: c.snippet?.customUrl || '', thumb: c.snippet?.thumbnails?.default?.url || '' } }));
    },
    async daily(conn, access, from, to) {
      const q = new URLSearchParams({ ids: `channel==${conn.account_id}`, startDate: from, endDate: to, metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost', dimensions: 'day', sort: 'day' });
      const j = await http(`https://youtubeanalytics.googleapis.com/v2/reports?${q}`, { headers: { Authorization: `Bearer ${access}` } });
      const st = await http(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${encodeURIComponent(conn.account_id)}`, { headers: { Authorization: `Bearer ${access}` } });
      const s = st?.items?.[0]?.statistics || {};
      return {
        meta: { subscribers: s.hiddenSubscriberCount ? null : n(s.subscriberCount), totalViews: n(s.viewCount), videoCount: n(s.videoCount), statsAt: Date.now() },
        days: (j?.rows || []).map((r) => ({ d: r[0], views: n(r[1]), watchMinutes: n(r[2]), subsGained: n(r[3]), subsLost: n(r[4]) })),
      };
    },
    async extra(conn, access, from, to) {
      const q = new URLSearchParams({ ids: `channel==${conn.account_id}`, startDate: from, endDate: to, metrics: 'views,estimatedMinutesWatched,likes,subscribersGained', dimensions: 'video', sort: '-views', maxResults: '10' });
      const j = await http(`https://youtubeanalytics.googleapis.com/v2/reports?${q}`, { headers: { Authorization: `Bearer ${access}` } });
      const rows = j?.rows || [];
      if (!rows.length) return { videos: [] };
      const v = await http(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${rows.map((r) => r[0]).join(',')}`, { headers: { Authorization: `Bearer ${access}` } });
      const sn = Object.fromEntries((v?.items || []).map((x) => [x.id, x.snippet]));
      return { videos: rows.map((r) => ({ id: r[0], title: sn[r[0]]?.title || r[0], thumb: sn[r[0]]?.thumbnails?.medium?.url || sn[r[0]]?.thumbnails?.default?.url || '', published: sn[r[0]]?.publishedAt || '', url: `https://www.youtube.com/watch?v=${r[0]}`, views: n(r[1]), watchMinutes: n(r[2]), likes: n(r[3]), subsGained: n(r[4]) })) };
    },
    open: (c) => `https://www.youtube.com/channel/${encodeURIComponent(c.account_id)}`,
    studio: (c) => `https://studio.youtube.com/channel/${encodeURIComponent(c.account_id)}/analytics`,
  },
  tiktok: {
    label: 'TikTok', provider: 'tiktok', group: 'channels', syncEveryH: 6, lookback: 1, initial: 1,
    // Display API chỉ trả số tổng hiện tại: Avenor tự chụp số người theo dõi mỗi ngày để có xu hướng.
    snapshot: true,
    missing: () => [!TIKTOK_KEY && 'TIKTOK_CLIENT_KEY', !TIKTOK_SECRET && 'TIKTOK_CLIENT_SECRET'].filter(Boolean),
    async listAccounts(access) {
      const j = await http('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username,avatar_url', { headers: { Authorization: `Bearer ${access}` } });
      const u = j?.data?.user;
      return u ? [{ id: u.open_id, name: u.display_name || u.username || 'TikTok', meta: { username: u.username || '', thumb: u.avatar_url || '' } }] : [];
    },
    async daily(conn, access, from, to, today) {
      const j = await http('https://open.tiktokapis.com/v2/user/info/?fields=open_id,username,follower_count,following_count,likes_count,video_count', { headers: { Authorization: `Bearer ${access}` } });
      const u = j?.data?.user || {};
      return { meta: { username: u.username || conn.meta?.username || '' }, days: [{ d: today, followers: n(u.follower_count), likes: n(u.likes_count), videos: n(u.video_count) }] };
    },
    async extra(conn, access, from, to) {
      const fromTs = Date.parse(`${from}T00:00:00+07:00`) / 1000, toTs = Date.parse(`${to}T23:59:59+07:00`) / 1000;
      const out = [];
      let cursor; let more = true; let guard = 0;
      while (more && guard++ < 6) {
        const j = await http(`https://open.tiktokapis.com/v2/video/list/?fields=${TT_VIDEO_FIELDS}`, { method: 'POST', headers: { Authorization: `Bearer ${access}` }, body: { max_count: 20, ...(cursor ? { cursor } : {}) } });
        const vids = j?.data?.videos || [];
        for (const v of vids) if (v.create_time >= fromTs && v.create_time <= toTs) out.push({ id: v.id, title: v.title || v.video_description || 'Untitled', thumb: v.cover_image_url || '', published: new Date(v.create_time * 1000).toISOString(), url: v.share_url || '', views: n(v.view_count), likes: n(v.like_count), comments: n(v.comment_count), shares: n(v.share_count) });
        more = !!j?.data?.has_more && vids.length > 0 && Math.min(...vids.map((v) => v.create_time)) >= fromTs;
        cursor = j?.data?.cursor;
      }
      return { videos: out.sort((a, b) => b.views - a.views).slice(0, 10), lifetime: true };
    },
    open: (c) => `https://www.tiktok.com/@${encodeURIComponent(c.meta?.username || '')}`,
  },
};

export { ymd };
