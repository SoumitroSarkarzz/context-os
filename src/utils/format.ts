import type { ActivityEvent, Session } from '../types';
export function duration(ms: number) {
  const sec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
export function clock(ms: number) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}
export function elapsed(session: Session, now = Date.now()) {
  return session.status === 'completed'
    ? session.total_duration
    : Math.max(0, (session.paused_at ?? now) - session.started_at - session.paused_duration);
}
export function relative(time: number | null) {
  if (!time) return 'Never entered';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}
export function date(time: number) {
  return new Date(time).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
export function time(time: number) {
  return new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
export function fileName(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}
export function eventLabel(event: ActivityEvent) {
  return event.metadata.path
    ? `${fileName(event.metadata.path)} ${event.event_type.replace('file_', '')}`
    : event.event_type.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
}
