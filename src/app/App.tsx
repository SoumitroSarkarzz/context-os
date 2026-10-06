import { useEffect, useState } from 'react';
import {
  Home as HomeIcon,
  Layers,
  BookOpen,
  Clock3,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Command,
  ArrowUpRight,
  X,
  Pause,
  Play,
} from 'lucide-react';
import type { Page } from '../types';
import { useApp } from '../stores/app';
import { useDesktop } from '../hooks/useDesktop';
import { desktopAvailable } from '../services/api';
import Home from '../pages/Home';
import Contexts from '../pages/Contexts';
import ContextDetail from '../pages/ContextDetail';
import Memory from '../pages/Memory';
import Timeline from '../components/Timeline';
import Search from '../pages/Search';
import Settings from '../pages/Settings';
import CreateContext from '../components/CreateContext';
import CommandPalette from '../components/CommandPalette';
import QuickCapture from '../components/QuickCapture';
import { clock, elapsed } from '../utils/format';
const navigation: [Page, string, typeof Layers][] = [
  ['home', 'Home', HomeIcon],
  ['contexts', 'Contexts', Layers],
  ['memory', 'Memory', BookOpen],
  ['timeline', 'Timeline', Clock3],
  ['search', 'Search', SearchIcon],
];
export default function App() {
  useDesktop();
  const {
    page,
    sidebarCollapsed,
    createOpen,
    paletteOpen,
    captureOpen,
    data,
    error,
    loadError,
    trackingError,
    toast,
    loaded,
    navigate,
    selectedId,
  } = useApp();
  const current = data.sessions.find((s) => s.status !== 'completed');
  const activeContext = data.contexts.find((c) => c.id === current?.context_id);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!current) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [current?.id]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => useApp.setState({ toast: null }), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (page === 'detail' && useApp.getState().selectedId) {
      try {
        localStorage.setItem('context-os:last-context', useApp.getState().selectedId!);
      } catch {
        /* Optional view preference only. */
      }
    }
  }, [page, selectedId]);
  return (
    <div className={`app-shell ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Layers size={20} strokeWidth={1.5} />
          </span>
          {!sidebarCollapsed && (
            <strong>
              CONTEXT<span>OS</span>
            </strong>
          )}
        </div>
        <button
          className="palette-trigger"
          aria-label="Open command palette"
          onClick={() => useApp.setState({ paletteOpen: true })}
        >
          <SearchIcon size={15} />
          {!sidebarCollapsed && (
            <>
              <span>Find a thread…</span>
              <kbd>⌘ K</kbd>
            </>
          )}
        </button>
        <nav aria-label="Main navigation">
          {navigation.map(([target, label, Icon]) => (
            <button
              title={label}
              key={target}
              className={
                page === target || (target === 'contexts' && page === 'detail') ? 'active' : ''
              }
              onClick={() => navigate(target)}
            >
              <Icon size={18} strokeWidth={1.6} />
              {!sidebarCollapsed && <span>{label}</span>}
              {target === 'contexts' &&
                !sidebarCollapsed &&
                !!data.contexts.filter((c) => !c.archived).length && (
                  <small>{data.contexts.filter((c) => !c.archived).length}</small>
                )}
            </button>
          ))}
        </nav>
        {!sidebarCollapsed && (
          <div className="sidebar-contexts">
            <span className="eyebrow">PINNED TO YOUR WORK</span>
            {data.contexts
              .filter((c) => !c.archived)
              .slice(0, 5)
              .map((c) => (
                <button key={c.id} onClick={() => navigate('detail', c.id)}>
                  <span className="mini-context-dot" style={{ background: c.accent }} />
                  {c.name}
                </button>
              ))}
            {!data.contexts.length && <p>Your contexts will live here.</p>}
          </div>
        )}
        <div className="sidebar-bottom">
          <button
            className={`nav-setting ${page === 'settings' ? 'active' : ''}`}
            title="Settings"
            onClick={() => navigate('settings')}
          >
            <SettingsIcon size={18} />
            {!sidebarCollapsed && <span>Settings</span>}
          </button>
          <button
            className="sidebar-create"
            title="New context"
            onClick={() => useApp.setState({ createOpen: true })}
          >
            <Plus size={18} />
            {!sidebarCollapsed && (
              <>
                <span>New context</span>
                <kbd>⌘ N</kbd>
              </>
            )}
          </button>
          <div className="engine-status">
            <span className={`status-dot ${desktopAvailable() && !loadError ? 'live' : ''}`} />
            {!sidebarCollapsed && (
              <div>
                <strong>{desktopAvailable() ? 'Local engine' : 'Desktop engine required'}</strong>
                <small>
                  {desktopAvailable() ? 'On-device · Private by default' : 'Launch the Tauri app'}
                </small>
              </div>
            )}
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="titlebar">
          <button
            className="icon-button"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => useApp.setState({ sidebarCollapsed: !sidebarCollapsed })}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
          <span className="breadcrumb">
            Workspace <span>/</span>{' '}
            {page === 'detail'
              ? data.contexts.find((c) => c.id === useApp.getState().selectedId)?.name
              : page.charAt(0).toUpperCase() + page.slice(1)}
          </span>
          <div className="titlebar-right">
            <span className="local-label">
              <span className="status-dot live" />
              LOCAL FIRST
            </span>
            <button
              className="icon-button"
              aria-label="Commands"
              onClick={() => useApp.setState({ paletteOpen: true })}
            >
              <Command size={15} />
            </button>
          </div>
        </header>
        {current && (
          <button className="session-banner" onClick={() => navigate('detail', current.context_id)}>
            <span>
              {current.status === 'active' ? (
                <span className="status-dot live pulsing" />
              ) : (
                <Pause size={13} />
              )}{' '}
              {activeContext?.name}
            </span>
            <span>
              {clock(elapsed(current, now))}
              <span className="small-badge">
                {current.status === 'paused' ? 'PAUSED' : 'IN SESSION'}
              </span>
              <ArrowUpRight size={15} />
            </span>
          </button>
        )}
        {(error || loadError || trackingError) && (
          <div className="error-banner" role="alert">
            <span>{error || loadError || trackingError}</span>
            <button className="text-button" onClick={() => void useApp.getState().refresh()}>
              <Play size={12} />
              Refresh status
            </button>
            {error && (
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => useApp.setState({ error: null })}
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}
        <main className="workspace" id="main-content">
          {!loaded ? (
            <div className="loading-state">Opening local memory…</div>
          ) : page === 'home' ? (
            <Home />
          ) : page === 'contexts' ? (
            <Contexts />
          ) : page === 'detail' ? (
            <ContextDetail key={useApp.getState().selectedId} />
          ) : page === 'memory' ? (
            <Memory />
          ) : page === 'search' ? (
            <Search />
          ) : page === 'settings' ? (
            <Settings />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">WHAT HAPPENED</span>
                  <h1>
                    Timeline<span className="accent-text">.</span>
                  </h1>
                  <p>The history of your work, one meaningful change at a time.</p>
                </div>
              </div>
              <Timeline />
            </>
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            aria-label="Dismiss notification"
            className="icon-button"
            onClick={() => useApp.setState({ toast: null })}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {createOpen && <CreateContext />}
      {paletteOpen && !createOpen && <CommandPalette />}
      {captureOpen && !createOpen && !paletteOpen && <QuickCapture />}
    </div>
  );
}
