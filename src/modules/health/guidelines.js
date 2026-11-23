// Sức khỏe → Nguyên tắc: danh sách thực phẩm, đồ uống, thói quen nên ưu tiên, hạn chế hoặc tránh.
// Dữ liệu nằm trong lát `health` (h.guidelines) nên được lưu và đồng bộ theo tài khoản như phần còn lại của Sức khỏe.
// Chỉ có logic thuần ở đây (không React) để kiểm thử được bằng node.
import { iso, num, TODAY, uid } from '../../core/format.js';
import { bmi } from './data.js';

export const DIRECTIONS = {
  encourage: { label: 'Nên ưu tiên', short: 'Ưu tiên', hint: 'Nên ăn, uống hoặc làm nhiều hơn', icon: 'leaf', tone: 'enc' },
  limit: { label: 'Hạn chế', short: 'Hạn chế', hint: 'Nên giảm bớt, giữ ở mức vừa phải', icon: 'minusCircle', tone: 'lim' },
  avoid: { label: 'Cần tránh', short: 'Tránh', hint: 'Không dùng, kèm lý do hoặc điều kiện', icon: 'ban', tone: 'avo' },
};
export const DIRECTION_ORDER = ['encourage', 'limit', 'avoid'];
export const STATUSES = {
  active: { label: 'Đang áp dụng' },
  paused: { label: 'Tạm dừng' },
  archived: { label: 'Lưu trữ' },
};
export const SOURCES = {
  personal: { label: 'Ghi chú cá nhân' },
  professional: { label: 'Hướng dẫn chuyên môn' },
  reference: { label: 'Tài liệu tham khảo' },
};
export const CAT_ICONS = ['fork', 'cup', 'layers', 'tag', 'star', 'leaf', 'heart', 'moon', 'dumbbell', 'drop'];
export const CAT_COLORS = ['#4f7f68', '#6f9ca3', '#c9962e', '#8e7cc3', '#d9826b', '#a5432f', '#7a8b52', '#5b7fa8'];

// Chỉ số Sức khỏe có thể liên kết. `tab` + `anchor` là nơi mở lịch sử chỉ số.
export const METRICS = {
  weight: { label: 'Cân nặng', icon: 'scale', tab: 'metrics', anchor: 'weight' },
  waist: { label: 'Vòng eo', icon: 'waist', tab: 'metrics', anchor: 'waist' },
  bmi: { label: 'BMI', icon: 'heart', tab: 'metrics', anchor: 'weight' },
  bp: { label: 'Huyết áp', icon: 'drop', tab: 'metrics', anchor: 'bp' },
  restingHr: { label: 'Nhịp tim nghỉ', icon: 'heart', tab: 'metrics', anchor: 'vitals' },
  sleep: { label: 'Giấc ngủ', icon: 'moon', tab: 'metrics', anchor: 'vitals' },
  steps: { label: 'Bước chân', icon: 'bolt', tab: 'metrics', anchor: 'vitals' },
  water: { label: 'Nước uống', icon: 'drop', tab: 'metrics', anchor: 'vitals' },
  training: { label: 'Quãng đường tập luyện', icon: 'dumbbell', tab: 'training', anchor: '' },
};
export const metricLink = (id) => { const m = METRICS[id]; return m ? `health?tab=${m.tab}${m.anchor ? `&metric=${m.anchor}` : ''}` : 'health'; };
// Giá trị gần nhất của chỉ số, để hiện cạnh liên kết.
export function metricValue(h, id) {
  const es = [...(h?.entries || [])].sort((a, b) => a.date.localeCompare(b.date));
  const last = es[es.length - 1];
  const bp = [...(h?.bp || [])].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).at(-1);
  const v = h?.vitals || {};
  switch (id) {
    case 'weight': return last ? `${num(last.weight)} kg` : '';
    case 'waist': return last?.waist ? `${num(last.waist)} cm` : '';
    case 'bmi': return last && h.height ? num(bmi(last.weight, h.height)) : '';
    case 'bp': return bp ? `${bp.sys}/${bp.dia}` : '';
    case 'restingHr': return v.restingHr ? `${v.restingHr} bpm` : '';
    case 'sleep': return v.sleepAvg ? `${num(v.sleepAvg)} giờ` : '';
    case 'steps': return v.steps ? `${v.steps.toLocaleString('vi-VN')} bước` : '';
    case 'water': return v.water ? `${num(v.water)} lít` : '';
    case 'training': {
      const from = iso(new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - 6));
      const km = (h?.workouts || []).filter((w) => w.source !== 'sample' && w.date >= from).reduce((s, w) => s + (w.km || 0), 0);
      return `${num(km)} km / 7 ngày`;
    }
    default: return '';
  }
}

export const FOOD_CAT = 'food';
const DEFAULT_CATS = [
  { id: 'food', name: 'Thực phẩm', icon: 'fork', color: '#4f7f68', kind: 'food' },
  { id: 'drinks', name: 'Đồ uống', icon: 'cup', color: '#6f9ca3' },
  { id: 'habits', name: 'Thói quen', icon: 'layers', color: '#c9962e' },
];
const DEFAULT_GROUPS = [
  ['vegetables', 'Rau củ'], ['fruit', 'Trái cây'], ['grains', 'Ngũ cốc'], ['protein', 'Chất đạm'],
  ['dairy', 'Sữa & sản phẩm thay thế'], ['nuts', 'Các loại hạt'], ['snacks', 'Đồ ăn vặt & đồ ngọt'], ['other', 'Khác'],
].map(([id, name]) => ({ id, name }));

const now = () => new Date().toISOString();
const SAMPLE_NOTE = 'Dữ liệu mẫu, chỉ mang tính tham khảo chung. Việc áp dụng cho bạn tùy tình trạng sức khỏe và nguồn hướng dẫn bạn ghi nhận.';
function sampleItems() {
  const t = now();
  const mk = (id, title, direction, foodGroup, preparation, extra = {}) => ({
    id, title, direction, category: 'food', foodGroup, preparation, reason: '', instructions: '', conditions: '', metrics: [],
    source: 'reference', sourceDetail: SAMPLE_NOTE, url: '', related: [], pinned: false, status: 'active', review: '',
    created: t, updated: t, sample: true, ...extra,
  });
  const items = [
    mk('s-broccoli', 'Bông cải xanh', 'encourage', 'vegetables', 'Hấp hoặc luộc', { pinned: true, reason: 'Nhiều chất xơ, giúp no lâu.', metrics: ['weight', 'waist'] }),
    mk('s-guava', 'Ổi nguyên quả', 'encourage', 'fruit', 'Trái cây nguyên quả', { reason: 'Giữ được chất xơ của trái cây.' }),
    mk('s-oats', 'Yến mạch nguyên chất', 'encourage', 'grains', 'Không thêm đường', { instructions: 'Bữa sáng, khoảng 40 g.' }),
    mk('s-tofu', 'Đậu phụ', 'encourage', 'protein', 'Hấp hoặc nấu canh', { metrics: ['weight'] }),
    mk('s-nuts', 'Hạt không tẩm muối', 'encourage', 'nuts', 'Không phủ đường', { instructions: 'Một nắm nhỏ mỗi ngày.' }),
    mk('s-yogurt', 'Sữa chua không thêm đường', 'encourage', 'dairy', 'Kiểm tra thành phần sản phẩm'),
    mk('s-candied', 'Trái cây ngâm đường', 'limit', 'fruit', 'Ngâm hoặc sấy với đường', { reason: 'Nhiều đường thêm vào.', related: ['s-guava'] }),
    mk('s-cookies', 'Bánh quy nhiều đường', 'limit', 'snacks', '', { source: 'personal', sourceDetail: SAMPLE_NOTE, reason: 'Ghi chú cá nhân: dễ ăn quá tay buổi tối.', metrics: ['waist'] }),
    mk('s-sausage', 'Xúc xích', 'limit', 'protein', 'Thịt chế biến sẵn', { related: ['s-tofu'] }),
    mk('s-friedtofu', 'Đậu phụ chiên ngập dầu', 'limit', 'protein', 'Chiên ngập dầu', { related: ['s-tofu'], reason: 'Thêm nhiều dầu so với đậu phụ hấp.' }),
  ];
  return linkBack(items);
}
// Bảo đảm liên kết hai chiều: A liên quan B thì B cũng liên quan A.
function linkBack(items) {
  const ids = new Set(items.map((x) => x.id));
  const map = Object.fromEntries(items.map((x) => [x.id, new Set((x.related || []).filter((r) => ids.has(r) && r !== x.id))]));
  Object.entries(map).forEach(([id, set]) => set.forEach((r) => map[r].add(id)));
  return items.map((x) => ({ ...x, related: [...map[x.id]] }));
}

export const emptyGuidelines = () => ({ cats: DEFAULT_CATS.map((c) => ({ ...c })), groups: DEFAULT_GROUPS.map((g) => ({ ...g })), items: [], seeded: false });
// Chỉ chạy một lần cho mỗi tài khoản: khi chưa có h.guidelines. Không bao giờ ghi đè dữ liệu đã có.
export function ensureGuidelines(h) {
  if (h?.guidelines) return h;
  return { ...h, guidelines: { ...emptyGuidelines(), items: sampleItems(), seeded: true } };
}
export const hasSamples = (g) => (g?.items || []).some((x) => x.sample);
export const removeSamples = (g) => {
  const gone = new Set(g.items.filter((x) => x.sample).map((x) => x.id));
  return { ...g, items: g.items.filter((x) => !gone.has(x.id)).map((x) => ({ ...x, related: x.related.filter((r) => !gone.has(r)) })) };
};

/* ---------- tra cứu ---------- */
export const catOf = (g, id) => g.cats.find((c) => c.id === id) || { id, name: 'Nhóm đã xóa', icon: 'tag', color: '#a99c90' };
export const groupOf = (g, id) => g.groups.find((x) => x.id === id);
export const isFoodCat = (g, id) => catOf(g, id).kind === 'food';
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
export function matches(item, q) {
  if (!q.trim()) return true;
  const hay = norm([item.title, item.preparation, item.reason, item.instructions, item.conditions, item.sourceDetail].join(' '));
  return norm(q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}
// Ghim trước, rồi theo tên (so sánh có dấu tiếng Việt).
export const sortItems = (list) => [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || a.title.localeCompare(b.title, 'vi'));
export const shortNote = (x) => x.reason || x.instructions || x.conditions || '';
export const safeUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : ''; } catch { return ''; } };

/* ---------- thay đổi dữ liệu (thuần, trả về guidelines mới) ---------- */
export function validate(g, f) {
  const errors = {};
  if (!f.title.trim()) errors.title = 'Nhập tên';
  if (!DIRECTIONS[f.direction]) errors.direction = 'Chọn mức áp dụng';
  if (!g.cats.some((c) => c.id === f.category)) errors.category = 'Chọn nhóm';
  if (f.direction === 'avoid' && !f.reason.trim() && !f.conditions.trim()) errors.reason = 'Mục "Cần tránh" cần lý do hoặc điều kiện áp dụng';
  const prep = isFoodCat(g, f.category) ? norm(f.preparation.trim()) : '';
  // Cùng tên nhưng khác cách chế biến là mục riêng; trùng cả tên lẫn cách chế biến trong cùng nhóm thì báo trùng.
  if (f.title.trim() && g.items.some((x) => x.id !== f.id && x.category === f.category && norm(x.title.trim()) === norm(f.title.trim()) && norm(x.preparation || '') === prep)) errors.title = 'Đã có mục cùng tên và cùng cách chế biến trong nhóm này';
  if (f.url.trim() && !safeUrl(f.url.trim())) errors.url = 'Đường dẫn phải bắt đầu bằng http:// hoặc https://';
  return errors;
}
export function saveItem(g, f) {
  const t = now();
  const food = isFoodCat(g, f.category);
  const ids = new Set(g.items.map((x) => x.id));
  const existing = f.id && g.items.find((x) => x.id === f.id);
  const id = existing ? existing.id : f.id || `g-${uid()}`;
  const related = [...new Set((f.related || []).filter((r) => r !== id && ids.has(r)))];
  const rec = {
    ...(existing || {}),
    id, title: f.title.trim(), direction: f.direction, category: f.category,
    foodGroup: food ? f.foodGroup || 'other' : '', preparation: food ? f.preparation.trim() : '',
    reason: f.reason.trim(), instructions: f.instructions.trim(), conditions: f.conditions.trim(),
    metrics: (f.metrics || []).filter((m) => METRICS[m]), source: SOURCES[f.source] ? f.source : 'personal',
    sourceDetail: f.sourceDetail.trim(), url: safeUrl(f.url.trim()), related,
    pinned: !!f.pinned, status: STATUSES[f.status] ? f.status : 'active', review: f.review || '',
    created: existing?.created || t, updated: t, sample: existing?.sample && existing.title === f.title.trim() ? true : undefined,
  };
  if (!rec.sample) delete rec.sample;
  const before = new Set(existing?.related || []);
  const after = new Set(related);
  const items = (existing ? g.items.map((x) => (x.id === id ? rec : x)) : [...g.items, rec]).map((x) => {
    if (x.id === id) return x;
    const has = x.related.includes(id);
    if (after.has(x.id) && !has) return { ...x, related: [...x.related, id] };
    if (!after.has(x.id) && before.has(x.id) && has) return { ...x, related: x.related.filter((r) => r !== id) };
    return x;
  });
  return { g: { ...g, items }, id };
}
export const patchItem = (g, id, patch) => ({ ...g, items: g.items.map((x) => (x.id === id ? { ...x, ...patch, updated: now() } : x)) });
export const deleteItem = (g, id) => ({ ...g, items: g.items.filter((x) => x.id !== id).map((x) => (x.related.includes(id) ? { ...x, related: x.related.filter((r) => r !== id) } : x)) });

export function saveCat(g, c) {
  const name = c.name.trim();
  if (!name) return { error: 'Nhập tên nhóm' };
  if (g.cats.some((x) => x.id !== c.id && norm(x.name) === norm(name))) return { error: 'Đã có nhóm cùng tên' };
  if (c.id && g.cats.some((x) => x.id === c.id)) return { g: { ...g, cats: g.cats.map((x) => (x.id === c.id ? { ...x, name, icon: c.icon, color: c.color } : x)) } };
  return { g: { ...g, cats: [...g.cats, { id: `c-${uid()}`, name, icon: c.icon || 'tag', color: c.color || CAT_COLORS[0] }] } };
}
export function moveCat(g, id, dir) {
  const i = g.cats.findIndex((c) => c.id === id); const j = i + dir;
  if (i < 0 || j < 0 || j >= g.cats.length) return g;
  const cats = [...g.cats]; [cats[i], cats[j]] = [cats[j], cats[i]];
  return { ...g, cats };
}
// Xóa nhóm: mục trong nhóm chuyển sang nhóm thay thế (bắt buộc nếu nhóm còn mục).
export function deleteCat(g, id, replacement) {
  const count = g.items.filter((x) => x.category === id).length;
  if (g.cats.length <= 1) return { error: 'Cần giữ ít nhất một nhóm' };
  if (count && (!replacement || replacement === id || !g.cats.some((c) => c.id === replacement))) return { error: 'Chọn nhóm thay thế cho các mục đang có' };
  const toFood = replacement && isFoodCat(g, replacement);
  const t = now();
  return { g: { ...g, cats: g.cats.filter((c) => c.id !== id), items: g.items.map((x) => (x.category === id ? { ...x, category: replacement, foodGroup: toFood ? x.foodGroup || 'other' : x.foodGroup, updated: t } : x)) } };
}
export function addGroup(g, name) {
  const n = name.trim();
  if (!n) return { error: 'Nhập tên nhóm thực phẩm' };
  const exist = g.groups.find((x) => norm(x.name) === norm(n));
  if (exist) return { g, id: exist.id };
  const id = `fg-${uid()}`;
  return { g: { ...g, groups: [...g.groups, { id, name: n, custom: true }] }, id };
}
export function deleteGroup(g, id) {
  if (!g.groups.find((x) => x.id === id)?.custom) return { error: 'Chỉ xóa được nhóm thực phẩm tự tạo' };
  return { g: { ...g, groups: g.groups.filter((x) => x.id !== id), items: g.items.map((x) => (x.foodGroup === id ? { ...x, foodGroup: 'other' } : x)) } };
}

// Các cặp đối ứng để so sánh: mỗi cặp (Ưu tiên ↔ Hạn chế/Tránh) chỉ hiện một lần.
export function comparePairs(list, all) {
  const byId = Object.fromEntries(all.map((x) => [x.id, x]));
  const rank = { encourage: 0, limit: 1, avoid: 2 };
  const seen = new Set(); const pairs = [];
  list.forEach((a) => a.related.forEach((rid) => {
    const b = byId[rid]; if (!b) return;
    const key = [a.id, b.id].sort().join('|'); if (seen.has(key)) return; seen.add(key);
    pairs.push(rank[a.direction] <= rank[b.direction] ? [a, b] : [b, a]);
  }));
  return pairs;
}

export const blankForm = (category = 'food') => ({ id: '', title: '', direction: 'encourage', category, foodGroup: 'other', preparation: '', reason: '', instructions: '', conditions: '', metrics: [], source: 'personal', sourceDetail: '', url: '', related: [], pinned: false, status: 'active', review: '' });
export const toFormData = (x) => ({ ...blankForm(x.category), ...x, related: [...(x.related || [])], metrics: [...(x.metrics || [])] });
