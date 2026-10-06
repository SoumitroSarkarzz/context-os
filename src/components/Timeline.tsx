import { useState } from 'react';
import { FileText, GitCommitHorizontal, Play, ChevronDown, StickyNote } from 'lucide-react';
import type { ActivityEvent } from '../types';
import { useApp } from '../stores/app';
import { date, eventLabel, time } from '../utils/format';
import { Empty } from './ui';
interface Group {
  events: ActivityEvent[];
  day: string;
}
function groupEvents(events: ActivityEvent[]) {
  const groups: Group[] = [];
  for (const event of events) {
    const day = date(event.timestamp);
    const previous = groups.at(-1);
    if (
      previous &&
      previous.day === day &&
      event.event_type.startsWith('file_') &&
      previous.events[0].event_type === event.event_type &&
      previous.events[0].context_id === event.context_id &&
      previous.events[0].timestamp - event.timestamp < 120000
    )
      previous.events.push(event);
    else groups.push({ events: [event], day });
  }
  return groups;
}
export default function Timeline({ contextId }: { contextId?: string }) {
  const { data, navigate } = useApp();
  const [type, setType] = useState('all');
  const [day, setDay] = useState('');
  const [filterContext, setFilterContext] = useState('');
  const events = data.events.filter(
    (e) =>
      (!contextId || e.context_id === contextId) &&
      (!filterContext || e.context_id === filterContext) &&
      (type === 'all' || e.event_type.startsWith(type)) &&
      (!day || new Date(e.timestamp).toLocaleDateString('en-CA') === day),
  );
  const groups = groupEvents(events);
  return (
    <>
      <div className="filter-bar">
        <select aria-label="Event type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All activity</option>
          <option value="file_">File changes</option>
          <option value="session_">Sessions</option>
          <option value="note_">Notes</option>
          <option value="checkpoint_">Checkpoints</option>
        </select>
        {!contextId && (
          <select
            aria-label="Context filter"
            value={filterContext}
            onChange={(e) => setFilterContext(e.target.value)}
          >
            <option value="">All contexts</option>
            {data.contexts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="date"
          aria-label="Activity date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        {day && (
          <button className="text-button" onClick={() => setDay('')}>
            Clear date
          </button>
        )}
        <span className="muted">{events.length} events</span>
      </div>
      {groups.length ? (
        <div className="timeline">
          {groups.map((group, i) => (
            <div key={group.events[0].id}>
              {(i === 0 || groups[i - 1].day !== group.day) && (
                <h3 className="timeline-date">{group.day}</h3>
              )}
              <TimelineGroup
                group={group}
                contextName={
                  !contextId
                    ? data.contexts.find((c) => c.id === group.events[0].context_id)?.name
                    : undefined
                }
                onContext={() => navigate('detail', group.events[0].context_id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No activity yet">
          Start a session to remember what changes. File tracking must be enabled for file events.
        </Empty>
      )}
      <p className="hint">
        Showing the most recent 1,000 events. Global search includes the full history.
      </p>
    </>
  );
}
function TimelineGroup({
  group,
  contextName,
  onContext,
}: {
  group: Group;
  contextName?: string;
  onContext: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const event = group.events[0];
  const Icon = event.event_type.startsWith('file_')
    ? FileText
    : event.event_type.startsWith('session_')
      ? Play
      : event.event_type.startsWith('note_')
        ? StickyNote
        : GitCommitHorizontal;
  return (
    <div className="timeline-row">
      <time>{time(event.timestamp)}</time>
      <span className="timeline-icon">
        <Icon size={15} />
      </span>
      <div className="timeline-content">
        <strong>
          {group.events.length > 1
            ? `${group.events.length} files ${event.event_type.replace('file_', '')}`
            : eventLabel(event)}
        </strong>
        {contextName && (
          <button className="text-button" onClick={onContext}>
            {contextName}
          </button>
        )}
        {event.metadata.path && group.events.length === 1 && <small>{event.metadata.path}</small>}
        {event.metadata.reason && <small>{event.metadata.reason}</small>}
        {expanded && (
          <div className="event-details">
            {group.events.map((e) => (
              <p key={e.id}>{e.metadata.path}</p>
            ))}
          </div>
        )}
      </div>
      {group.events.length > 1 && (
        <button
          className="icon-button"
          aria-label={expanded ? 'Collapse events' : 'Expand events'}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDown size={16} style={{ transform: expanded ? 'rotate(180deg)' : undefined }} />
        </button>
      )}
    </div>
  );
}
