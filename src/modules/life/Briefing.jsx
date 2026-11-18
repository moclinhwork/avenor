import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from '../../core/AuthGate.jsx';
import { useStore } from '../../core/store.jsx';
import { api, SERVER } from '../../core/platform.js';
import { todayIso } from '../../core/format.js';
import { go } from '../../core/router.js';
import { aiPayload, deltaSince, ruleBriefing, scoreWord } from '../../core/life.js';
import Icon from '../../ui/Icon.jsx';
import { ScoreRing } from './LifePage.jsx';
import { openCommand } from './CommandSheet.jsx';
import { useLife } from './useLife.js';

const ERR = {
  ai_quota: 'Đã dùng hết lượt AI hôm nay.',
  ai_rate_limited: 'AI đang bận, thử lại sau ít phút.',
  ai_bad_key: 'Khóa Claude API trên máy chủ không hợp lệ.',
  ai_disabled: 'Máy chủ chưa bật AI.',
};
const keyOf = (b) => b.facts.slice(0, 6).map((f) => f.text).join('|');

// Thẻ "Bản tin hôm nay" ở đầu màn Hôm nay: luôn có bản dựng bằng luật;
// nếu máy chủ bật Claude API thì viết lại thành đoạn văn tự nhiên, mỗi ngày một lần (lưu lại, không gọi lặp).
export default function Briefing() {
  const { state, update, life, ls } = useLife();
  const account = useAccount();
  const { sync } = useStore();
  const ready = sync !== 'connecting'; // chờ dữ liệu máy chủ tải xong rồi mới viết
  const ai = SERVER && account?.ai;
  const b = useMemo(() => ruleBriefing(state, ls), [state, ls]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [details, setDetails] = useState(false);
  const tried = useRef(false);
  const brief = life.brief?.date === todayIso ? life.brief : null;
  const stale = brief?.text && brief.key !== keyOf(b);
  const d7 = deltaSince(life.snaps || {}, ls.total, 7);

  const write = async () => {
    if (!b.facts.length) return;
    setBusy(true); setErr('');
    try {
      const r = await api('/api/ai/briefing', { method: 'POST', body: aiPayload(state, ls, b) });
      update('life', (s) => ({ ...s, brief: { date: todayIso, text: r.text, key: keyOf(b), at: Date.now() } }));
    } catch (e) {
      setErr(ERR[e.code] || 'Chưa viết được bản tin bằng AI, đang dùng bản tóm tắt.');
      // Ghi nhận đã thử hôm nay để không tự gọi lại liên tục.
      update('life', (s) => ({ ...s, brief: { date: todayIso, text: s?.brief?.date === todayIso ? s.brief.text : null, key: keyOf(b), failed: true } }));
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (ai && ready && !brief && !tried.current && b.facts.length) { tried.current = true; write(); }
  }, [ai, ready, brief, b.facts.length]);

  const items = b.items;
  return (
    <section className="card brief">
      <div className="brief-head">
        <div style={{ minWidth: 0 }}>
          <div className="brief-kicker"><Icon name="sparkle" size={14} />Bản tin hôm nay</div>
          <div className="brief-greet">{b.greet}!</div>
        </div>
        <button className="brief-score" onClick={() => go('life')} aria-label={`Life Score ${ls.total ?? 'chưa có'}, mở chi tiết`}>
          <ScoreRing value={ls.total} size={62} thickness={7} />
          <span className="brief-score-label">Life Score<br /><b>{scoreWord(ls.total)}</b>{d7 ? <span style={{ color: d7 > 0 ? 'var(--good)' : 'var(--rose)' }}> {d7 > 0 ? '▲' : '▼'}{Math.abs(d7)}</span> : null}</span>
        </button>
      </div>

      {busy && !brief?.text && <div className="brief-ai brief-loading" aria-live="polite"><span className="brief-dot" />Đang viết bản tin…</div>}
      {brief?.text && <p className="brief-ai">{brief.text}</p>}

      {(!brief?.text || details) && (
        items.length ? (
          <div className="brief-list">
            {items.map((f, i) => (
              <button key={i} className={`brief-item ${f.tone}`} onClick={() => go(f.to)}>
                <Icon name={f.icon} size={15} />
                <span>{f.text}</span>
              </button>
            ))}
            {b.focus && !brief?.text && (
              <button className="brief-item focus" onClick={() => go(b.focus.to)}>
                <Icon name="bolt" size={15} /><span><b>Gợi ý:</b> {b.focus.text}</span>
              </button>
            )}
          </div>
        ) : <p className="muted" style={{ margin: '8px 0 0' }}>Hôm nay chưa có gì cần lưu ý. Một ngày nhẹ nhàng!</p>
      )}

      <div className="brief-foot">
        {brief?.text && <button className="link" onClick={() => setDetails((v) => !v)}>{details ? 'Ẩn chi tiết' : `Xem chi tiết (${items.length})`}</button>}
        {ai && (
          <button className="link" onClick={write} disabled={busy}>
            <Icon name="refresh" size={13} />{busy ? 'Đang viết…' : stale ? 'Dữ liệu mới · viết lại' : brief?.text ? 'Viết lại' : 'Viết bằng AI'}
          </button>
        )}
        {ai && <button className="link" onClick={openCommand}><Icon name="sparkle" size={13} />Ra lệnh</button>}
        {brief?.text && <span className="chip" style={{ marginLeft: 'auto' }}>Claude AI</span>}
      </div>
      {err && <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>{err}</div>}
    </section>
  );
}
