import { useCallback, useState } from 'react';
import { useApp } from '../stores/app';
import { api } from '../services/api';
import { Modal } from './ui';
export default function QuickCapture() {
  const { data, selectedId, action, pending } = useApp();
  const current = data.sessions.find((s) => s.status !== 'completed');
  const [contextId, setContextId] = useState(
    current?.context_id ?? selectedId ?? data.contexts.find((c) => !c.archived)?.id ?? '',
  );
  const [body, setBody] = useState('');
  const close = useCallback(() => useApp.setState({ captureOpen: false }), []);
  return (
    <Modal title="Quick capture" onClose={close}>
      <div className="wizard-body">
        <label>
          A thread for later
          <textarea
            autoFocus
            rows={5}
            value={body}
            placeholder="What should you remember?"
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <label>
          Save to
          <select value={contextId} onChange={(e) => setContextId(e.target.value)}>
            <option value="" disabled>
              Choose a context
            </option>
            {data.contexts
              .filter((c) => !c.archived)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        {!data.contexts.length && <p className="hint">Create a context before capturing a note.</p>}
      </div>
      <div className="modal-footer">
        <button className="button ghost" onClick={close}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={pending || !contextId || !body.trim()}
          onClick={() =>
            void action(async () => {
              const note = await api.saveNote(contextId, null, body, true);
              close();
              return note;
            }, 'Note captured')
          }
        >
          Save note
        </button>
      </div>
    </Modal>
  );
}
