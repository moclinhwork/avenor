export const initial = {
  appointments: [
    { id: 'a1', date: '2026-11-12', time: '07:00', end: '07:45', title: 'Chạy bộ công viên Gia Định', place: 'Gò Vấp', kind: 'health' },
    { id: 'a2', date: '2026-11-12', time: '09:30', end: '10:30', title: 'Họp dự án với khách hàng', place: 'Google Meet', kind: 'work' },
    { id: 'a3', date: '2026-11-12', time: '14:00', end: '15:30', title: 'Làm đề thi thử AWS số 2', place: 'Ở nhà', kind: 'learning' },
    { id: 'a4', date: '2026-11-12', time: '19:30', end: '21:00', title: 'Ăn tối cùng gia đình', place: 'Nhà bố mẹ', kind: 'personal' },
    { id: 'a5', date: '2026-11-13', time: '08:30', end: '09:00', title: 'Khám răng định kỳ', place: 'Nha khoa Kim', kind: 'health' },
    { id: 'a6', date: '2026-11-13', time: '15:00', end: '16:00', title: 'Phỏng vấn ứng viên', place: 'Văn phòng', kind: 'work' },
    { id: 'a7', date: '2026-11-14', time: '09:00', end: '11:00', title: 'Cà phê với nhóm bạn', place: 'Quận 3', kind: 'personal' },
    { id: 'a8', date: '2026-11-10', time: '18:00', end: '19:00', title: 'Lớp IELTS Speaking', place: 'Trung tâm', kind: 'learning' },
    { id: 'a9', date: '2026-11-11', time: '10:00', end: '11:00', title: 'Review thiết kế', place: 'Văn phòng', kind: 'work' },
    { id: 'a10', date: '2026-11-15', time: '07:30', end: '09:00', title: 'Đạp xe cuối tuần', place: 'Thủ Đức', kind: 'health' },
    { id: 'a11', date: '2026-11-09', time: '19:00', end: '20:00', title: 'Lên kế hoạch tuần', place: 'Ở nhà', kind: 'personal' },
    { id: 'a12', date: '2026-11-12', time: '17:30', end: '18:00', title: 'Gọi điện xác nhận homestay', place: 'Điện thoại', kind: 'travel' },
  ],
  tasks: [
    { id: 'k1', date: '2026-11-12', title: 'Gửi báo giá cho khách hàng mới', done: true, priority: 'high' },
    { id: 'k2', date: '2026-11-12', title: 'Đặt lịch bảo dưỡng xe máy', done: false, priority: 'normal' },
    { id: 'k3', date: '2026-11-12', title: 'Mua quà sinh nhật mẹ', done: false, priority: 'high' },
    { id: 'k4', date: '2026-11-13', title: 'Nộp hồ sơ hoàn thuế TNCN', done: false, priority: 'high' },
    { id: 'k5', date: '2026-11-14', title: 'Dọn tủ quần áo mùa đông', done: false, priority: 'normal' },
  ],
};
export const KINDS = {
  work: { label: 'Công việc', color: 'var(--sky)' },
  health: { label: 'Sức khỏe', color: 'var(--good)' },
  learning: { label: 'Học tập', color: 'var(--lav)' },
  personal: { label: 'Cá nhân', color: 'var(--amber)' },
  travel: { label: 'Du lịch', color: '#a8607a' },
};
