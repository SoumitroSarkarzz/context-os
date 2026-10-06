import { Pause, Play, Square, ArrowUpRight } from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../stores/app';
import type { Context } from '../types';
export default function SessionControls({ context }: { context: Context }) {
  const { data, action, pending, notify } = useApp();
  const open = data.sessions.find((s) => s.status !== 'completed');
  const current = open?.context_id === context.id ? open : null;
  if (context.archived)
    return (
      <button
        className="button secondary"
        disabled={pending}
        onClick={() => void action(() => api.archiveContext(context.id, false), 'Context restored')}
      >
        Restore context
      </button>
    );
  if (current)
    return (
      <div className="button-group">
        <button
          className="button secondary"
          disabled={pending}
          onClick={() =>
            void action(() =>
              current.status === 'active'
                ? api.pauseSession(current.id)
                : api.continueSession(current.id),
            )
          }
        >
          {current.status === 'active' ? <Pause size={15} /> : <Play size={15} />}{' '}
          {current.status === 'active' ? 'Pause' : 'Continue session'}
        </button>
        <button
          className="button primary"
          disabled={pending}
          onClick={() =>
            void action(
              () => api.suspendSession(current.id),
              'Checkpoint saved. Context suspended.',
            )
          }
        >
          <Square size={13} />
          Suspend context
        </button>
      </div>
    );
  return (
    <button
      className="button primary"
      disabled={pending || !!open}
      title={open ? 'Suspend the current context first' : undefined}
      onClick={() =>
        void action(async () => {
          const result = await api.resumeContext(context.id);
          if (result.warning) notify(result.warning);
          return result;
        })
      }
    >
      {context.last_active_at ? <ArrowUpRight size={17} /> : <Play size={16} />}{' '}
      {context.last_active_at ? 'Resume context' : 'Enter context'}
    </button>
  );
}
