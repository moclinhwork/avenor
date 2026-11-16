import { useEffect, useMemo, useState } from 'react';
import { SERVER } from '../../core/platform.js';
import { useModule, useStore } from '../../core/store.jsx';
import { go } from '../../core/router.js';
import { uid } from '../../core/format.js';
import { BarChart } from '../../ui/charts.jsx';
import { Card, PageHead, Tabs } from '../../ui/common.jsx';
import Icon from '../../ui/Icon.jsx';
import { audioUrl, delBlob, deleteAudio, fmtDur, getBlob, retryStt } from './audio.js';
import { openCapture, patchIdea, uploadIdea } from './background.js';
import { COLORS, ideaDate, initial, STT_TEXT } from './data.js';

const reviewId = () => new URLSearchParams((window.location.hash.split('?')[1] || '')).get('review');

function useReviewId() {
  const [id, setId] = useState(reviewId);
  useEffect(() => {
    const on = () => setId(reviewId());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return id;
}

// Nguồn phát: bản trên máy chủ, hoặc bản còn nằm trên máy (chưa tải lên).
function useAudioSrc(idea) {
  const [local, setLocal] = useState(null);
  const remote = audioUrl(idea);
  useEffect(() => {
    if (remote) return undefined;
    let url = null; let alive = true;
    getBlob(idea.id).then((b) => { if (alive && b) { url = URL.createObjectURL(b); setLocal(url); } });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [idea.id, remote]);
  return remote || local;
}

function Player({ idea }) {
  const src = useAudioSrc(idea);
  if (!src) return <div className="muted" style={{ fontSize: 13 }}>Bản ghi không có trên thiết bị này.</div>;
  // Bản webm của MediaRecorder thiếu thời lượng: tua tới cuối một lần để trình duyệt tính ra.
  const fix = (e) => {
    const a = e.currentTarget;
    if (a.duration !== Infinity) return;
    a.currentTime = 1e7;
    a.addEventListener('timeupdate', function back() { a.removeEventListener('timeupdate', back); a.currentTime = 0; });
  };
  return <audio className="idea-audio" controls preload="metadata" src={src} onLoadedMetadata={fix} />;
}

const catOf = (data, id) => data.categories.find((c) => c.id === id) || data.categories[0];

function SttLine({ idea, onRetry }) {
  if (idea.stt === 'done' || !idea.stt) return null;
  const tone = idea.stt === 'error' ? 'rose' : idea.stt === 'unavailable' ? '' : 'amber';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span className={`chip ${tone}`}>{STT_TEXT[idea.stt] || idea.stt}</span>
      {idea.sttError && <span className="muted" style={{ fontSize: 12.5 }}>{idea.sttError}</span>}
      {idea.stt === 'error' && SERVER && <button className="btn sm ghost" onClick={onRetry}>Thử chép lời lại</button>}
    </div>
  );
}

/* ---------- Xem lại một ý tưởng ---------- */
function Review({ data, set, idea }) {
  const { notify } = useStore();
  const [title, setTitle] = useState(idea.title);
  const [text, setText] = useState(idea.transcript);
  const [cat, setCat] = useState(idea.categoryId);
  // Bản chép về sau khi đang mở: điền vào nếu người dùng chưa gõ gì.
  useEffect(() => { setText((t) => (t === '' || t === undefined ? idea.transcript : t)); }, [idea.transcript]);
  useEffect(() => { if (!idea.titleEdited) setTitle(idea.title); }, [idea.title, idea.titleEdited]);

  const retry = async () => {
    try {
      if (idea.audioId) { await retryStt(idea.audioId); patchIdea(set, idea.id, { stt: 'pending', sttError: '' }); }
      else { patchIdea(set, idea.id, { stt: 'uploading', sttError: '' }); uploadIdea(set, idea); }
    } catch { notify('Chưa gửi được, hãy thử lại khi có mạng'); }
  };
  const save = () => {
    patchIdea(set, idea.id, (x) => ({
      title: title.trim() || x.title, transcript: text, categoryId: cat,
      titleEdited: x.titleEdited || title !== x.title, transcriptEdited: x.transcriptEdited || text !== x.transcript,
    }));
    notify('Đã lưu ý tưởng');
    go('ideas');
  };
  const remove = () => {
    if (!window.confirm('Xóa ý tưởng này cùng bản ghi âm?')) return;
    if (idea.audioId) deleteAudio(idea.audioId);
    delBlob(idea.id);
    set((s) => ({ ...s, ideas: s.ideas.filter((x) => x.id !== idea.id) }));
    go('ideas');
  };

  return (
    <>
      <div className="page-head" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="bare-btn" onClick={() => go('ideas')} aria-label="Về danh sách"><Icon name="back" size={22} /></button>
          <h1 style={{ fontSize: 26 }}>Xem lại ý tưởng</h1>
        </div>
      </div>
      <div className="stack" style={{ maxWidth: 720 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 13 }}><Icon name="clock" size={14} /> {ideaDate(idea.createdAt)} · {fmtDur(idea.duration)}</span>
            <SttLine idea={idea} onRetry={retry} />
          </div>
          <Player idea={idea} />
        </Card>
        <Card>
          <div className="stack" style={{ gap: 14 }}>
            <div className="field">
              <label htmlFor="idea-title">Tiêu đề</label>
              <input id="idea-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="idea-text">Bản chép lời</label>
              <textarea id="idea-text" className="input" rows={7} value={text} placeholder={idea.stt === 'done' ? 'Không nghe được lời nào' : 'Bản chép sẽ tự điền vào khi xong. Bạn cũng có thể tự gõ.'} onChange={(e) => setText(e.target.value)} />
            </div>
            <div className="field">
              <label>Danh mục</label>
              <div className="cat-chips">
                {data.categories.map((c) => (
                  <button key={c.id} className={`cat-chip ${cat === c.id ? 'on' : ''}`} style={{ '--c': c.color }} onClick={() => setCat(c.id)} aria-pressed={cat === c.id}>
                    <i />{c.name}
                  </button>
                ))}
              </div>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" checked={!!idea.done} onChange={(e) => patchIdea(set, idea.id, { done: e.target.checked })} /> Đã xử lý ý tưởng này
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <button className="btn ghost" onClick={remove} style={{ color: 'var(--rose)' }}><Icon name="trash" size={16} />Xóa</button>
              <button className="btn" onClick={save}><Icon name="check" size={16} />Lưu ý tưởng</button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

/* ---------- Danh sách ---------- */
function IdeaRow({ idea, cat }) {
  const [play, setPlay] = useState(false);
  return (
    <div className="row idea-row">
      <button className="idea-play" onClick={() => setPlay((p) => !p)} aria-label={play ? 'Ẩn trình phát' : 'Nghe lại'} style={{ '--c': cat.color }}>
        <Icon name={play ? 'close' : 'play'} size={16} stroke={2.4} />
      </button>
      <div className="row-main" style={{ cursor: 'pointer' }} onClick={() => go(`ideas?review=${idea.id}`)}>
        <div className="row-title" style={{ textDecoration: idea.done ? 'line-through' : 'none', opacity: idea.done ? 0.65 : 1 }}>{idea.title}</div>
        <div className="row-sub idea-snippet">
          {idea.transcript ? idea.transcript : (STT_TEXT[idea.stt] || '')}
        </div>
        <div className="row-sub" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
          <span className="cat-dot" style={{ '--c': cat.color }}>{cat.name}</span>
          <span>{ideaDate(idea.createdAt)} · {fmtDur(idea.duration)}</span>
        </div>
        {play && <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}><Player idea={idea} /></div>}
      </div>
      <Icon name="chevR" size={16} />
    </div>
  );
}

function List({ data }) {
  const [q, setQ] = useState('');
  const [f, setF] = useState('all');
  const counts = useMemo(() => Object.fromEntries(data.categories.map((c) => [c.id, data.ideas.filter((x) => x.categoryId === c.id).length])), [data]);
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  const nq = norm(q.trim());
  const list = data.ideas
    .filter((x) => (f === 'all' || x.categoryId === f) && (!nq || norm(`${x.title} ${x.transcript}`).includes(nq)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="stack">
      <div className="input-icon">
        <Icon name="search" size={18} />
        <input className="input" type="search" placeholder="Tìm trong tiêu đề và bản chép…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm ý tưởng" />
      </div>
      <div className="cat-chips scroll">
        <button className={`cat-chip ${f === 'all' ? 'on' : ''}`} style={{ '--c': 'var(--mint)' }} onClick={() => setF('all')}>Tất cả <b>{data.ideas.length}</b></button>
        {data.categories.map((c) => (
          <button key={c.id} className={`cat-chip ${f === c.id ? 'on' : ''}`} style={{ '--c': c.color }} onClick={() => setF(c.id)}><i />{c.name} <b>{counts[c.id]}</b></button>
        ))}
      </div>
      <Card>
        {list.length ? list.map((x) => <IdeaRow key={x.id} idea={x} cat={catOf(data, x.categoryId)} />)
          : <div className="empty">{data.ideas.length ? 'Không có ý tưởng nào khớp.' : 'Chưa có ý tưởng nào. Bấm nút mic để ghi ý tưởng đầu tiên.'}</div>}
      </Card>
    </div>
  );
}

/* ---------- Danh mục ---------- */
function Categories({ data, set }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[3]);
  const count = (id) => data.ideas.filter((x) => x.categoryId === id).length;
  const patchCat = (id, p) => set((s) => ({ ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  const add = () => {
    if (!name.trim()) return;
    set((s) => ({ ...s, categories: [...s.categories, { id: uid(), name: name.trim(), color, icon: 'tag' }] }));
    setName('');
  };
  const del = (c) => {
    const n = count(c.id);
    if (!window.confirm(n ? `Xóa danh mục "${c.name}"? ${n} ý tưởng sẽ chuyển về Inbox.` : `Xóa danh mục "${c.name}"?`)) return;
    set((s) => ({ ...s, categories: s.categories.filter((x) => x.id !== c.id), ideas: s.ideas.map((x) => (x.categoryId === c.id ? { ...x, categoryId: 'inbox' } : x)) }));
  };
  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <Card title="Danh mục" icon="tag">
        {data.categories.map((c) => (
          <div key={c.id} className="row">
            <span className="icon-tile" style={{ background: `color-mix(in srgb, ${c.color} 18%, transparent)`, color: c.color }}><Icon name={c.icon || 'tag'} size={18} /></span>
            <div className="row-main">
              <input className="input cat-name" value={c.name} onChange={(e) => patchCat(c.id, { name: e.target.value })} aria-label={`Tên danh mục ${c.name}`} />
              <div className="swatches">
                {COLORS.map((col) => <button key={col} className={`swatch ${c.color === col ? 'on' : ''}`} style={{ background: col }} onClick={() => patchCat(c.id, { color: col })} aria-label={`Màu ${col}`} />)}
              </div>
            </div>
            <span className="chip">{count(c.id)} ý tưởng</span>
            {!c.fixed && <button className="bare-btn" style={{ margin: 0 }} onClick={() => del(c)} aria-label={`Xóa danh mục ${c.name}`}><Icon name="trash" size={18} /></button>}
          </div>
        ))}
      </Card>
      <Card title="Thêm danh mục" icon="plus">
        <div className="stack" style={{ gap: 10 }}>
          <input className="input" placeholder="Tên danh mục, ví dụ: Du lịch, Nội dung…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <div className="swatches">
            {COLORS.map((col) => <button key={col} className={`swatch ${color === col ? 'on' : ''}`} style={{ background: col }} onClick={() => setColor(col)} aria-label={`Màu ${col}`} />)}
          </div>
          <div><button className="btn" onClick={add} disabled={!name.trim()}><Icon name="plus" size={16} />Thêm danh mục</button></div>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Thống kê ---------- */
function Stats({ data }) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const month = data.ideas.filter((x) => x.createdAt.slice(0, 7) === ym);
  const done = data.ideas.filter((x) => x.done).length;
  const inbox = data.ideas.filter((x) => x.categoryId === 'inbox' && !x.done).length;
  const totalSec = data.ideas.reduce((s, x) => s + (x.duration || 0), 0);
  // 8 tuần gần nhất (tuần bắt đầu thứ Hai).
  const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weeks = Array.from({ length: 8 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() - 7 * (7 - i)); return d; });
  const values = weeks.map((w) => { const e = new Date(w); e.setDate(e.getDate() + 7); return data.ideas.filter((x) => { const t = new Date(x.createdAt); return t >= w && t < e; }).length; });
  const tiles = [
    { label: 'Ý tưởng tháng này', value: month.length },
    { label: 'Đã xử lý', value: `${done} / ${data.ideas.length}` },
    { label: 'Chờ phân loại (Inbox)', value: inbox },
    { label: 'Tổng thời lượng ghi', value: fmtDur(totalSec) },
  ];
  return (
    <div className="stack">
      <div className="tiles">
        {tiles.map((t) => (
          <div key={t.label} className="tile"><span className="tile-main"><span className="tile-label" style={{ display: 'block' }}>{t.label}</span><span className="tile-value" style={{ display: 'block' }}>{t.value}</span></span></div>
        ))}
      </div>
      <Card title="Ý tưởng mỗi tuần" icon="bulb">
        <BarChart labels={weeks.map((w) => `${w.getDate()}/${w.getMonth() + 1}`)} series={[{ name: 'Ý tưởng', color: 'var(--mint)', values }]} height={180} />
      </Card>
      <Card title="Theo danh mục" icon="tag">
        {data.categories.map((c) => {
          const n = data.ideas.filter((x) => x.categoryId === c.id).length;
          const pct = data.ideas.length ? Math.round((n / data.ideas.length) * 100) : 0;
          return (
            <div key={c.id} className="row">
              <span className="cat-dot" style={{ '--c': c.color, minWidth: 90 }}>{c.name}</span>
              <div className="row-main"><div className="bar-track"><div style={{ width: `${pct}%`, background: c.color, height: '100%', borderRadius: 9 }} /></div></div>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</b>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

export default function IdeasPage() {
  const [raw, set] = useModule('ideas');
  const data = { ...initial, ...(raw || {}) };
  const rid = useReviewId();
  const [tab, setTab] = useState('list');
  const idea = rid && data.ideas.find((x) => x.id === rid);
  if (idea) return <Review key={idea.id} data={data} set={set} idea={idea} />;

  const waiting = data.ideas.filter((x) => ['uploading', 'pending', 'working'].includes(x.stt)).length;
  return (
    <>
      <PageHead title="Ý tưởng" subtitle={waiting ? `${waiting} bản ghi đang chép lời` : 'Ghi nhanh bằng giọng nói, phân loại sau'}>
        <button className="btn" onClick={openCapture}><Icon name="mic" size={18} />Ghi ý tưởng</button>
      </PageHead>
      <Tabs tabs={[{ id: 'list', label: 'Danh sách' }, { id: 'cats', label: 'Danh mục' }, { id: 'stats', label: 'Thống kê' }]} value={tab} onChange={setTab} />
      {tab === 'list' && <List data={data} />}
      {tab === 'cats' && <Categories data={data} set={set} />}
      {tab === 'stats' && <Stats data={data} />}
    </>
  );
}
