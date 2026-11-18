import { MODULES } from '../modules/registry.js';
import { todayIso } from './format.js';

// Gom việc cần làm từ mọi module có khai báo `agenda` cho một ngày.
export function collectAgenda(state, date) {
  const isToday = date === todayIso;
  return MODULES.filter((m) => m.agenda && state[m.id]).flatMap((m) =>
    m.agenda(state[m.id], date, isToday, state).map((it) => ({ ...it, moduleTitle: m.short || m.title })));
}

// Gom các mốc thời gian (lịch hẹn, hạn thanh toán, ngày đi…) từ mọi module có `events`.
export function collectEvents(state) {
  return MODULES.filter((m) => m.events && state[m.id]).flatMap((m) =>
    m.events(state[m.id]).map((e) => ({ ...e, module: m.id, icon: e.icon || m.icon })));
}
