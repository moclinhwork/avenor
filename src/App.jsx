import { useState } from 'react';
import { useStore } from './core/store.jsx';
import { collectAgenda } from './core/agenda.js';
import { longDate, TODAY, todayIso } from './core/format.js';
import { go, useRoute } from './core/router.js';
import { byId, GROUPS, MODULES } from './modules/registry.js';
import Icon, { Logo } from './ui/Icon.jsx';
import { SYNC_TEXT } from './modules/settings/SettingsPage.jsx';

// Điện thoại: màn chính là Hôm nay; các module khác mở từ mục "Module".
const isPhone = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 979px)').matches;

export default function App() {
  const route = useRoute(isPhone() ? 'today' : 'overview');
  const mod = byId[route] || byId.overview;
  const { state, sync } = useStore();
  const [syncLabel, syncTone] = SYNC_TEXT[sync] || SYNC_TEXT.connecting;
  const [sheet, setSheet] = useState(false);
  const pending = collectAgenda(state, todayIso).filter((i) => !i.done).length;
  const Page = mod.Page;
  const open = (id) => { setSheet(false); go(id); };

  return (
    <div className="app">
      <div className="shell">
        <nav className="sidebar" aria-label="Các module">
          <div className="brand"><Logo size={28} />Avenor</div>
          {GROUPS.map((g) => (
            <div key={g.id} style={{ display: 'grid', gap: 2 }}>
              <div className="side-group">{g.label}</div>
              {MODULES.filter((m) => m.group === g.id).map((m) => (
                <button key={m.id} className={`side-item ${m.id === mod.id ? 'active' : ''}`} onClick={() => go(m.id)} aria-current={m.id === mod.id ? 'page' : undefined}>
                  <Icon name={m.icon} size={18} />{m.title}
                  {m.id === 'today' && pending > 0 && <span className="badge">{pending}</span>}
                </button>
              ))}
            </div>
          ))}
          <div className="side-foot">
            <span className={`chip ${syncTone}`}>{syncLabel}</span>
          </div>
        </nav>

        <div className="main">
          <header className="topbar">
            {mod.id === 'today' ? (
              <div className="brand mobile-only"><Logo />Avenor</div>
            ) : (
              <div className="topbar-left mobile-only">
                <button className="bare-btn" onClick={() => go('today')} aria-label="Về Hôm nay"><Icon name="back" size={22} /></button>
              </div>
            )}
            <div className="muted" style={{ fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}><span className="desktop-date">{longDate(TODAY)}</span><span className={`chip ${syncTone} desktop-date`}>{syncLabel}</span></div>
            {mod.id === 'today' ? (
              <button className="icon-btn" onClick={() => go('today')} aria-label={`${pending} việc chưa xong hôm nay`}>
                <Icon name="bell" size={22} />{pending > 0 && <span className="dot" />}
              </button>
            ) : (
              <>
                <button className="bare-btn mobile-only" style={{ marginLeft: 0, marginRight: -8 }} onClick={() => setSheet(true)} aria-label="Tất cả module"><Icon name="more" size={22} /></button>
                <button className="icon-btn desktop-only" onClick={() => go('today')} aria-label={`${pending} việc chưa xong hôm nay`}>
                  <Icon name="bell" size={22} />{pending > 0 && <span className="dot" />}
                </button>
              </>
            )}
          </header>
          <main className="content" key={mod.id}>
            <Page />
          </main>
        </div>
      </div>

      <nav className="bottomnav" aria-label="Điều hướng chính">
        <button className={`bn-item ${mod.id === 'today' && !sheet ? 'active' : ''}`} onClick={() => open('today')} aria-current={mod.id === 'today' ? 'page' : undefined}>
          <Icon name="today" size={24} />Hôm nay
        </button>
        <button className={`bn-item ${mod.id !== 'today' || sheet ? 'active' : ''}`} onClick={() => setSheet(true)}>
          <Icon name="layers" size={24} />Module
        </button>
      </nav>

      {sheet && (
        <>
          <div className="sheet-backdrop" onClick={() => setSheet(false)} />
          <div className="sheet" role="dialog" aria-label="Tất cả module">
            <div className="sheet-grip" />
            <h3 style={{ fontSize: 17, marginBottom: 12 }}>Tất cả module</h3>
            <div className="sheet-grid">
              {MODULES.map((m) => (
                <button key={m.id} className={`sheet-item ${m.id === mod.id ? 'active' : ''}`} onClick={() => open(m.id)}>
                  <span className="icon-tile"><Icon name={m.icon} size={20} /></span>{m.short || m.title}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 14, textAlign: 'center' }}><span className={`chip ${syncTone}`}>{syncLabel}</span></div>
          </div>
        </>
      )}
    </div>
  );
}
