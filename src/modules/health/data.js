import { addDays, iso, seeded, TODAY } from '../../core/format.js';

// 25 lần đo, cách nhau 3 ngày, từ 71,8 kg xuống 68,4 kg.
const rnd = seeded(11);
const N = 25;
const entries = Array.from({ length: N }, (_, i) => {
  const t = i / (N - 1);
  const weight = +(71.8 - 3.4 * t + (i === N - 1 ? 0 : (rnd() - 0.5) * 0.5)).toFixed(1);
  const waist = +(84 - 6 * t + (i === N - 1 ? 0 : (rnd() - 0.5) * 0.6)).toFixed(1);
  return { id: `h${i}`, date: iso(addDays(TODAY, -(N - 1 - i) * 3)), weight, waist };
});
entries[N - 1].weight = 68.4;
entries[N - 1].waist = 78;

// Huyết áp mẫu: 14 lần đo buổi sáng, cách 2 ngày.
const bpRnd = seeded(23);
const bp = Array.from({ length: 14 }, (_, i) => ({
  id: `bp${i}`, date: iso(addDays(TODAY, -(13 - i) * 2)), time: '07:00',
  sys: Math.round(124 - i * 0.6 + (bpRnd() - 0.5) * 8), dia: Math.round(81 - i * 0.3 + (bpRnd() - 0.5) * 6), pulse: Math.round(66 + (bpRnd() - 0.5) * 8),
}));

// Buổi tập mẫu (chỉ có ở dữ liệu mẫu; dữ liệu thật đến từ Strava hoặc ghi tay).
const wRnd = seeded(31);
const workouts = [];
for (let i = 55; i >= 0; i--) {
  const date = iso(addDays(TODAY, -i));
  if (wRnd() < 0.75) workouts.push({ id: `w${i}a`, date, type: 'walk', km: +(2 + wRnd() * 4).toFixed(2), minutes: Math.round(25 + wRnd() * 40), name: 'Đi bộ buổi tối', source: 'sample' });
  if (wRnd() < 0.4) workouts.push({ id: `w${i}b`, date, type: 'run', km: +(3 + wRnd() * 5).toFixed(2), minutes: Math.round(20 + wRnd() * 30), name: 'Chạy bộ buổi sáng', source: 'sample' });
}

export const initial = {
  height: 173.15,
  heightUpdated: '2026-11-15',
  bp,
  workouts,
  stravaSyncedAt: null,
  goalWeight: 66.5,
  goalWaist: 76,
  entries,
  vitals: { restingHr: 62, sleepAvg: 7.1, steps: 8420, water: 1.9 },
};

// Tiến độ tới cân nặng mục tiêu: đi được bao nhiêu % quãng đường từ mốc bắt đầu tới mục tiêu.
// Mốc bắt đầu = h.goalStart nếu bạn đặt, không thì lần đo đầu tiên. Dùng được cho cả giảm và tăng cân.
export function goalProgress(h, sorted) {
  const last = sorted[sorted.length - 1];
  const start = Number(h.goalStart) || sorted[0]?.weight;
  const goal = Number(h.goalWeight);
  if (!last || !start || !goal) return { pct: 0, left: 0, start, last, goal };
  const total = start - goal;
  const pct = total === 0 ? (last.weight === goal ? 100 : 0) : Math.max(0, Math.min(100, Math.round(((start - last.weight) / total) * 100)));
  const reached = total >= 0 ? last.weight <= goal : last.weight >= goal;
  return { pct: reached ? 100 : pct, left: reached ? 0 : Math.abs(last.weight - goal), start, last, goal, gain: total < 0 };
}

export const bmi = (w, hCm) => w / (hCm / 100) ** 2;
export const bmiLabel = (b) => (b < 18.5 ? 'Thiếu cân' : b < 23 ? 'Bình thường' : b < 25 ? 'Thừa cân' : 'Béo phì');

// Phân loại huyết áp theo Hội Tim mạch Hoa Kỳ (AHA 2017).
export function bpClass(sys, dia) {
  if (sys >= 180 || dia >= 120) return { label: 'Cơn tăng huyết áp', tone: 'rose' };
  if (sys >= 140 || dia >= 90) return { label: 'Tăng huyết áp độ 2', tone: 'rose' };
  if (sys >= 130 || dia >= 80) return { label: 'Tăng huyết áp độ 1', tone: 'amber' };
  if (sys >= 120) return { label: 'Huyết áp tăng nhẹ', tone: 'amber' };
  if (sys < 90 || dia < 60) return { label: 'Huyết áp thấp', tone: 'amber' };
  return { label: 'Bình thường', tone: 'good' };
}
