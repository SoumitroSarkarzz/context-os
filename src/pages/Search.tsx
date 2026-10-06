import { useEffect, useRef, useState } from 'react';
import { Search as SearchIcon, ArrowUpRight } from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../stores/app';
import type { SearchResult } from '../types';
import { Empty } from '../components/ui';
import { date } from '../utils/format';
export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  const { data, navigate } = useApp();
  useEffect(() => {
    const current = ++sequence.current;
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      void api
        .search(query)
        .then((rows) => {
          if (current === sequence.current) {
            setResults(rows);
            setError('');
          }
        })
        .catch((e) => {
          if (current === sequence.current) setError(String(e));
        })
        .finally(() => {
          if (current === sequence.current) setLoading(false);
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">FIND A THREAD</span>
          <h1>
            Search<span className="accent-text">.</span>
          </h1>
          <p>Your contexts, sessions, files, notes, and checkpoints.</p>
        </div>
        <span className="small-badge">LOCAL · FTS5</span>
      </div>
      <div className="global-search">
        <SearchIcon size={22} />
        <input
          autoFocus
          aria-label="Search memory"
          placeholder="A project, a file, a word you remember…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <kbd>⌘ ⇧ F</kbd>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading ? (
        <p className="muted">Searching local memory…</p>
      ) : results.length ? (
        <>
          <p className="search-count">{results.length} matches</p>
          <div className="search-results">
            {results.map((result) => (
              <button
                className="search-result"
                key={result.id}
                onClick={() => navigate('detail', result.context_id)}
              >
                <div>
                  <span className="small-badge">{result.kind}</span>
                  <span className="muted">
                    {data.contexts.find((c) => c.id === result.context_id)?.name} ·{' '}
                    {date(result.timestamp)}
                  </span>
                </div>
                <h3>{result.title}</h3>
                <p>{result.excerpt}</p>
                <ArrowUpRight size={18} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <Empty
          icon={<SearchIcon size={28} />}
          title={query ? 'No matches' : 'What do you remember?'}
        >
          {query
            ? 'Try a file name, context name, or a phrase from your notes.'
            : 'Search is local and deterministic. Natural language interpretation is planned for a future release.'}
        </Empty>
      )}
    </>
  );
}
