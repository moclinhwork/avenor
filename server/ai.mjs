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
