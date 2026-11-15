import { parse, TODAY } from '../../core/format.js';

const m = (id, title, due, done = false) => ({ id, title, due, done });

export const CATS = {
  health: { label: 'Sức khỏe', icon: 'heart', tone: 'mint' },
  finance: { label: 'Tài chính', icon: 'wallet', tone: 'mint' },
  books: { label: 'Đọc sách', icon: 'book', tone: 'lav' },
  travel: { label: 'Du lịch', icon: 'plane', tone: 'mint' },
  learning: { label: 'Học tập', icon: 'cap', tone: 'lav' },
  life: { label: 'Cuộc sống', icon: 'sparkle', tone: 'amber' },
};

export const initial = {
  goals: [
    {
      id: 'g1', title: 'Giảm 5 kg trong 3 tháng', cat: 'health', start: '2026-09-01', deadline: '2026-12-01',
      milestones: [m('g1a', 'Lập thực đơn 1.800 kcal', '2026-09-05', true), m('g1b', 'Đạt 70 kg', '2026-10-10', true), m('g1f', 'Đạt 69 kg', '2026-11-01', true), m('g1c', 'Chạy 5 km liên tục', '2026-11-12'), m('g1d', 'Đạt 68 kg', '2026-11-20'), m('g1e', 'Đạt 66,8 kg', '2026-12-01')],
    },
    {
      id: 'g2', title: 'Xây quỹ dự phòng 6 tháng', cat: 'finance', start: '2026-03-01', deadline: '2027-03-31',
      milestones: [m('g2a', 'Mở tài khoản tiết kiệm riêng', '2026-03-05', true), m('g2b', 'Đạt 40 triệu', '2026-06-30', true), m('g2c', 'Đạt 80 triệu', '2026-10-31', true), m('g2d', 'Đạt 100 triệu', '2026-12-31'), m('g2e', 'Đạt 120 triệu', '2027-03-31')],
    },
    {
      id: 'g3', title: 'Đọc 12 cuốn sách năm 2026', cat: 'books', start: '2026-01-01', deadline: '2026-12-31',
      milestones: [m('g3a', '3 cuốn (Quý 1)', '2026-03-31', true), m('g3b', '6 cuốn (Quý 2)', '2026-06-30', true), m('g3c', '9 cuốn (Quý 3)', '2026-09-30'), m('g3d', '12 cuốn', '2026-12-31')],
    },
    {
      id: 'g4', title: 'Hoàn tất chuyến Đà Lạt', cat: 'travel', start: '2026-10-15', deadline: '2026-11-26',
      milestones: [m('g4a', 'Đặt vé xe giường nằm', '2026-10-20', true), m('g4b', 'Đặt homestay 3 đêm', '2026-10-25', true), m('g4c', 'Chốt lịch trình từng ngày', '2026-11-13'), m('g4d', 'Soạn hành lý', '2026-11-24'), m('g4e', 'Đổi tiền mặt dự phòng', '2026-11-25')],
    },
    {
      id: 'g5', title: 'Thi chứng chỉ AWS Solutions Architect', cat: 'learning', start: '2026-08-01', deadline: '2026-12-20',
      milestones: [m('g5a', 'Học xong phần nền tảng', '2026-09-15', true), m('g5b', 'Làm 2 đề thi thử', '2026-11-12'), m('g5c', 'Đạt 80% đề thi thử', '2026-12-05'), m('g5d', 'Đăng ký và thi', '2026-12-20')],
    },
    {
      id: 'g6', title: 'Sắp xếp lại góc làm việc', cat: 'life', start: '2026-07-01', deadline: '2026-08-31',
      milestones: [m('g6a', 'Mua bàn nâng hạ', '2026-07-10', true), m('g6b', 'Đi lại dây điện', '2026-07-20', true), m('g6c', 'Thêm cây xanh', '2026-08-15', true)],
    },
  ],
};

export const progress = (g) => (g.milestones.length ? Math.round((g.milestones.filter((x) => x.done).length / g.milestones.length) * 100) : 0);

// "Đúng tiến độ": tiến độ cột mốc đạt ít nhất 60% tỷ lệ thời gian đã trôi qua.
export const onTrack = (g) => {
  const elapsed = Math.max(0, Math.min(1, (TODAY - parse(g.start)) / (parse(g.deadline) - parse(g.start))));
  return progress(g) / 100 >= elapsed * 0.6;
};
