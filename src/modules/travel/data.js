const day = (date, title, items) => ({ date, title, items });
const cost = (label, plan, actual = 0) => ({ label, plan, actual });
const pack = (id, label, group, done = false) => ({ id, label, group, done });

export const initial = {
  trips: [
    {
      id: 'dalat', name: 'Đà Lạt', place: 'Lâm Đồng', start: '2026-11-26', end: '2026-11-29', scene: 'mountain', sky: 'dawn',
      travelers: '2 người lớn', stay: 'Homestay đồi thông (3 đêm)', note: 'Cà phê, đồi thông, hồ Tuyền Lâm',
      itinerary: [
        day('2026-11-26', 'Đến nơi & dạo trung tâm', ['06:00 Tới bến xe, nhận phòng sớm', '09:30 Cà phê view đồi thông', '15:00 Hồ Xuân Hương, chợ Đà Lạt', '19:00 Lẩu gà lá é']),
        day('2026-11-27', 'Săn mây & hồ Tuyền Lâm', ['04:45 Săn mây đồi Đa Phú', '10:00 Chèo SUP hồ Tuyền Lâm', '14:00 Thiền viện Trúc Lâm', '18:30 Chợ đêm']),
        day('2026-11-28', 'Langbiang & làng Cù Lần', ['08:00 Leo đỉnh Langbiang', '13:00 Ăn trưa làng Cù Lần', '17:00 Tiệm bánh căn quen']),
        day('2026-11-29', 'Mua quà & về', ['08:00 Chợ nông sản', '11:00 Trả phòng', '13:30 Xe về Sài Gòn']),
      ],
      costs: [cost('Di chuyển', 1_100_000, 1_100_000), cost('Lưu trú', 3_600_000, 2_400_000), cost('Ăn uống', 2_800_000), cost('Tham quan', 1_200_000), cost('Quà & phát sinh', 1_000_000)],
      packing: [
        pack('p1', 'Áo khoác ấm', 'Quần áo', true), pack('p2', 'Khăn quàng, tất len', 'Quần áo'), pack('p3', 'Giày leo núi', 'Quần áo', true),
        pack('p4', 'Sạc dự phòng', 'Thiết bị', true), pack('p5', 'Máy ảnh + thẻ nhớ', 'Thiết bị'), pack('p6', 'CCCD, thẻ ngân hàng', 'Giấy tờ', true),
        pack('p7', 'Kem chống nắng, son dưỡng', 'Cá nhân'), pack('p8', 'Thuốc cảm, dầu gió', 'Cá nhân'), pack('p9', 'Bình nước giữ nhiệt', 'Cá nhân'),
      ],
    },
    { id: 'ninhbinh', name: 'Ninh Bình', place: 'Ninh Bình', start: '2026-12-12', end: '2026-12-14', scene: 'karst', sky: 'day', travelers: '4 người', stay: 'Resort Tam Cốc (2 đêm)', note: 'Tràng An, Hang Múa, đạp xe', itinerary: [], costs: [cost('Di chuyển', 1_800_000), cost('Lưu trú', 3_200_000), cost('Ăn uống', 2_000_000)], packing: [] },
    { id: 'hoian', name: 'Hội An', place: 'Quảng Nam', start: '2026-10-09', end: '2026-10-11', scene: 'lantern', sky: 'night', travelers: '2 người', stay: 'Khách sạn phố cổ', note: 'Phố cổ, thuyền thúng, đèn lồng', itinerary: [], costs: [cost('Tổng', 7_500_000, 7_120_000)], packing: [] },
    { id: 'hue', name: 'Huế', place: 'Thừa Thiên Huế', start: '2026-09-18', end: '2026-09-20', scene: 'temple', sky: 'dusk', travelers: '2 người', stay: 'Nhà vườn', note: 'Đại Nội, lăng tẩm, ẩm thực', itinerary: [], costs: [cost('Tổng', 6_000_000, 5_640_000)], packing: [] },
    { id: 'phuquoc', name: 'Phú Quốc', place: 'Kiên Giang', start: '2026-07-03', end: '2026-07-07', scene: 'sea', sky: 'day', travelers: 'Gia đình 5 người', stay: 'Resort Bãi Dài', note: 'Biển, lặn ngắm san hô', itinerary: [], costs: [cost('Tổng', 22_000_000, 23_400_000)], packing: [] },
    { id: 'sapa', name: 'Sa Pa', place: 'Lào Cai', start: '2026-08-14', end: '2026-08-17', scene: 'mountain', sky: 'dusk', travelers: '3 người', stay: 'Homestay bản Cát Cát', note: 'Fansipan, ruộng bậc thang', itinerary: [], costs: [cost('Tổng', 8_000_000, 7_800_000)], packing: [] },
  ],
  yearPlan: [
    { id: 'y00', year: 2026, month: 12, name: 'Mũi Né', place: 'Bình Thuận', dates: 'Cuối năm', budget: 5_000_000, status: 'idea', scene: 'sea', note: 'Nghỉ ngơi đón năm mới' },
    { id: 'y1', year: 2027, month: 3, name: 'Đà Nẵng', place: 'Thành phố Đà Nẵng', dates: '', budget: 9_000_000, status: 'idea', scene: 'sea', note: 'Biển Mỹ Khê, Bà Nà' },
    { id: 'y2', year: 2027, month: 5, name: 'Hà Giang Loop', place: 'Hà Giang', dates: '14–17/5', budget: 8_000_000, status: 'planned', scene: 'mountain', note: 'Đi xe máy cùng nhóm bạn' },
    { id: 'y3', year: 2027, month: 9, name: 'Côn Đảo', place: 'Bà Rịa – Vũng Tàu', dates: '', budget: 12_000_000, status: 'idea', scene: 'sea', note: 'Lặn biển, rùa đẻ trứng' },
  ],
  decade: [
    { id: 'd1', year: 2027, name: 'Nhật Bản', detail: 'Tokyo, Kyoto mùa hoa anh đào', budget: 60_000_000, scene: 'fuji', done: false },
    { id: 'd1b', year: 2027, name: 'Singapore', detail: 'Gardens by the Bay, Sentosa', budget: 25_000_000, scene: 'sea', done: false },
    { id: 'd2b', year: 2029, name: 'Thụy Sĩ', detail: 'Zurich, Interlaken', budget: 85_000_000, scene: 'fuji', done: false },
    { id: 'd2', year: 2029, name: 'Ý', detail: 'Rome, Florence', budget: 90_000_000, scene: 'ruins', done: false },
    { id: 'd3', year: 2032, name: 'New Zealand', detail: 'Queenstown, Milford Sound', budget: 120_000_000, scene: 'mountain', done: false },
    { id: 'd4', year: 2036, name: 'Iceland', detail: 'Reykjavík, ngắm cực quang', budget: 130_000_000, scene: 'aurora', done: false },
  ],
};

// Kiểu cảnh minh họa cho thẻ kế hoạch; bầu trời đi kèm từng kiểu.
export const SCENES = {
  sea: { label: 'Biển', sky: 'day' },
  mountain: { label: 'Núi, đồi', sky: 'dawn' },
  karst: { label: 'Núi đá vôi', sky: 'day' },
  lantern: { label: 'Phố cổ, đèn lồng', sky: 'night' },
  temple: { label: 'Đền, cố đô', sky: 'dusk' },
  fuji: { label: 'Núi tuyết, hoa', sky: 'dawn' },
  ruins: { label: 'Di tích cổ', sky: 'dusk' },
  aurora: { label: 'Cực quang', sky: 'polar' },
};
export const PLAN_STATUS = {
  idea: { label: 'Ý tưởng', chip: '' },
  planned: { label: 'Đã lên kế hoạch', chip: 'lav' },
  booked: { label: 'Đã đặt', chip: 'mint' },
  done: { label: 'Đã đi', chip: 'mint' },
};

// Chuyển dữ liệu kiểu cũ ({ month: 'T3' } không có năm) sang kiểu mới.
export const normPlan = (p, fallbackYear) => ({
  status: 'idea', budget: 0, note: '', dates: '', place: '', scene: 'sea',
  ...p,
  year: p.year ?? fallbackYear,
  month: typeof p.month === 'string' ? Number(p.month.replace(/\D/g, '')) || 1 : p.month || 1,
  dates: p.dates === 'Chưa chốt ngày' || p.dates === 'Dates TBD' ? '' : p.dates || '',
});
export const normDream = (d, i) => ({ id: d.id || `dream-${d.year}-${i}`, budget: 0, done: false, detail: '', scene: 'mountain', ...d });
