import { addDays, iso, seeded, TODAY } from '../../core/format.js';

const DEFS = [
  { id: 'hb1', name: 'Tập luyện 30 phút', icon: 'dumbbell', target: 4, rate: 0.62 },
  { id: 'hb2', name: 'Ngủ trước 23:00', icon: 'moon', target: 7, rate: 0.72 },
  { id: 'hb3', name: 'Đọc sách 20 phút', icon: 'book', target: 7, rate: 0.8 },
  { id: 'hb4', name: 'Uống đủ 2 lít nước', icon: 'drop', target: 7, rate: 0.68 },
  { id: 'hb5', name: 'Thiền 10 phút', icon: 'sparkle', target: 5, rate: 0.5 },
];

// Nhật ký 12 tuần gần nhất, tăng dần theo thời gian để biểu đồ có xu hướng.
const rnd = seeded(5);
export const initial = {
  habits: DEFS.map(({ rate, ...h }) => {
    const log = {};
    for (let i = 1; i < 84; i++) {
      const boost = 0.18 * (1 - i / 84);
      if (rnd() < rate + boost) log[iso(addDays(TODAY, -i))] = true;
    }
    return { ...h, log };
  }),
};
