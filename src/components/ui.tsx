import { Box, Braces, BookOpen, Layers, Orbit, ArrowUpRight, Folder, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { Context } from '../types';
import { useApp } from '../stores/app';
import { relative } from '../utils/format';
export const iconOptions = ['layers', 'box', 'braces', 'book', 'orbit'];
export function ContextIcon({ icon = 'layers', size = 22 }: { icon?: string; size?: number }) {
  const Component =
    (
      { box: Box, braces: Braces, book: BookOpen, orbit: Orbit, layers: Layers } as Record<
        string,
        typeof Layers
      >
    )[icon] ?? Layers;
  return <Component size={size} strokeWidth={1.6} />;
}
export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon ?? <Layers size={28} />}</div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function SectionTitle({ label, aside }: { label: string; aside?: ReactNode }) {
  return (
    <div className="section-title">
      <h2>{label}</h2>
      {aside}
    </div>
  );
}
export function ContextCard({ context }: { context: Context }) {
  const navigate = useApp((s) => s.navigate);
  return (
    <button className="context-card" onClick={() => navigate('detail', context.id)}>
      <div className="card-top">
        <span className="context-symbol" style={{ color: context.accent }}>
          <ContextIcon icon={context.icon} />
        </span>
        <ArrowUpRight size={16} className="muted" />
      </div>
      <h3>{context.name}</h3>
      <p>{context.description || 'A place for your work.'}</p>
      <div className="card-meta">
        <span>
          <Folder size={12} />
          {fileNameSafe(context.project_folder)}
        </span>
        <span>{relative(context.last_active_at)}</span>
      </div>
      <div className="status-line">
        <span className={`status-dot ${context.status === 'active' ? 'live' : ''}`} />
        {context.status}
      </div>
    </button>
  );
}
function fileNameSafe(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const element = ref.current;
    const focusable = () =>
      Array.from(
        element?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,textarea,select,[tabindex="0"]',
        ) ?? [],
      );
    focusable()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
      if (event.key === 'Tab') {
        const items = focusable();
        if (event.shiftKey && document.activeElement === items[0]) {
          event.preventDefault();
          items.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
          event.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? 'wide' : ''}`}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
