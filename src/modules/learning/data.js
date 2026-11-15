export const initial = {
  courses: [
    { id: 'c1', title: 'AWS Solutions Architect Associate', provider: 'Udemy', done: 42, total: 66, hours: 38, skill: 'Cloud', color: 'var(--mint)' },
    { id: 'c2', title: 'IELTS Speaking 7.0', provider: 'Trung tâm Anh ngữ', done: 12, total: 30, hours: 24, skill: 'Tiếng Anh', color: 'var(--lav)' },
    { id: 'c3', title: 'Phân tích dữ liệu với Python', provider: 'Coursera', done: 6, total: 24, hours: 11, skill: 'Dữ liệu', color: 'var(--sky)' },
    { id: 'c4', title: 'UI/UX Design Fundamentals', provider: 'Coursera', done: 20, total: 20, hours: 32, skill: 'Thiết kế', color: 'var(--amber)' },
  ],
  weekly: [
    { w: '21/9', hours: 5.5 }, { w: '28/9', hours: 6 }, { w: '5/10', hours: 4 }, { w: '12/10', hours: 7.5 },
    { w: '19/10', hours: 6.5 }, { w: '26/10', hours: 8 }, { w: '2/11', hours: 7 }, { w: '9/11', hours: 4.5 },
  ],
  weeklyTarget: 7,
  milestones: [
    { id: 'l1', title: 'Hoàn thành dự án portfolio UI/UX', date: '2026-09-28', done: true },
    { id: 'l2', title: 'Hoàn thành khóa UI/UX Design', date: '2026-10-15', done: true },
    { id: 'l3', title: 'Thi chứng chỉ AWS SAA-C03', date: '2026-12-20', done: false },
    { id: 'l4', title: 'Dự án phân tích chi tiêu cá nhân bằng Python', date: '2027-01-31', done: false },
    { id: 'l5', title: 'Thi IELTS, mục tiêu 7.0', date: '2027-03-14', done: false },
  ],
};
export const skills = (courses) => {
  const m = {};
  courses.forEach((c) => { m[c.skill] = (m[c.skill] || 0) + c.hours; });
  return Object.entries(m).map(([label, hours]) => ({ label, hours }));
};
