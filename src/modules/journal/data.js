import { addDays, iso, TODAY } from '../../core/format.js';

export const MOODS = ['Rất tệ', 'Không vui', 'Bình thường', 'Vui', 'Tuyệt vời'];
export const MOOD_FACE = ['😣', '😕', '😐', '🙂', '😄'];

const notes = [
  'Ngủ muộn, cả ngày uể oải.', 'Hoàn thành bản thiết kế cho khách, nhẹ người.', 'Họp dài, ít thời gian cho bản thân.',
  'Chạy 4 km buổi sáng, đầu óc tỉnh táo.', 'Cuối tuần đi chợ, nấu ăn cùng gia đình.', 'Đọc gần hết The Midnight Library.',
  'Áp lực deadline, bỏ tập luyện.', 'Làm việc sâu 3 tiếng không bị gián đoạn.', 'Gặp bạn cũ, nói chuyện rất vui.',
  'Hơi mệt nhưng vẫn giữ được thói quen.', 'Ôn AWS được 2 chương.', 'Ngày bình thường, ăn uống điều độ.', 'Đặt xong homestay Đà Lạt.', 'Sáng thiền 10 phút, cảm thấy bình tĩnh hơn.',
];
const mood = [2, 4, 3, 4, 5, 4, 2, 4, 5, 3, 4, 3, 4, 4];
const energy = [2, 4, 2, 5, 4, 3, 2, 5, 4, 3, 3, 3, 4, 4];

export const initial = {
  entries: notes.map((note, i) => ({ date: iso(addDays(TODAY, -14 + i)), mood: mood[i], energy: energy[i], note })),
  reviews: [
    { week: '2026-11-02', wins: 'Giữ được 4 buổi tập; xong 2 giao dịch freelance.', adjust: 'Ngủ trước 23:00 ít nhất 5 ngày; gom họp vào buổi chiều.', score: 7 },
    { week: '2026-10-26', wins: 'Đọc xong Project Hail Mary; đạt mốc 80 triệu quỹ dự phòng.', adjust: 'Giảm cà phê buổi chiều; chuẩn bị đồ ăn trưa.', score: 8 },
  ],
};
