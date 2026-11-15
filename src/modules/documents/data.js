import { daysFromToday } from '../../core/format.js';

export const TYPES = {
  id: { label: 'Giấy tờ tùy thân', icon: 'passport' },
  vehicle: { label: 'Xe & lái xe', icon: 'car' },
  insurance: { label: 'Bảo hiểm', icon: 'shield' },
  sub: { label: 'Gói đăng ký', icon: 'sub' },
  other: { label: 'Khác', icon: 'file' },
};

export const initial = {
  docs: [
    { id: 'd1', name: 'Hộ chiếu', type: 'id', number: 'C1234•••', expires: '2027-03-05', remind: 180, note: 'Nhiều nước yêu cầu còn hạn 6 tháng khi nhập cảnh' },
    { id: 'd2', name: 'Căn cước công dân', type: 'id', number: '079•••••821', expires: '2036-08-14', remind: 90 },
    { id: 'd3', name: 'Bằng lái xe B2', type: 'vehicle', number: '79••••5521', expires: '2029-06-20', remind: 90 },
    { id: 'd4', name: 'Bảo hiểm TNDS xe máy', type: 'vehicle', expires: '2026-11-28', remind: 30, cost: 66_000 },
    { id: 'd5', name: 'Bảo hiểm sức khỏe', type: 'insurance', expires: '2027-01-15', remind: 60, cost: 8_400_000 },
    { id: 'd6', name: 'Bảo hiểm nhà ở', type: 'insurance', expires: '2027-05-01', remind: 45, cost: 1_200_000 },
    { id: 'd7', name: 'Netflix Premium', type: 'sub', expires: '2026-11-18', remind: 7, cost: 260_000, cycle: 'tháng' },
    { id: 'd8', name: 'Spotify Family', type: 'sub', expires: '2026-11-22', remind: 7, cost: 99_000, cycle: 'tháng' },
    { id: 'd9', name: 'iCloud+ 200GB', type: 'sub', expires: '2026-12-01', remind: 7, cost: 59_000, cycle: 'tháng' },
    { id: 'd10', name: 'Tên miền cá nhân', type: 'other', expires: '2026-12-10', remind: 30, cost: 350_000, cycle: 'năm' },
    { id: 'd11', name: 'Đăng kiểm ô tô', type: 'vehicle', expires: '2026-11-08', remind: 30 },
  ],
};

export const status = (doc) => {
  const n = daysFromToday(doc.expires);
  if (n < 0) return { tone: 'rose', label: `Hết hạn ${-n} ngày`, n };
  if (n <= doc.remind) return { tone: 'amber', label: `Còn ${n} ngày`, n };
  return { tone: 'mint', label: `Còn ${n} ngày`, n };
};
