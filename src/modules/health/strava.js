// Đồng bộ buổi tập từ Strava qua connector "Strava" của người dùng (capability `mcp`).
// Mã lỗi theo hợp đồng của nền tảng; mỗi mã có cách xử lý riêng.

import { api, SERVER } from '../../core/platform.js';

export const STRAVA = 'Strava';
const TOOL = 'list_activities';

async function useMcp() {
  try {
    if (!window.claude?.use) return null;
    return await Promise.race([window.claude.use('mcp'), new Promise((r) => setTimeout(() => r(null), 8000))]);
  } catch { return null; }
}

export async function stravaAvailable() {
  if (SERVER) { try { const r = await api('/api/strava/status'); return r.connected ? true : r.configured ? 'connect' : false; } catch { return false; } }
  return !!(await useMcp());
}

// Bản VPS: máy chủ giữ token Strava, trình duyệt chỉ chuyển hướng để cấp quyền.
export const stravaConnect = () => { location.href = '/api/strava/connect'; };
export const stravaDisconnect = () => api('/api/strava/disconnect', { method: 'POST' });

// Dựng tham số theo schema thật của tool (nếu đọc được); không đoán tên trường.
async function buildInput(mcp, days) {
  const after = Math.floor(Date.now() / 1000) - days * 86400;
  try {
    const d = await mcp.describeTool(STRAVA, TOOL);
    const props = d?.inputSchema?.properties || {};
    const input = {};
    for (const [k, def] of Object.entries(props)) {
      const key = k.toLowerCase();
      if (key === 'after' || key.includes('after') || key === 'start_date' || key === 'since') {
        input[k] = def?.type === 'string' ? new Date(after * 1000).toISOString() : after;
      } else if (key === 'per_page' || key === 'limit' || key === 'count' || key === 'max_results') {
        const max = typeof def?.maximum === 'number' ? def.maximum : 100;
        input[k] = Math.min(100, max);
      }
    }
    return input;
  } catch {
    return {};
  }
}

const TYPE_MAP = { walk: 'walk', hike: 'walk', run: 'run', trailrun: 'run', virtualrun: 'run' };

function findList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    for (const k of ['activities', 'data', 'items', 'results']) if (Array.isArray(payload[k])) return payload[k];
    const arr = Object.values(payload).find((v) => Array.isArray(v) && v.some((x) => x && typeof x === 'object'));
    if (arr) return arr;
  }
  return null;
}

function toWorkout(a) {
  const rawType = String(a.sport_type || a.type || a.activity_type || '').replace(/\s|_/g, '').toLowerCase();
  const type = TYPE_MAP[rawType];
  if (!type) return null;
  let km = null;
  if (typeof a.distance_km === 'number') km = a.distance_km;
  else if (typeof a.distance_meters === 'number') km = a.distance_meters / 1000;
  else if (typeof a.distance === 'number') km = a.distance / 1000;
  else if (typeof a.distance === 'string') { const n = parseFloat(a.distance); if (!Number.isNaN(n)) km = /km/i.test(a.distance) ? n : n / 1000; }
  const when = a.start_date_local || a.start_date || a.date;
  if (km == null || !when) return null;
  const secs = a.moving_time ?? a.moving_time_seconds ?? a.elapsed_time ?? 0;
  return {
    id: `strava-${a.id ?? `${when}-${km}`}`,
    date: String(when).slice(0, 10),
    type,
    km: +km.toFixed(2),
    minutes: Math.round((typeof secs === 'number' ? secs : parseFloat(secs) || 0) / 60),
    name: a.name || (type === 'run' ? 'Chạy bộ' : 'Đi bộ'),
    source: 'strava',
  };
}

const ADD = 'Chưa kết nối Strava. Vào claude.ai → Cài đặt → Connectors, thêm Strava và đăng nhập tài khoản Strava, rồi tải lại app và bấm đồng bộ.';
const NO_MCP = 'Màn hình này không gọi được Strava. Hãy mở app trên claude.ai (trình duyệt hoặc app Claude) khi đã đăng nhập, rồi thử lại.';
const MESSAGES = {
  server_not_connected: ADD,
  server_not_found: ADD,
  no_mcp: NO_MCP,
  not_granted: NO_MCP,
  capability_disabled: NO_MCP,
  capability_removed: NO_MCP,
  needs_reauth: 'Phiên đăng nhập Strava đã hết hạn. Kết nối lại Strava trong claude.ai → Cài đặt → Connectors.',
  selection_required: 'Bạn có nhiều kết nối Strava. Hãy chọn một kết nối trong hộp thoại của Claude rồi thử lại.',
  not_in_manifest: 'Strava đang bị tắt cho app này. Bật lại quyền Strava cho app trong claude.ai rồi thử lại.',
  approval_required: 'Cần bạn cho phép app đọc dữ liệu Strava. Bấm đồng bộ lại và chọn Cho phép.',
  consent_required: 'Cần bạn cho phép app đọc dữ liệu Strava. Bấm đồng bộ lại và chọn Cho phép.',
  blocked_by_policy: 'Tổ chức của bạn đang chặn connector Strava.',
  server_unavailable: 'Strava đang không phản hồi, thử lại sau ít phút.',
  strava_not_connected: 'Chưa kết nối tài khoản Strava hoặc quyền truy cập đã bị thu hồi. Bấm "Kết nối Strava" để cấp quyền lại.',
  strava_error: 'Strava đang báo lỗi, thử lại sau ít phút.',
  rate_limited: 'Đồng bộ quá nhiều lần liên tiếp, thử lại sau ít phút.',
  tool_error: 'Strava báo lỗi khi lấy danh sách hoạt động.',
  shape: 'Strava trả về dữ liệu theo định dạng app chưa đọc được.',
};
export const errorText = (e) => {
  const code = e?.code || 'unknown';
  const msg = MESSAGES[code] || 'Không đồng bộ được với Strava lúc này.';
  return `${msg} (mã lỗi: ${code})`;
};

/** Lấy hoạt động đi bộ/chạy bộ trong `days` ngày gần nhất. */
export async function fetchStrava(days = 30) {
  if (SERVER) {
    const after = Math.floor(Date.now() / 1000) - days * 86400;
    const r = await api(`/api/strava/activities?after=${after}`);
    return { workouts: r.activities.map(toWorkout).filter(Boolean), total: r.activities.length };
  }
  const mcp = await useMcp();
  if (!mcp) { const err = new Error('no_mcp'); err.code = 'no_mcp'; throw err; }
  try {
    const list = await mcp.listTools(STRAVA);
    const servers = list?.servers || list || [];
    const entry = Array.isArray(servers) ? servers.find((x) => x?.name === STRAVA || x?.server === STRAVA) : null;
    if (Array.isArray(servers) && (!entry || (Array.isArray(entry.tools) && entry.tools.length === 0 && entry.authStatus !== 'unknown'))) {
      const err = new Error('server_not_connected'); err.code = 'server_not_connected'; throw err;
    }
  } catch (e) { if (e?.code === 'server_not_connected') throw e; /* listTools lỗi: vẫn thử gọi */ }
  const input = await buildInput(mcp, days);
  let res;
  try {
    res = await mcp.callTool(STRAVA, TOOL, input, { cache: false });
  } catch (e) {
    if (e?.retryable) {
      await new Promise((r) => setTimeout(r, Math.min(10000, e.retryAfterMs || 1500 + Math.random() * 1500)));
      res = await mcp.callTool(STRAVA, TOOL, input, { cache: false });
    } else throw e;
  }
  const list = findList(res?.payload);
  if (!list) { const err = new Error('shape'); err.code = 'shape'; throw err; }
  return { workouts: list.map(toWorkout).filter(Boolean), total: list.length };
}
