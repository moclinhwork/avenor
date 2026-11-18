// Life Command: mô tả và thực hiện các thao tác do AI đề xuất. Mỗi thao tác chỉ ghi khi người dùng bấm Lưu.
import { addDays, dm, iso, num, parse, TODAY, todayIso, uid, vnd } from '../../core/format.js';
import { catById } from '../finance/data.js';
import { CATS as GOAL_CATS } from '../goals/data.js';
import { SPORTS } from '../health/sports.js';
import { initial as ideasInitial } from '../ideas/data.js';

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s).getTime());
const day = (s) => (isDate(s) ? s : todayIso);
const dayLabel = (s) => (s === todayIso ? 'hôm nay' : s === iso(addDays(TODAY, -1)) ? 'hôm qua' : dm(s));
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').trim();
const findHabit = (state, name) => {
  const list = state.habits?.habits || [];
  const n = norm(name);
  return list.find((h) => norm(h.name) === n) || list.find((h) => norm(h.name).includes(n) || n.includes(norm(h.name)));
};
const INCOME = { income: 'Thu nhập', freelance: 'Freelance' };

// Trả về { module, icon, title, detail, error? } để hiện trên thẻ xác nhận.
export function describe(state, a) {
  const x = a.input || {};
  switch (a.name) {
    case 'add_transaction': {
      const ok = Number.isFinite(x.amount) && x.amount > 0;
      const cat = x.type === 'in' ? INCOME[x.category] || 'Thu nhập' : catById[x.category]?.label || 'Khác';
      return { module: 'finance', icon: 'wallet', title: `${x.type === 'in' ? 'Thu' : 'Chi'} ${ok ? vnd(x.amount) : '?'} · ${x.title || ''}`, detail: `${cat} · ${dayLabel(day(x.date))}`, error: ok ? '' : 'Số tiền không hợp lệ' };
    }
    case 'log_workout': {
      const sp = SPORTS[x.sport] || SPORTS.workout;
      const bits = [x.km ? `${num(x.km)} km` : '', x.minutes ? `${x.minutes} phút` : ''].filter(Boolean).join(', ');
      return { module: 'health', icon: 'dumbbell', title: `${sp.label}${bits ? ` ${bits}` : ''}`, detail: `Sức khỏe/Tập luyện · ${dayLabel(day(x.date))}`, error: !x.km && !x.minutes && sp.km ? 'Thiếu số km hoặc số phút' : '' };
    }
    case 'log_weight': {
      const ok = x.weight > 20 && x.weight < 300;
      return { module: 'health', icon: 'scale', title: `Cân nặng ${ok ? `${num(x.weight)} kg` : '?'}${x.waist ? ` · eo ${num(x.waist)} cm` : ''}`, detail: `Sức khỏe/Chỉ số · ${dayLabel(day(x.date))}`, error: ok ? '' : 'Cân nặng không hợp lệ' };
    }
    case 'add_goal':
      return { module: 'goals', icon: 'target', title: `Mục tiêu: ${x.title || ''}`, detail: `${GOAL_CATS[x.category]?.label || 'Cuộc sống'} · hạn ${isDate(x.deadline) ? dm(x.deadline) + '/' + x.deadline.slice(0, 4) : 'chưa rõ'}`, error: x.title ? '' : 'Thiếu tên mục tiêu' };
    case 'check_habit': {
      const h = findHabit(state, x.habit);
      return { module: 'habits', icon: 'repeat', title: `${x.done === false ? 'Bỏ tích' : 'Tích'} "${h?.name || x.habit}"`, detail: `Thói quen · ${dayLabel(day(x.date))}`, error: h ? '' : 'Không tìm thấy thói quen này' };
    }
    case 'add_book': {
      const exist = (state.books?.books || []).find((b) => norm(b.title) === norm(x.title));
      const st = { unread: 'Muốn đọc', reading: 'Đang đọc', read: 'Đã đọc xong' }[x.status] || 'Muốn đọc';
      return { module: 'books', icon: 'book', title: `${exist ? 'Cập nhật' : 'Thêm sách'}: ${x.title || ''}`, detail: `${st}${x.author ? ` · ${x.author}` : ''}`, error: x.title ? '' : 'Thiếu tên sách' };
    }
    case 'add_trip_plan':
      return { module: 'travel', icon: 'plane', title: `Dự định đi ${x.name || ''}`, detail: `Tháng ${x.month}/${x.year}${x.budget ? ` · ${vnd(x.budget)}` : ''}`, error: x.name && x.month >= 1 && x.month <= 12 ? '' : 'Thiếu điểm đến hoặc tháng' };
    case 'add_idea':
      return { module: 'ideas', icon: 'bulb', title: `Ý tưởng: ${x.title || ''}`, detail: String(x.text || '').slice(0, 120), error: x.text || x.title ? '' : 'Ý tưởng trống' };
    case 'add_task':
      return { module: 'today', icon: 'check', title: x.title || '', detail: `Việc cần làm · ${dayLabel(day(x.date))}${x.priority === 'high' ? ' · ưu tiên' : ''}`, error: x.title ? '' : 'Thiếu nội dung việc' };
    default:
      return { module: 'today', icon: 'sparkle', title: a.name, detail: '', error: 'Lệnh không hỗ trợ' };
  }
}

// Trả về { id: module, fn: slice => slice mới } để ghi bằng update(id, fn).
export function toUpdate(state, a) {
  const x = a.input || {};
  switch (a.name) {
    case 'add_transaction':
      return { id: 'finance', fn: (s) => ({ ...s, transactions: [...s.transactions, { id: uid(), date: day(x.date), title: x.title || 'Giao dịch', amount: Math.round(x.amount), cat: x.type === 'in' ? (x.category === 'freelance' ? 'freelance' : 'income') : (catById[x.category] ? x.category : 'other'), type: x.type === 'in' ? 'in' : 'out' }] }) };
    case 'log_workout': {
      const type = SPORTS[x.sport] ? x.sport : 'workout';
      return { id: 'health', fn: (s) => ({ ...s, workouts: [...(s.workouts || []), { id: uid(), date: day(x.date), type, km: x.km ? +Number(x.km).toFixed(2) : 0, minutes: x.minutes || 0, name: SPORTS[type].label, source: 'manual' }] }) };
    }
    case 'log_weight':
      return { id: 'health', fn: (s) => {
        const d = day(x.date);
        const last = [...(s.entries || [])].sort((p, q) => p.date.localeCompare(q.date)).at(-1);
        return { ...s, entries: [...(s.entries || []).filter((e) => e.date !== d), { id: uid(), date: d, weight: +x.weight, waist: x.waist ? +x.waist : last?.waist ?? null }] };
      } };
    case 'add_goal':
      return { id: 'goals', fn: (s) => ({ ...s, goals: [{ id: uid(), title: x.title.trim(), cat: GOAL_CATS[x.category] ? x.category : 'life', start: todayIso, deadline: isDate(x.deadline) ? x.deadline : iso(addDays(TODAY, 90)), milestones: [] }, ...s.goals] }) };
    case 'check_habit': {
      const h = findHabit(state, x.habit);
      const d = day(x.date);
      return { id: 'habits', fn: (s) => ({ ...s, habits: s.habits.map((y) => (y.id === h.id ? { ...y, log: { ...y.log, [d]: x.done !== false } } : y)) }) };
    }
    case 'add_book':
      return { id: 'books', fn: (s) => {
        const exist = s.books.find((b) => norm(b.title) === norm(x.title));
        const status = ['unread', 'reading', 'read'].includes(x.status) ? x.status : 'unread';
        if (exist) return { ...s, books: s.books.map((b) => (b.id === exist.id ? { ...b, status, read: status === 'read' ? b.pages : b.read, finished: status === 'read' ? todayIso : b.finished } : b)) };
        return { ...s, books: [{ id: uid(), title: x.title.trim(), author: x.author || 'Chưa rõ', status, pages: 300, read: status === 'read' ? 300 : 0, colors: ['#24433b', '#d9fff1'], fav: false, ...(status === 'read' ? { finished: todayIso } : {}) }, ...s.books] };
      } };
    case 'add_trip_plan':
      return { id: 'travel', fn: (s) => ({ ...s, yearPlan: [...(s.yearPlan || []), { id: uid(), year: x.year, month: x.month, name: x.name, place: '', dates: '', budget: x.budget || 0, status: 'idea', scene: 'sea', note: x.note || '' }] }) };
    case 'add_idea':
      return { id: 'ideas', fn: (s) => {
        const base = s || ideasInitial;
        return { ...base, ideas: [{ id: uid(), createdAt: new Date().toISOString(), duration: 0, title: x.title || String(x.text).slice(0, 40), transcript: x.text || x.title, categoryId: 'inbox', stt: 'done', sttError: '', done: false, titleEdited: true, transcriptEdited: true }, ...(base.ideas || [])] };
      } };
    case 'add_task':
      return { id: 'today', fn: (s) => ({ ...s, tasks: [...s.tasks, { id: uid(), date: day(x.date), title: x.title.trim(), done: false, priority: x.priority === 'high' ? 'high' : 'normal' }] }) };
    default:
      return null;
  }
}

// Ngữ cảnh tối thiểu gửi kèm lệnh: ngày hôm nay, tên thói quen và tên sách (để khớp đúng).
export function commandContext(state) {
  return {
    today: todayIso,
    weekday: ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][TODAY.getDay()],
    habits: (state.habits?.habits || []).map((h) => h.name),
    books: (state.books?.books || []).filter((b) => b.status !== 'read').map((b) => b.title),
  };
}
