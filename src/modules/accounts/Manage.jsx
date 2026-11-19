import { useState } from 'react';
import Icon from '../../ui/Icon.jsx';
import { uid } from '../../core/format.js';
import { KINDS, PARTY_TYPES, TAG_COLORS } from './data.js';
import { lockNow } from './pin.js';
import { Chips, Sheet } from './ui.jsx';
import { PinCheckSheet } from './PinGate.jsx';

/** Danh sách sửa được: đổi tên tại chỗ, xóa khi không còn dùng, thêm mới. */
function EditList({ items, count, onRename, onDelete, onAdd, addLabel, extra, sub }) {
  const [edit, setEdit] = useState(null);
  const [add, setAdd] = useState(null);
  return (
    <div className="card ac-list">
      {items.map((it) => (
        <div key={it.id} className="ac-row">
          {edit?.id === it.id ? (
            <form style={{ display: 'flex', gap: 8, flex: 1 }} onSubmit={(e) => { e.preventDefault(); if (edit.name.trim()) onRename(it.id, edit.name.trim()); setEdit(null); }}>
              <input className="input" autoFocus aria-label={`Rename ${it.name}`} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              <button className="btn sm">Save</button>
            </form>
          ) : <>
            {extra?.(it)}
            <span className="ac-row-main"><span className="ac-row-title">{it.name}{it.builtIn && <span className="chip" style={{ marginLeft: 6, fontSize: 11 }}>Built-in</span>}</span>{sub?.(it) && <span className="ac-row-sub">{sub(it)}</span>}</span>
            <b className="num" style={{ fontSize: 14 }}>{count(it)}</b>
            <button className="ac-mini" onClick={() => setEdit({ id: it.id, name: it.name })} aria-label={`Rename ${it.name}`}><Icon name="pen" size={18} /></button>
            {onDelete && <button className="ac-mini" disabled={it.builtIn || count(it) > 0} title={count(it) > 0 ? 'Still in use' : ''} onClick={() => onDelete(it.id)} aria-label={`Delete ${it.name}`}><Icon name="trash" size={18} /></button>}
          </>}
        </div>
      ))}
      {add === null ? (
        <button className="ac-row ac-addrow" onClick={() => setAdd('')}><Icon name="plus" size={18} />{addLabel}</button>
      ) : (
        <form className="ac-row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (add.trim()) onAdd(add.trim()); setAdd(null); }}>
          <input className="input" autoFocus aria-label={addLabel} value={add} onChange={(e) => setAdd(e.target.value)} placeholder="Name" />
          <button className="btn sm">Add</button><button type="button" className="btn sm ghost" onClick={() => setAdd(null)}>Cancel</button>
        </form>
      )}
    </div>
  );
}

export default function Manage({ d, set, notify }) {
  const [catSheet, setCatSheet] = useState(null);
  const [newCat, setNewCat] = useState(null);
  const [askPin, setAskPin] = useState(false);
  const n = (pred) => d.accounts.filter(pred).length;
  const patchList = (key, id, patch) => set((s) => ({ ...s, [key]: s[key].map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const remove = (key, id) => set((s) => ({ ...s, [key]: s[key].filter((x) => x.id !== id) }));
  const append = (key, item) => set((s) => ({ ...s, [key]: [...s[key], item] }));
  const cat = catSheet && d.categories.find((c) => c.id === catSheet);

  return (
    <div className="ac-stack">
      <div className="ac-sec"><b>Categories &amp; platforms</b><button className="link" onClick={() => setNewCat({ name: '', kind: 'other' })}><Icon name="plus" size={15} />Category</button></div>
      <div className="card ac-list">
        {d.categories.map((c) => (
          <button key={c.id} className="ac-row" onClick={() => setCatSheet(c.id)}>
            <span className="icon-tile"><Icon name={KINDS[c.kind]?.icon || 'grid'} size={18} /></span>
            <span className="ac-row-main"><span className="ac-row-title">{c.name}{c.builtIn && <span className="chip" style={{ marginLeft: 6, fontSize: 11 }}>Built-in</span>}</span><span className="ac-row-sub">{d.platforms.filter((p) => p.categoryId === c.id).map((p) => p.name).join(' · ') || 'No platforms'}</span></span>
            <b className="num" style={{ fontSize: 14 }}>{n((a) => a.categoryId === c.id)}</b><Icon name="chev" size={18} className="muted" />
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12 }}>Built-in categories can be renamed but not deleted. A category or platform still in use cannot be deleted.</p>

      <div className="ac-sec"><b>Owners &amp; managers</b></div>
      <EditList items={d.parties} count={(p) => n((a) => a.ownerId === p.id || a.managerIds.includes(p.id))} addLabel="Person or organization"
        sub={(p) => `${PARTY_TYPES.find((t) => t.id === p.type)?.label || 'Person'}${p.isMe ? ' · me' : ''}`}
        onRename={(id, name) => patchList('parties', id, { name })} onDelete={(id) => remove('parties', id)}
        onAdd={(name) => append('parties', { id: uid(), name, type: 'person' })} />

      <div className="ac-sec"><b>Purposes</b></div>
      <EditList items={d.purposes} count={(p) => n((a) => a.purposeId === p.id)} addLabel="Purpose"
        onRename={(id, name) => patchList('purposes', id, { name })} onDelete={(id) => remove('purposes', id)} onAdd={(name) => append('purposes', { id: uid(), name })} />

      <div className="ac-sec"><b>Tags</b></div>
      <EditList items={d.tags} count={(t) => n((a) => a.tagIds.includes(t.id))} addLabel="Tag"
        onRename={(id, name) => patchList('tags', id, { name })} onDelete={(id) => remove('tags', id)} onAdd={(name) => append('tags', { id: uid(), name, color: 'rust' })}
        extra={(t) => (
          <button className={`ac-swatch ${t.color}`} aria-label={`Change color of ${t.name}`} onClick={() => patchList('tags', t.id, { color: TAG_COLORS[(TAG_COLORS.indexOf(t.color) + 1) % TAG_COLORS.length] })} />
        )} />

      <div className="ac-sec"><b>Review rules</b></div>
      <div className="card ac-list">
        <div className="ac-row"><span className="ac-row-main"><span className="ac-row-title">Review every</span><span className="ac-row-sub">Default for all categories</span></span>
          <select className="ac-mini-select" aria-label="Default review interval" value={d.reviewDays} onChange={(e) => set((s) => ({ ...s, reviewDays: Number(e.target.value) }))}>{[30, 60, 90, 180, 365].map((x) => <option key={x} value={x}>{x} days</option>)}</select></div>
        {d.categories.filter((c) => c.reviewDays).map((c) => (
          <div key={c.id} className="ac-row"><span className="ac-row-main"><span className="ac-row-title">{c.name}</span><span className="ac-row-sub">Override</span></span><b className="num" style={{ fontSize: 14 }}>{c.reviewDays} days</b></div>
        ))}
        <div className="ac-row"><span className="ac-row-main"><span className="ac-row-title">Flags</span><span className="ac-row-sub">Recovery email or phone missing · 2FA off or unknown · single Owner · locked account</span></span></div>
      </div>

      <div className="ac-sec"><b>Security</b></div>
      <div className="card ac-list">
        <button className="ac-row" onClick={() => { lockNow(); }}><Icon name="lock" size={20} className="mint" /><span className="ac-row-main"><span className="ac-row-title">Lock now</span><span className="ac-row-sub">Ask for the PIN again</span></span></button>
        <button className="ac-row" onClick={() => setAskPin(true)}><Icon name="key" size={20} className="mint" /><span className="ac-row-main"><span className="ac-row-title">Change PIN</span><span className="ac-row-sub">Enter the current PIN, then a new one</span></span></button>
      </div>

      {askPin && <PinCheckSheet d={d} title="Change PIN" sub="Enter your current PIN" onClose={() => setAskPin(false)} onOk={() => { setAskPin(false); set((s) => ({ ...s, pin: null })); notify('Now choose a new PIN'); }} />}
      {cat && (
        <Sheet title={cat.name} sub={`${KINDS[cat.kind].label} fields · ${n((a) => a.categoryId === cat.id)} accounts`} onClose={() => setCatSheet(null)}>
          <div className="ac-form">
            <div className="field"><label htmlFor="cat-name">Name</label><input id="cat-name" className="input" value={cat.name} onChange={(e) => patchList('categories', cat.id, { name: e.target.value })} /></div>
            <div className="field"><label htmlFor="cat-rev">Review every</label>
              <select id="cat-rev" className="input" value={cat.reviewDays || ''} onChange={(e) => patchList('categories', cat.id, { reviewDays: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">Default ({d.reviewDays} days)</option>{[30, 60, 90, 180, 365].map((x) => <option key={x} value={x}>{x} days</option>)}
              </select></div>
            <div className="ac-flabel">Platforms</div>
            <EditList items={d.platforms.filter((p) => p.categoryId === cat.id)} count={(p) => n((a) => a.platformId === p.id)} addLabel="Platform"
              onRename={(id, name) => patchList('platforms', id, { name })} onDelete={(id) => remove('platforms', id)} onAdd={(name) => append('platforms', { id: uid(), categoryId: cat.id, name })} />
            {!cat.builtIn && <button className="btn ghost" style={{ color: 'var(--rose)' }} disabled={n((a) => a.categoryId === cat.id) > 0}
              onClick={() => { set((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== cat.id), platforms: s.platforms.filter((p) => p.categoryId !== cat.id) })); setCatSheet(null); }}>
              <Icon name="trash" size={18} />{n((a) => a.categoryId === cat.id) ? 'Move its accounts first to delete' : 'Delete category'}</button>}
          </div>
        </Sheet>
      )}
      {newCat && (
        <Sheet title="New category" sub="Pick which fields its accounts use" onClose={() => setNewCat(null)}>
          <form className="ac-form" onSubmit={(e) => { e.preventDefault(); if (!newCat.name.trim()) return; const id = uid(); append('categories', { id, name: newCat.name.trim(), kind: newCat.kind }); append('platforms', { id: uid(), categoryId: id, name: newCat.name.trim() }); setNewCat(null); }}>
            <div className="field"><label htmlFor="nc-name">Name</label><input id="nc-name" className="input" autoFocus value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder="e.g. Shopping" /></div>
            <div className="ac-flabel">Fields like</div>
            <Chips options={Object.entries(KINDS).map(([id, k]) => ({ id, label: k.label }))} value={newCat.kind} onChange={(v) => v && setNewCat({ ...newCat, kind: v })} />
            <button className="btn block" disabled={!newCat.name.trim()}>Add category</button>
          </form>
        </Sheet>
      )}
    </div>
  );
}
