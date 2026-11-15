const b = (id, title, author, status, pages, read, colors, extra = {}) => ({ id, title, author, status, pages, read, colors, fav: false, ...extra });

export const initial = {
  yearGoal: 12,
  books: [
    b('b1', 'Atomic Habits', 'James Clear', 'read', 320, 320, ['#efe2c6', '#2b2b2b'], { finished: '2026-01-10', rating: 5, fav: true }),
    b('b2', 'Deep Work', 'Cal Newport', 'read', 296, 296, ['#1d4e6b', '#e9f2f5'], { finished: '2026-02-21', rating: 4 }),
    b('b3', 'Nhà Giả Kim', 'Paulo Coelho', 'read', 228, 228, ['#d48a2a', '#2a1708'], { finished: '2026-03-30', rating: 4 }),
    b('b4', 'Sapiens', 'Yuval Noah Harari', 'read', 512, 512, ['#efe7d6', '#5a3b1d'], { finished: '2026-05-18', rating: 5, fav: true }),
    b('b5', 'Tư duy nhanh và chậm', 'Daniel Kahneman', 'read', 612, 612, ['#f2f2f2', '#c43b2f'], { finished: '2026-07-02', rating: 4 }),
    b('b6', 'The Power of Habit', 'Charles Duhigg', 'read', 371, 371, ['#a52a2a', '#f5e3c8'], { finished: '2026-08-14', rating: 4 }),
    b('b7', 'Klara and the Sun', 'Kazuo Ishiguro', 'read', 303, 303, ['#e8622c', '#fff2d0'], { finished: '2026-09-25', rating: 4 }),
    b('b8', 'Project Hail Mary', 'Andy Weir', 'read', 476, 476, ['#13161f', '#f4b860'], { finished: '2026-10-30', rating: 5, fav: true }),
    b('b9', 'The Midnight Library', 'Matt Haig', 'reading', 288, 121, ['#1e2a5a', '#f5d76e']),
    b('b10', 'Đắc Nhân Tâm', 'Dale Carnegie', 'reading', 320, 218, ['#0f5a46', '#f0e6c8']),
    b('b11', 'Dune', 'Frank Herbert', 'unread', 688, 0, ['#d9a35a', '#3b1f0b']),
    b('b12', 'Tomorrow, and Tomorrow', 'Gabrielle Zevin', 'unread', 401, 0, ['#2a6fb0', '#fbe7c1']),
    b('b13', 'Muôn Kiếp Nhân Sinh', 'Nguyên Phong', 'unread', 380, 0, ['#5b2a6e', '#f2d7f5']),
    b('b14', 'Meditations', 'Marcus Aurelius', 'unread', 254, 0, ['#cfc6b5', '#2d2a24']),
  ],
  notes: [
    { id: 'n1', book: 'b1', text: 'Thay đổi nhỏ 1% mỗi ngày cộng dồn thành khác biệt lớn sau một năm.', date: '2026-01-08' },
    { id: 'n2', book: 'b8', text: 'Giải quyết vấn đề từng bước một, ghi lại mọi giả định.', date: '2026-10-22' },
    { id: 'n3', book: 'b9', text: 'Hối tiếc chỉ hữu ích khi nó chỉ ra điều mình muốn làm tiếp theo.', date: '2026-11-09' },
  ],
  sessions: [22, 35, 0, 18, 40, 25, 30], // phút đọc 7 ngày gần nhất (T6 tuần trước → T5 hôm nay)
};

export const STATUS = { read: { label: 'Đã đọc', chip: 'mint' }, reading: { label: 'Đang đọc', chip: 'lav' }, unread: { label: 'Chưa đọc', chip: '' } };
export const finishedIn = (books, year) => books.filter((x) => x.status === 'read' && x.finished?.startsWith(String(year)));
