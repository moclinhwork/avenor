// Trợ lý AI của Avenor: gọi Claude API từ VPS. Khóa API chỉ nằm trong .env trên VPS (ANTHROPIC_API_KEY),
// trình duyệt không bao giờ thấy khóa. Chỉ gửi bản tóm tắt ngắn đã tính sẵn ở trình duyệt, không gửi toàn bộ dữ liệu.
const KEY = process.env.ANTHROPIC_API_KEY || '';
export const AI_MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
// Giới hạn số lần gọi mỗi ngày cho mỗi tài khoản để tránh tốn tiền ngoài ý muốn.
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 40);

let clientPromise = null;
function client() {
  if (!KEY) return null;
  clientPromise ||= import('@anthropic-ai/sdk').then(({ default: Anthropic }) => new Anthropic({ apiKey: KEY })).catch(() => null);
  return clientPromise;
}
export const aiEnabled = () => !!KEY;

const usage = new Map(); // userId -> { day, n }
function takeQuota(userId) {
  const day = new Date().toISOString().slice(0, 10);
  const u = usage.get(userId);
  if (!u || u.day !== day) { usage.set(userId, { day, n: 1 }); return true; }
  if (u.n >= DAILY_LIMIT) return false;
  u.n++;
  return true;
}

const clean = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

const BRIEFING_SYSTEM = `Bạn là trợ lý cá nhân trong ứng dụng quản lý cuộc sống Avenor. Người dùng nói tiếng Việt.
Nhiệm vụ: viết bản tin trong ngày ngắn gọn từ danh sách dữ kiện đã có. Chỉ dùng dữ kiện được cung cấp, không bịa thêm số liệu, tên hay sự kiện.
Giọng văn: ấm áp, gần gũi, như một người bạn chu đáo; xưng "mình", gọi người dùng là "bạn". Không dùng emoji, không dùng markdown, không gạch đầu dòng.
Không mở đầu bằng lời chào (ứng dụng đã chào sẵn); đi thẳng vào nội dung, phù hợp thời điểm trong ngày được cho.
Độ dài: 3 đến 5 câu, tổng dưới 90 từ. Câu đầu nói điều quan trọng nhất hôm nay. Câu cuối là một gợi ý hành động cụ thể duy nhất.`;

// Viết lại bản tin từ các dữ kiện (đã được trình duyệt chọn lọc). Trả về { text } hoặc ném lỗi có code.
export async function briefing(userId, body) {
  const c = await client();
  if (!c) throw Object.assign(new Error('ai_disabled'), { status: 503 });
  if (!takeQuota(userId)) throw Object.assign(new Error('ai_quota'), { status: 429 });
  const facts = (Array.isArray(body?.facts) ? body.facts : []).slice(0, 14).map((f) => `- ${clean(f, 220)}`).filter((f) => f.length > 3);
  if (!facts.length) throw Object.assign(new Error('no_facts'), { status: 400 });
  const score = body?.score ? `Life Score hôm nay: ${clean(body.score, 160)}` : '';
  const prompt = [`Bây giờ là ${clean(body?.date, 60)}.`, score, 'Dữ kiện:', ...facts].filter(Boolean).join('\n');
  try {
    const r = await c.beta.messages.create({
      model: AI_MODEL,
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: BRIEFING_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    if (r.stop_reason === 'refusal') throw Object.assign(new Error('ai_refused'), { status: 422 });
    const text = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (!text) throw Object.assign(new Error('ai_empty'), { status: 502 });
    return { text: text.slice(0, 1200), model: r.model };
  } catch (e) {
    if (e.status && typeof e.message === 'string' && e.message.startsWith('ai_')) throw e;
    const status = e?.status === 401 ? 401 : e?.status === 429 ? 429 : 502;
    console.error('[ai] briefing failed:', e?.status || '', String(e?.message || e).slice(0, 200));
    throw Object.assign(new Error(status === 401 ? 'ai_bad_key' : status === 429 ? 'ai_rate_limited' : 'ai_failed'), { status });
  }
}

/* ---------- Life Command: câu lệnh tự nhiên -> các thao tác đề xuất ----------
   Máy chủ KHÔNG ghi dữ liệu. Claude chỉ đề xuất thao tác (tool_use); trình duyệt hiện thẻ xác nhận,
   người dùng bấm Lưu mới ghi, và có thể Hoàn tác. */
const S = (type, description, extra = {}) => ({ type, description, ...extra });
const N = (t) => [t, 'null'];
const tool = (name, description, properties) => ({
  name, description, strict: true,
  input_schema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
});
const DATE = S('string', 'Ngày dạng YYYY-MM-DD. Hiểu "hôm nay", "hôm qua", "thứ 7 tuần trước" theo ngày hiện tại được cho.');
export const COMMAND_TOOLS = [
  tool('add_transaction', 'Ghi một khoản chi tiêu hoặc thu nhập vào Tài chính.', {
    type: S('string', 'out = chi tiêu, in = thu nhập', { enum: ['out', 'in'] }),
    amount: S('integer', 'Số tiền VND, số nguyên. "50k" = 50000, "1tr2" = 1200000.'),
    title: S('string', 'Mô tả ngắn, tiếng Việt, viết hoa chữ đầu.'),
    category: S('string', 'Mã danh mục chi tiêu (chỉ dùng cho type=out, với type=in dùng income hoặc freelance).', { enum: ['housing', 'food', 'transport', 'travel', 'shopping', 'health', 'learning', 'other', 'income', 'freelance'] }),
    date: DATE,
  }),
  tool('log_workout', 'Ghi một buổi tập vào Sức khỏe/Tập luyện.', {
    sport: S('string', 'run = chạy bộ, walk = đi bộ, ride = đạp xe, swim = bơi, workout = môn khác/gym', { enum: ['run', 'walk', 'ride', 'swim', 'workout'] }),
    km: S(N('number'), 'Quãng đường km, null nếu không nói.'),
    minutes: S(N('integer'), 'Thời gian phút, null nếu không nói.'),
    date: DATE,
  }),
  tool('log_weight', 'Ghi cân nặng (và vòng eo nếu có) vào Sức khỏe/Chỉ số.', {
    weight: S('number', 'Cân nặng kg.'),
    waist: S(N('number'), 'Vòng eo cm, null nếu không nói.'),
    date: DATE,
  }),
  tool('add_goal', 'Tạo mục tiêu mới.', {
    title: S('string', 'Tên mục tiêu ngắn gọn, đo được nếu có thể.'),
    category: S('string', 'Lĩnh vực', { enum: ['health', 'finance', 'books', 'travel', 'learning', 'life'] }),
    deadline: S('string', 'Hạn chót YYYY-MM-DD. Nếu không nói, chọn hợp lý (ví dụ cuối quý).'),
  }),
  tool('check_habit', 'Đánh dấu đã làm (hoặc bỏ đánh dấu) một thói quen trong danh sách thói quen hiện có.', {
    habit: S('string', 'Tên thói quen, chép đúng một tên trong danh sách được cho.'),
    done: S('boolean', 'true = đã làm, false = bỏ đánh dấu.'),
    date: DATE,
  }),
  tool('add_book', 'Thêm sách vào tủ sách, hoặc cập nhật trạng thái sách đã có.', {
    title: S('string', 'Tên sách.'),
    author: S(N('string'), 'Tác giả, null nếu không rõ.'),
    status: S('string', 'unread = muốn đọc, reading = đang đọc, read = đã đọc xong', { enum: ['unread', 'reading', 'read'] }),
  }),
  tool('add_trip_plan', 'Thêm một chuyến đi dự định vào kế hoạch du lịch trong năm.', {
    name: S('string', 'Tên điểm đến.'),
    year: S('integer', 'Năm.'),
    month: S('integer', 'Tháng 1-12.'),
    budget: S(N('integer'), 'Ngân sách VND, null nếu không nói.'),
    note: S(N('string'), 'Ghi chú ngắn, null nếu không có.'),
  }),
  tool('add_idea', 'Lưu một ý tưởng dạng chữ vào Ý tưởng (Inbox).', {
    title: S('string', 'Tiêu đề ngắn, tối đa 8 từ.'),
    text: S('string', 'Nội dung ý tưởng.'),
  }),
  tool('add_task', 'Thêm việc cần làm hoặc lời nhắc vào Hôm nay.', {
    title: S('string', 'Nội dung việc.'),
    date: DATE,
    priority: S('string', 'high nếu người dùng nói gấp/quan trọng, ngược lại normal', { enum: ['normal', 'high'] }),
  }),
];

const COMMAND_SYSTEM = `Bạn là bộ hiểu lệnh của ứng dụng Avenor. Người dùng gõ hoặc nói một câu tiếng Việt (có thể viết tắt, không dấu, lỗi chép lời).
Hãy gọi một hoặc nhiều công cụ để thực hiện đúng ý người dùng. Một câu có nhiều việc thì gọi nhiều công cụ.
Không tự bịa thông tin người dùng không nói; trường không rõ thì để null nếu được phép.
Nếu câu không phải lệnh ghi dữ liệu, hoặc quá mơ hồ để làm, đừng gọi công cụ: trả lời một câu ngắn tiếng Việt giải thích hoặc hỏi lại.
Ứng dụng sẽ cho người dùng xác nhận trước khi lưu, nên cứ đề xuất thao tác hợp lý nhất.`;

export async function command(userId, body) {
  const c = await client();
  if (!c) throw Object.assign(new Error('ai_disabled'), { status: 503 });
  const text = clean(body?.text, 600);
  if (!text) throw Object.assign(new Error('no_text'), { status: 400 });
  if (!takeQuota(userId)) throw Object.assign(new Error('ai_quota'), { status: 429 });
  const ctx = body?.ctx || {};
  const list = (xs, n) => (Array.isArray(xs) ? xs.slice(0, n).map((x) => clean(x, 80)).filter(Boolean) : []);
  const context = [
    `Hôm nay: ${clean(ctx.today, 40)} (${clean(ctx.weekday, 20)}).`,
    `Thói quen hiện có: ${list(ctx.habits, 30).join('; ') || 'không có'}.`,
    `Sách đang có: ${list(ctx.books, 40).join('; ') || 'không có'}.`,
  ].join('\n');
  try {
    const r = await c.beta.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: COMMAND_SYSTEM,
      tools: COMMAND_TOOLS,
      messages: [{ role: 'user', content: `${context}\n\nCâu lệnh: ${text}` }],
    });
    if (r.stop_reason === 'refusal') throw Object.assign(new Error('ai_refused'), { status: 422 });
    const actions = r.content.filter((b) => b.type === 'tool_use' && COMMAND_TOOLS.some((t) => t.name === b.name)).slice(0, 10).map((b) => ({ name: b.name, input: b.input }));
    const reply = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim().slice(0, 500);
    return { actions, reply };
  } catch (e) {
    if (e.status && typeof e.message === 'string' && e.message.startsWith('ai_')) throw e;
    const status = e?.status === 401 ? 401 : e?.status === 429 ? 429 : 502;
    console.error('[ai] command failed:', e?.status || '', String(e?.message || e).slice(0, 200));
    throw Object.assign(new Error(status === 401 ? 'ai_bad_key' : status === 429 ? 'ai_rate_limited' : 'ai_failed'), { status });
  }
}
