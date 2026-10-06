import { ArrowUpRight, Search, BookOpen } from 'lucide-react';
import { useApp } from '../stores/app';
import { date, duration } from '../utils/format';
import { Empty, SectionTitle } from '../components/ui';
export default function Memory() {
  const { data, navigate } = useApp();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE THREADS YOU LEFT BEHIND</span>
          <h1>
            Memory<span className="accent-text">.</span>
          </h1>
          <p>What happened, where you stopped, and what comes next.</p>
        </div>
        <button className="button secondary" onClick={() => navigate('search')}>
          <Search size={15} />
          Search memory
        </button>
      </div>
      <SectionTitle
        label="Saved checkpoints"
        aside={<span className="muted">{data.checkpoints.length} checkpoints</span>}
      />
      {data.checkpoints.length ? (
        <div className="memory-grid">
          {data.checkpoints.map((cp) => (
            <button
              className="checkpoint-preview"
              key={cp.id}
              onClick={() => navigate('detail', cp.context_id)}
            >
              <span className="eyebrow">
                {date(cp.timestamp)} · {duration(cp.duration)}
              </span>
              <h3>{data.contexts.find((c) => c.id === cp.context_id)?.name}</h3>
              <p>{cp.summary}</p>
              <div className="next-action">
                <span className="eyebrow">NEXT ACTION</span>
                <p>{cp.next_action}</p>
              </div>
              <span className="text-button">
                Open context
                <ArrowUpRight size={14} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Empty icon={<BookOpen size={28} />} title="No memory yet">
          Your project history will appear after completing your first work session. Everything
          stays on this device.
        </Empty>
      )}
    </>
  );
}
