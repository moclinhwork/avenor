// Liên kết thói quen với dữ liệu ở module Sức khỏe: ngày nào có buổi chạy (Tập luyện)
// hoặc buổi Pickleball thì thói quen tự được tích hoàn thành.
// log[ngày] = true (tự tích) | false (tự bỏ tích, thắng cả dữ liệu tự động) | không có (theo dữ liệu tự động).
import { playedIds } from '../health/pickleball.js';
import { todayIso } from '../../core/format.js';

export const LINKS = {
  none: { label: 'Không liên kết' },
  run: { label: 'Chạy bộ · Sức khỏe/Tập luyện', sport: 'run', km: true },
  walk: { label: 'Đi bộ · Sức khỏe/Tập luyện', sport: 'walk', km: true },
  ride: { label: 'Đạp xe · Sức khỏe/Tập luyện', sport: ['ride', 'ebike'], km: true },
  swim: { label: 'Bơi lội · Sức khỏe/Tập luyện', sport: 'swim', km: true },
  any: { label: 'Bất kỳ buổi tập nào · Sức khỏe/Tập luyện', sport: '*' },
  pickleball: { label: 'Pickleball · Sức khỏe/Pickleball' },
};
export const LINK_ORDER = ['none', 'run', 'pickleball', 'walk', 'ride', 'swim', 'any'];

// Đoán liên kết từ tên thói quen khi người dùng chưa chọn.
export function guessLink(name) {
  const n = String(name || '').toLowerCase();
  if (/pickle/.test(n)) return 'pickleball';
  if (/chạy|\brun|jog/.test(n)) return 'run';
  if (/đi bộ|\bwalk/.test(n)) return 'walk';
  if (/đạp xe|xe đạp|\bbike|cycling/.test(n)) return 'ride';
  if (/\bbơi|\bswim/.test(n)) return 'swim';
  return 'none';
}
export const linkOf = (h) => h.link || guessLink(h.name);

// Các ngày có dữ liệu khớp, kèm mô tả ngắn để hiện "vì sao được tích".
export function autoDays(h, health) {
  const link = linkOf(h);
  const out = {};
  if (!health || link === 'none') return out;
  if (link === 'pickleball') {
    const pb = health.pickleball;
    if (!pb) return out;
    pb.sessions.forEach((s) => {
      if (s.status === 'cancelled' || s.date > todayIso) return;
      if (playedIds(s).includes(pb.me)) out[s.date] = `Pickleball ${s.start}–${s.end}`;
    });
    return out;
  }
  const def = LINKS[link];
  if (!def) return out;
  const sports = def.sport === '*' ? null : [].concat(def.sport);
  const byDay = {};
  (health.workouts || []).forEach((w) => {
    if (w.source === 'sample' || w.date > todayIso) return;
    if (sports && !sports.includes(w.type)) return;
    (byDay[w.date] = byDay[w.date] || []).push(w);
  });
  Object.entries(byDay).forEach(([d, list]) => {
    const km = list.reduce((t, w) => t + (w.km || 0), 0);
    if (h.minKm && def.km && km < h.minKm) return;
    out[d] = def.km && km ? `${km.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km` : `${list.length} buổi tập`;
  });
  return out;
}

// Thói quen với log hiệu lực (gộp tự động + tay) để các màn khác dùng như cũ.
export function effective(h, health) {
  const auto = autoDays(h, health);
  if (!Object.keys(auto).length) return { ...h, auto };
  const log = {};
  Object.keys(auto).forEach((d) => { log[d] = true; });
  Object.entries(h.log || {}).forEach(([d, v]) => { if (v) log[d] = true; else delete log[d]; });
  return { ...h, log, auto, rawLog: h.log };
}
export const effectiveAll = (slice, health) => (slice?.habits || []).map((h) => effective(h, health));
