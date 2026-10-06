import { useEffect, useRef, useState } from 'react';
import { Plus, Pin, Trash2, Check } from 'lucide-react';
import Markdown from 'react-markdown';
import { api } from '../services/api';
import { useApp } from '../stores/app';
import type { Note } from '../types';
import { relative } from '../utils/format';
import { Empty } from './ui';

export default function Notes({ contextId }: { contextId: string }) {
  const { data, action, pending } = useApp();
  const notes = data.notes.filter((n) => n.context_id === contextId);
  const [creating, setCreating] = useState(false);
  const [body, setBody] = useState('');
  return (
    <div>
      <div className="section-title">
        <h2>Project notes</h2>
        <button className="button secondary" onClick={() => setCreating(true)}>
          <Plus size={14} />
          New note
        </button>
      </div>
      {creating && (
        <div className="note-editor">
          <label>
            New note
            <textarea
              rows={5}
              placeholder="What should you remember? Markdown is welcome."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <div className="button-group">
            <button
              className="button primary"
              disabled={pending || !body.trim()}
              onClick={() =>
                void action(async () => {
                  const note = await api.saveNote(contextId, null, body, false);
                  setBody('');
                  setCreating(false);
                  return note;
                }, 'Note saved')
              }
            >
              Save note
            </button>
            <button className="button ghost" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {notes.map((note) => (
        <NoteEditor key={note.id} note={note} />
      ))}
      {!notes.length && !creating && (
        <Empty title="Leave a thread to pick up">
          Write what’s done, what remains, or where to continue. Your notes inform the next
          checkpoint.
        </Empty>
      )}
    </div>
  );
}

function NoteEditor({ note }: { note: Note }) {
  const [draft, setDraft] = useState(note.body);
  const [status, setStatus] = useState('Saved');
  const [pinned, setPinned] = useState(note.pinned);
  const [preview, setPreview] = useState(false);
  const latest = useRef({ draft, pinned });
  const saved = useRef({ body: note.body, pinned: note.pinned });
  const saving = useRef<Promise<void> | null>(null);
  const deleting = useRef(false);
  latest.current = { draft, pinned };

  // Drain edits serially: typing during a slow write cannot lose a newer draft.
  const save = (): Promise<void> => {
    if (saving.current) return saving.current;
    const run = async () => {
      let changed = false;
      while (!deleting.current) {
        const value = { ...latest.current };
        if (
          !value.draft.trim() ||
          (value.draft === saved.current.body && value.pinned === saved.current.pinned)
        )
          break;
        setStatus('Saving…');
        try {
          await api.saveNote(note.context_id, note.id, value.draft, value.pinned);
          saved.current = { body: value.draft, pinned: value.pinned };
          changed = true;
        } catch (error) {
          setStatus('Not saved');
          useApp.setState({ error: String(error) });
          return;
        }
      }
      setStatus('Saved');
      if (changed) await useApp.getState().refresh();
    };
    saving.current = run().finally(() => {
      saving.current = null;
    });
    return saving.current;
  };
  useEffect(() => {
    if (draft === saved.current.body && pinned === saved.current.pinned) return;
    setStatus(draft.trim() ? 'Unsaved' : 'Empty · not saved');
    const timer = setTimeout(() => void save(), 800);
    return () => clearTimeout(timer);
  }, [draft, pinned]);
  useEffect(
    () => () => {
      void save();
    },
    [],
  );

  const remove = async () => {
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    deleting.current = true;
    await saving.current;
    try {
      await api.deleteNote(note.id);
      await useApp.getState().refresh();
    } catch (error) {
      deleting.current = false;
      useApp.setState({ error: String(error) });
    }
  };
  return (
    <article className="note-editor">
      <div className="note-header">
        <span>
          <Check size={12} />
          {status}
          <span className="muted"> · {relative(note.updated_at)}</span>
        </span>
        <div className="button-group">
          <button className="text-button" onClick={() => setPreview(!preview)}>
            {preview ? 'Edit' : 'Preview'}
          </button>
          <button
            className={`icon-button ${pinned ? 'accent-text' : ''}`}
            aria-label={pinned ? 'Unpin note' : 'Pin note'}
            onClick={() => setPinned(!pinned)}
          >
            <Pin size={15} />
          </button>
          <button className="icon-button" aria-label="Delete note" onClick={() => void remove()}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {preview ? (
        <div className="markdown-note">
          <Markdown
            skipHtml
            components={{
              // Remote images and external navigation are never fetched from note markup.
              img: ({ alt }) => <span className="muted">[Image: {alt || 'not loaded'}]</span>,
              a: ({ children }) => <span className="note-link">{children}</span>,
            }}
          >
            {draft}
          </Markdown>
        </div>
      ) : (
        <textarea
          aria-label="Project note"
          value={draft}
          rows={Math.max(3, Math.min(12, draft.split('\n').length + 1))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void save()}
        />
      )}
      <small className="muted">Markdown · Autosaved locally · Images stay unloaded</small>
    </article>
  );
}
