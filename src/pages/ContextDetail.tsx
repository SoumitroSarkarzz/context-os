import { useState } from 'react';
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  FileText,
  FolderOpen,
  Pencil,
  Trash2,
  Clock3,
  ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../stores/app';
import { api } from '../services/api';
import { ContextIcon, Empty, SectionTitle } from '../components/ui';
import SessionControls from '../components/SessionControls';
import Timeline from '../components/Timeline';
import Notes from '../components/Notes';
import CreateContext from '../components/CreateContext';
import { date, duration, elapsed, fileName, relative } from '../utils/format';
export default function ContextDetail() {
  const { data, selectedId, navigate, action, pending } = useApp();
  const context = data.contexts.find((c) => c.id === selectedId);
  const [tab, setTab] = useState('Overview');
  const [editing, setEditing] = useState(false);
  const [fileType, setFileType] = useState('all');
  const [extension, setExtension] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  if (!context)
    return (
      <Empty
        title="Context unavailable"
        action={
          <button className="button secondary" onClick={() => navigate('contexts')}>
            Back to contexts
          </button>
        }
      >
        This context may have been deleted.
      </Empty>
    );
  const sessions = data.sessions.filter((s) => s.context_id === context.id);
  const checkpoints = data.checkpoints.filter((c) => c.context_id === context.id);
  const checkpoint = checkpoints[0];
  const fileEvents = data.events.filter(
    (e) => e.context_id === context.id && e.event_type.startsWith('file_') && e.metadata.path,
  );
  const total = sessions.reduce((sum, s) => sum + elapsed(s), 0);
  const current = sessions.find((s) => s.status !== 'completed');
  const filteredFiles = fileEvents.filter(
    (e) =>
      (fileType === 'all' || e.event_type === fileType) &&
      (!extension || e.metadata.path?.toLowerCase().endsWith(extension.toLowerCase())) &&
      (!sessionFilter || e.session_id === sessionFilter),
  );
  const files = filteredFiles.filter(
    (e, i, all) => all.findIndex((item) => item.metadata.path === e.metadata.path) === i,
  );
  return (
    <>
      <button className="back-link" onClick={() => navigate('contexts')}>
        <ArrowLeft size={14} />
        All contexts
      </button>
      <div className="detail-heading">
        <span className="detail-symbol" style={{ color: context.accent }}>
          <ContextIcon icon={context.icon} size={32} />
        </span>
        <div>
          <span className="eyebrow">
            {context.status.toUpperCase()} · {relative(context.last_active_at)}
          </span>
          <h1>{context.name}</h1>
          <p>{context.description || 'A place for your work.'}</p>
        </div>
        <SessionControls context={context} />
      </div>
      <div className="detail-metadata">
        <button
          className="text-button"
          onClick={() => void action(() => api.openFolder(context.id))}
        >
          <FolderOpen size={14} />
          {context.project_folder}
          <ArrowUpRight size={12} />
        </button>
        <span>
          <Clock3 size={14} />
          {duration(total)} across {sessions.length} sessions
        </span>
      </div>
      <div className="tabs" role="tablist" aria-label="Context sections">
        {['Overview', 'Timeline', 'Files', 'Sessions', 'Memory', 'Settings'].map((t) => (
          <button
            role="tab"
            aria-selected={t === tab}
            className={t === tab ? 'selected' : ''}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Overview' && (
        <>
          <div className="overview-grid">
            <section className="panel">
              <SectionTitle
                label="Last checkpoint"
                aside={checkpoint && <span className="muted">{date(checkpoint.timestamp)}</span>}
              />
              {checkpoint ? (
                <>
                  <p className="checkpoint-summary">{checkpoint.summary}</p>
                  <div className="checkpoint-section">
                    <span className="eyebrow">RECORDED</span>
                    {checkpoint.completed.map((s) => (
                      <p key={s}>{s}</p>
                    ))}
                  </div>
                  <div className="next-action">
                    <span className="eyebrow">PICK UP THIS THREAD</span>
                    <p>{checkpoint.next_action}</p>
                  </div>
                  <p className="hint">
                    Deterministic checkpoint · Completion is not inferred. Use notes to record
                    finished and unfinished work.
                  </p>
                </>
              ) : (
                <Empty title="No checkpoint yet">
                  Start a session, then suspend it. A local summary will remember where you stopped.
                </Empty>
              )}
            </section>
            <section className="panel">
              <SectionTitle
                label="Recent files"
                aside={
                  <button className="text-button" onClick={() => setTab('Files')}>
                    View all
                    <ArrowUpRight size={14} />
                  </button>
                }
              />
              {fileEvents.length ? (
                <div className="file-list">
                  {fileEvents
                    .filter(
                      (e, i, all) =>
                        all.findIndex((item) => item.metadata.path === e.metadata.path) === i,
                    )
                    .slice(0, 6)
                    .map((e) => (
                      <div key={e.id}>
                        <FileText size={17} />
                        <span>
                          <strong>{fileName(e.metadata.path!)}</strong>
                          <small>{e.metadata.path}</small>
                        </span>
                        <small>{relative(e.timestamp)}</small>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="subtle-empty">
                  <FileText size={24} />
                  <p>
                    {context.tracking_preferences.files
                      ? 'Changes will appear during your next active session.'
                      : 'File tracking is off for this context.'}
                  </p>
                </div>
              )}
              <div className="tracking-caption">
                <span
                  className={`status-dot ${context.tracking_preferences.files ? 'live' : ''}`}
                />
                {context.tracking_preferences.files
                  ? 'File metadata tracking enabled'
                  : 'Session duration only'}
              </div>
            </section>
          </div>
          <Notes contextId={context.id} />
        </>
      )}
      {tab === 'Timeline' && <Timeline contextId={context.id} />}
      {tab === 'Files' && (
        <>
          <div className="filter-bar">
            <select
              aria-label="File event type"
              value={fileType}
              onChange={(e) => setFileType(e.target.value)}
            >
              <option value="all">All changes</option>
              <option value="file_modified">Modified</option>
              <option value="file_created">Created</option>
              <option value="file_deleted">Deleted</option>
              <option value="file_renamed">Renamed</option>
            </select>
            <input
              aria-label="File extension"
              placeholder="Extension, e.g. .blend"
              value={extension}
              onChange={(e) => setExtension(e.target.value)}
            />
            <select
              aria-label="File session"
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
            >
              <option value="">All sessions</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {date(s.started_at)} · {duration(elapsed(s))}
                </option>
              ))}
            </select>
          </div>
          {files.length ? (
            <div className="file-list panel">
              {files.map((e) => (
                <div key={e.id}>
                  <FileText size={18} />
                  <span>
                    <strong>{fileName(e.metadata.path!)}</strong>
                    <small>{e.metadata.path}</small>
                  </span>
                  <span className="small-badge">{e.event_type.replace('file_', '')}</span>
                  <small>{relative(e.timestamp)}</small>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No matching files">
              Only metadata observed while a session is active appears here.
            </Empty>
          )}
        </>
      )}
      {tab === 'Sessions' && (
        <>
          <SectionTitle
            label={`${sessions.length} sessions`}
            aside={<span className="muted">{duration(total)} total</span>}
          />
          {sessions.length ? (
            <div className="session-list">
              {sessions.map((session) => (
                <article className="session-row" key={session.id}>
                  <Clock3 size={19} />
                  <div>
                    <strong>{date(session.started_at)}</strong>
                    <p>
                      {session.summary ||
                        `${session.status === 'completed' ? 'Completed' : 'Open'} session`}
                    </p>
                  </div>
                  <span className="small-badge">{session.status}</span>
                  <strong>{duration(elapsed(session))}</strong>
                </article>
              ))}
            </div>
          ) : (
            <Empty title="No sessions yet">Enter this context to start a session.</Empty>
          )}
        </>
      )}
      {tab === 'Memory' && (
        <>
          <Notes contextId={context.id} />
          <SectionTitle label="Checkpoint history" />
          {checkpoints.map((cp) => (
            <article className="panel checkpoint-history" key={cp.id}>
              <span className="eyebrow">
                {date(cp.timestamp)} · {duration(cp.duration)}
              </span>
              <p>{cp.summary}</p>
              <div className="next-action">
                <span className="eyebrow">NEXT</span>
                <p>{cp.next_action}</p>
              </div>
            </article>
          ))}
          {!checkpoints.length && (
            <Empty title="No memory yet">Your history builds as you complete sessions.</Empty>
          )}
        </>
      )}
      {tab === 'Settings' && (
        <section className="panel">
          <SectionTitle label="Context settings" />
          <div className="setting-row">
            <div>
              <strong>Identity, folder, and tracking</strong>
              <p>
                {context.tracking_preferences.files
                  ? 'Project file metadata enabled.'
                  : 'File tracking disabled.'}{' '}
                Ignoring {context.tracking_preferences.exclusions.join(', ')}.
              </p>
            </div>
            <button
              className="button secondary"
              disabled={!!current}
              onClick={() => setEditing(true)}
            >
              <Pencil size={14} />
              Edit context
            </button>
          </div>
          {current && (
            <p className="hint">Suspend this context before editing tracking or folder settings.</p>
          )}
          <div className="setting-row">
            <div>
              <strong>{context.archived ? 'Restore context' : 'Archive context'}</strong>
              <p>Keep all history and remove it from your current contexts.</p>
            </div>
            <button
              className="button secondary"
              disabled={pending || !!current}
              onClick={() =>
                void action(
                  () => api.archiveContext(context.id, !context.archived),
                  'Context updated',
                )
              }
            >
              {context.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}{' '}
              {context.archived ? 'Restore' : 'Archive'}
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong className="danger-text">Delete context</strong>
              <p>
                Permanently delete this context’s metadata, sessions, notes, and history. Project
                files remain untouched.
              </p>
            </div>
            <button
              className="button danger"
              disabled={pending || !!current}
              onClick={() => {
                if (
                  window.confirm(
                    `Permanently delete “${context.name}” and all its history? Project files will not be deleted.`,
                  )
                )
                  void action(async () => {
                    await api.deleteContext(context.id);
                    navigate('contexts');
                  }, 'Context deleted');
              }}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </section>
      )}
      {editing && <CreateContext editing={context} onDone={() => setEditing(false)} />}
    </>
  );
}
