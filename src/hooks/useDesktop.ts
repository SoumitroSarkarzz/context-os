import { useEffect } from 'react';
import { useApp } from '../stores/app';
import { desktopAvailable } from '../services/api';
export function useDesktop() {
  const theme = useApp((s) => s.data.settings.theme);
  const compact = useApp((s) => s.data.settings.compact);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.compact = String(compact);
  }, [compact]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const state = useApp.getState();
      if (e.code === 'KeyK') {
        e.preventDefault();
        useApp.setState({ paletteOpen: !state.paletteOpen });
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        useApp.setState({ sidebarCollapsed: !state.sidebarCollapsed });
      } else if (e.code === 'KeyN') {
        e.preventDefault();
        useApp.setState({ createOpen: true });
      } else if (e.code === 'KeyF' && e.shiftKey) {
        e.preventDefault();
        state.navigate('search');
      } else if (e.code === 'Space' && e.shiftKey) {
        e.preventDefault();
        useApp.setState({ captureOpen: true });
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    void useApp
      .getState()
      .refresh()
      .then(() => {
        const state = useApp.getState();
        if (state.data.settings.reopen_last) {
          try {
            const selected = localStorage.getItem('context-os:last-context');
            if (selected && state.data.contexts.some((c) => c.id === selected))
              state.navigate('detail', selected);
          } catch {
            /* Storage may be disabled; SQLite remains authoritative. */
          }
        }
      });
    if (!desktopAvailable()) return;
    const timer = setInterval(() => {
      if (!document.hidden) void useApp.getState().refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, []);
}
