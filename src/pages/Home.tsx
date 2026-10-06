import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FolderOpen,
  Layers,
  ShieldCheck,
  Sparkles,
  Plus,
} from 'lucide-react';
import { useApp } from '../stores/app';
import { ContextCard, ContextIcon, SectionTitle } from '../components/ui';
import SessionControls from '../components/SessionControls';
import { date, duration, elapsed, relative } from '../utils/format';
export default function Home() {
  const { data, navigate } = useApp();
  const contexts = data.contexts.filter((c) => !c.archived);
  const open = data.sessions.find((s) => s.status !== 'completed');
  const featured = contexts.find((c) => c.id === open?.context_id) ?? contexts[0];
  const checkpoint = data.checkpoints.find((c) => c.context_id === featured?.id);
  const today = new Date().toDateString();
  const todayDuration = data.sessions
    .filter((s) => new Date(s.started_at).toDateString() === today)
    .reduce((total, s) => total + elapsed(s), 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR PERSONAL WORKSPACE</span>
          <h1>
            {greeting}
            <span className="accent-text">.</span>
          </h1>
          <p>Continue where you left off.</p>
        </div>
        <span className="date-display">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </span>
      </div>
      <section className={`resume-panel ${featured ? '' : 'first-context'}`}>
        <div className="hero-grid" aria-hidden="true" />
        <div className="resume-copy">
          <span className="eyebrow">
            <span className="status-dot live" />
            {featured ? 'READY WHEN YOU ARE' : 'WORK, REMEMBERED'}
          </span>
          {featured ? (
            <>
              <div className="hero-context">
                <span style={{ color: featured.accent }}>
                  <ContextIcon icon={featured.icon} size={34} />
                </span>
                <h2>{featured.name}</h2>
              </div>
              <p className="hero-description">
                {checkpoint?.next_action ||
                  featured.description ||
                  'Enter this context and leave a thread for your next session.'}
              </p>
              <div className="hero-meta">
                <span>
                  <Clock3 size={14} />
                  {relative(featured.last_active_at)}
                </span>
                <span>
                  <FolderOpen size={14} />
                  {featured.project_folder.split(/[\\/]/).pop()}
                </span>
                <span>
                  {checkpoint ? `${duration(checkpoint.duration)} last session` : 'No sessions yet'}
                </span>
              </div>
              <div className="hero-actions">
                <SessionControls context={featured} />
                <button className="text-button" onClick={() => navigate('detail', featured.id)}>
                  View context
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>
                Your work has a place.
                <br />
                <span className="muted">Give it a memory.</span>
              </h2>
              <p className="hero-description">
                Projects, ideas, subjects. Keep the threads together,
                <br className="desktop-break" /> then return with everything you need to continue.
              </p>
              <button
                className="button primary"
                onClick={() => useApp.setState({ createOpen: true })}
              >
                <Plus size={16} />
                Create your first context
                <ArrowRight size={16} />
              </button>
            </>
          )}
        </div>
        <div className="orbit-art" aria-hidden="true">
          <div className="orbit-circle outer" />
          <div className="orbit-circle middle" />
          <div className="orbit-circle inner" />
          <div className="orbit-center">
            <Layers size={42} strokeWidth={1} />
          </div>
          <div className="orbit-label label-a">CONTEXT</div>
          <div className="orbit-label label-b">MEMORY</div>
          <span className="orbit-dot dot-a" />
          <span className="orbit-dot dot-b" />
        </div>
      </section>
      <div className="stats-strip">
        <div>
          <Clock3 size={17} />
          <span>
            <strong>{duration(todayDuration)}</strong>
            <small>In context today</small>
          </span>
        </div>
        <div>
          <Layers size={17} />
          <span>
            <strong>{contexts.length.toString().padStart(2, '0')}</strong>
            <small>Work contexts</small>
          </span>
        </div>
        <div>
          <CheckCircle2 size={17} />
          <span>
            <strong>{data.checkpoints.length.toString().padStart(2, '0')}</strong>
            <small>Saved checkpoints</small>
          </span>
        </div>
        <div className="privacy-stat">
          <ShieldCheck size={18} />
          <span>
            <strong>Only on this device</strong>
            <small>No account. No cloud. Your work.</small>
          </span>
        </div>
      </div>
      <SectionTitle
        label="Your contexts"
        aside={
          <button className="text-button" onClick={() => navigate('contexts')}>
            View all
            <ArrowRight size={14} />
          </button>
        }
      />
      <div className="context-grid">
        {contexts.slice(0, 3).map((context) => (
          <ContextCard key={context.id} context={context} />
        ))}
        <button className="new-context-card" onClick={() => useApp.setState({ createOpen: true })}>
          <span>
            <Plus size={22} />
          </span>
          <strong>New context</strong>
          <small>Start another thread.</small>
        </button>
      </div>
      <div className="home-bottom">
        <section>
          <SectionTitle
            label="Last checkpoint"
            aside={<span className="small-badge">LOCAL MEMORY</span>}
          />
          {checkpoint ? (
            <button
              className="checkpoint-preview"
              onClick={() => navigate('detail', checkpoint.context_id)}
            >
              <span className="eyebrow">
                {date(checkpoint.timestamp)} · {duration(checkpoint.duration)}
              </span>
              <h3>{checkpoint.summary}</h3>
              <span className="text-button">
                Pick up this thread
                <ArrowUpRight size={14} />
              </span>
            </button>
          ) : (
            <div className="subtle-empty">
              <CheckCircle2 size={22} />
              <div>
                <strong>Your next stopping point becomes a starting point.</strong>
                <p>Suspend a session to save a checkpoint automatically.</p>
              </div>
            </div>
          )}
        </section>
        <section>
          <SectionTitle label="Built around your privacy" />
          <div className="privacy-card">
            <ShieldCheck size={25} />
            <h3>A memory, not a monitor.</h3>
            <p>
              You decide what to track. File contents, keystrokes, clipboard, and screenshots are
              never captured.
            </p>
            <button className="text-button" onClick={() => navigate('settings')}>
              Review privacy
              <ArrowUpRight size={14} />
            </button>
          </div>
        </section>
      </div>
      <footer className="page-footer">
        <span>YOUR WORK IS NOT APPS AND FILES. IT IS CONTEXTS.</span>
        <span>
          <Sparkles size={12} />
          AI optional. Useful without it.
        </span>
      </footer>
    </>
  );
}
