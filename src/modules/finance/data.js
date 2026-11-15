import { monthLabel, TODAY, ym } from '../../core/format.js';

export const CATEGORIES = [
  { id: 'housing', label: 'Nhà ở', color: '#8e3b2c', budget: 16_000_000, icon: 'home2' },
  { id: 'food', label: 'Ăn uống', color: '#c4923c', budget: 8_000_000, icon: 'coffee' },
  { id: 'transport', label: 'Di chuyển', color: '#4f86a8', budget: 3_000_000, icon: 'car' },
  { id: 'travel', label: 'Du lịch', color: '#d97b4a', budget: 6_000_000, icon: 'plane' },
  { id: 'shopping', label: 'Mua sắm', color: '#a8607a', budget: 4_000_000, icon: 'bag' },
  { id: 'health', label: 'Sức khỏe', color: '#5f8a6e', budget: 2_000_000, icon: 'heart' },
  { id: 'learning', label: 'Học tập', color: '#7d6aa0', budget: 2_500_000, icon: 'cap' },
  { id: 'other', label: 'Khác', color: '#a99c90', budget: 3_000_000, icon: 'grid' },
];
export const catById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const t = (id, date, title, amount, cat, type = 'out') => ({ id, date, title, amount, cat, type });

export const initial = {
  transactions: [
    t('t1', '2026-11-01', 'Lương tháng 11', 52_000_000, 'income', 'in'),
    t('t2', '2026-11-01', 'Tiền thuê nhà', 12_500_000, 'housing'),
    t('t3', '2026-11-02', 'Đi chợ cuối tuần', 1_250_000, 'food'),
    t('t4', '2026-11-03', 'Xăng xe', 320_000, 'transport'),
    t('t5', '2026-11-04', 'Vé xe Đà Lạt (2 người)', 1_100_000, 'travel'),
    t('t6', '2026-11-05', 'Dự án thiết kế freelance', 12_000_000, 'freelance', 'in'),
    t('t7', '2026-11-05', 'Cà phê làm việc', 285_000, 'food'),
    t('t8', '2026-11-06', 'Phòng gym tháng 11', 650_000, 'health'),
    t('t9', '2026-11-07', 'Ăn tối cùng gia đình', 1_480_000, 'food'),
    t('t10', '2026-11-08', 'Áo khoác cho chuyến Đà Lạt', 890_000, 'shopping'),
    t('t11', '2026-11-08', 'Homestay Đà Lạt (đặt cọc)', 2_400_000, 'travel'),
    t('t12', '2026-11-09', 'Khóa luyện đề AWS', 1_350_000, 'learning'),
    t('t13', '2026-11-10', 'Grab tuần này', 410_000, 'transport'),
    t('t14', '2026-11-10', 'Siêu thị', 1_620_000, 'food'),
    t('t15', '2026-11-11', 'Tiền điện tháng 10', 1_150_000, 'housing'),
    t('t16', '2026-11-11', 'Quà sinh nhật bạn', 650_000, 'other'),
    t('t17', '2026-11-12', 'Ăn trưa', 95_000, 'food'),
  ],
  history: [
    { ym: '2026-06', income: 58_000_000, expense: 39_200_000 },
    { ym: '2026-07', income: 60_500_000, expense: 47_800_000 },
    { ym: '2026-08', income: 58_000_000, expense: 36_900_000 },
    { ym: '2026-09', income: 63_000_000, expense: 41_300_000 },
    { ym: '2026-10', income: 61_000_000, expense: 44_600_000 },
  ],
  fund: {
    target: 120_000_000,
    contributions: [
      { m: 'T3', amount: 15_000_000 }, { m: 'T4', amount: 10_000_000 }, { m: 'T5', amount: 8_000_000 },
      { m: 'T6', amount: 9_000_000 }, { m: 'T7', amount: 6_000_000 }, { m: 'T8', amount: 12_000_000 },
      { m: 'T9', amount: 11_600_000 }, { m: 'T10', amount: 10_000_000 },
    ],
  },
  bills: [
    { id: 'b1', name: 'Internet FPT', due: '2026-11-12', amount: 280_000, paid: false },
    { id: 'b2', name: 'Thẻ tín dụng VPBank', due: '2026-11-15', amount: 6_840_000, paid: false },
    { id: 'b3', name: 'Phí quản lý chung cư', due: '2026-11-18', amount: 720_000, paid: false },
    { id: 'b4', name: 'Học phí tiếng Anh', due: '2026-11-20', amount: 2_400_000, paid: false },
    { id: 'b5', name: 'Nước sinh hoạt', due: '2026-11-10', amount: 180_000, paid: true },
    { id: 'b6', name: 'Bảo hiểm nhân thọ (quý)', due: '2026-11-28', amount: 4_500_000, paid: false },
  ],
};

export const totals = (tx) => {
  const income = tx.filter((x) => x.type === 'in').reduce((s, x) => s + x.amount, 0);
  const expense = tx.filter((x) => x.type === 'out').reduce((s, x) => s + x.amount, 0);
  return { income, expense, net: income - expense };
};
export const byCategory = (tx) => CATEGORIES.map((c) => ({ ...c, spent: tx.filter((x) => x.type === 'out' && x.cat === c.id).reduce((s, x) => s + x.amount, 0) }));
export const fundSaved = (f) => f.contributions.reduce((s, c) => s + c.amount, 0);

// Giao dịch của tháng hiện tại.
export const monthTx = (f, key = ym()) => f.transactions.filter((x) => x.date.startsWith(key));
// Dòng tiền 6 tháng gần nhất: tính từ giao dịch nếu có, nếu không lấy số liệu lịch sử đã lưu.
export const monthlySeries = (f, n = 6) => Array.from({ length: n }, (_, i) => {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - (n - 1 - i), 1);
  const key = ym(d);
  const tx = monthTx(f, key);
  const saved = f.history.find((h) => h.ym === key);
  const t = tx.length ? totals(tx) : { income: saved?.income || 0, expense: saved?.expense || 0 };
  return { key, m: monthLabel(key), income: t.income, expense: t.expense };
});
