import { useState } from 'react';
import { Plus, Search, Layers } from 'lucide-react';
import { useApp } from '../stores/app';
import { ContextCard, Empty } from '../components/ui';
export default function Contexts() {
  const { data } = useApp();
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const contexts = data.contexts.filter(
    (c) =>
      c.archived === archived &&
      `${c.name} ${c.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A PLACE FOR EVERY THREAD</span>
          <h1>
            Contexts<span className="accent-text">.</span>
          </h1>
          <p>Enter, work, suspend, return.</p>
        </div>
        <button className="button primary" onClick={() => useApp.setState({ createOpen: true })}>
          <Plus size={15} />
          New context
        </button>
      </div>
      <div className="filter-bar">
        <div className="input-icon">
          <Search size={16} />
          <input
            aria-label="Filter contexts"
            placeholder="Find a context…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="segmented">
          <button className={!archived ? 'selected' : ''} onClick={() => setArchived(false)}>
            Current
          </button>
          <button className={archived ? 'selected' : ''} onClick={() => setArchived(true)}>
            Archived
          </button>
        </div>
        <span className="muted">{contexts.length} contexts</span>
      </div>
      {contexts.length ? (
        <div className="context-grid">
          {contexts.map((context) => (
            <ContextCard key={context.id} context={context} />
          ))}
        </div>
      ) : (
        <Empty
          icon={<Layers size={28} />}
          title={archived ? 'No archived contexts' : 'No contexts yet'}
          action={
            !archived && (
              <button
                className="button primary"
                onClick={() => useApp.setState({ createOpen: true })}
              >
                Create context
              </button>
            )
          }
        >
          {query
            ? 'No contexts match your search.'
            : 'Create a context for something you’re working on. Context OS will remember where you leave it.'}
        </Empty>
      )}
    </>
  );
}
