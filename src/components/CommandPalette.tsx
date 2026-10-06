import { useCallback, useState } from 'react';
import { ArrowUpRight, Search, Plus, Settings, Pause, Square, Play } from 'lucide-react';
import { useApp } from '../stores/app';
import { api } from '../services/api';
import { ContextIcon, Modal } from './ui';
export default function CommandPalette() {
  const { data, navigate, action, pending } = useApp();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const close = useCallback(() => useApp.setState({ paletteOpen: false }), []);
  const current = data.sessions.find((s) => s.status !== 'completed');
  const commands = [
    ...data.contexts
      .filter((c) => !c.archived)
      .map((c) => ({
        id: c.id,
        label: `Open ${c.name}`,
        Icon: () => <ContextIcon icon={c.icon} size={17} />,
        run: () => navigate('detail', c.id),
      })),
    {
      id: 'create',
      label: 'Create context',
      Icon: () => <Plus size={17} />,
      run: () => useApp.setState({ createOpen: true, paletteOpen: false }),
    },
    {
      id: 'search',
      label: 'Search memory',
      Icon: () => <Search size={17} />,
      run: () => navigate('search'),
    },
    {
      id: 'settings',
      label: 'Open settings',
      Icon: () => <Settings size={17} />,
      run: () => navigate('settings'),
    },
    ...(current
      ? [
          {
            id: 'pause',
            label: current.status === 'active' ? 'Pause session' : 'Continue session',
            Icon: () => (current.status === 'active' ? <Pause size={17} /> : <Play size={17} />),
            run: () => {
              close();
              void action(() =>
                current.status === 'active'
                  ? api.pauseSession(current.id)
                  : api.continueSession(current.id),
              );
            },
          },
          {
            id: 'suspend',
            label: 'Suspend current context',
            Icon: () => <Square size={16} />,
            run: () => {
              close();
              void action(() => api.suspendSession(current.id), 'Checkpoint saved');
            },
          },
        ]
      : []),
  ].filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <Modal title="Command palette" onClose={close}>
      <div className="palette-search">
        <Search size={19} />
        <input
          autoFocus
          aria-label="Command search"
          placeholder="What do you want to do?"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelected((s) => Math.min(s + 1, commands.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelected((s) => Math.max(0, s - 1));
            }
            if (e.key === 'Enter' && !pending) {
              e.preventDefault();
              commands[selected]?.run();
            }
          }}
        />
        <kbd>ESC</kbd>
      </div>
      <div className="palette-commands">
        {commands.map((command, i) => (
          <button
            disabled={pending}
            key={command.id}
            className={i === selected ? 'selected' : ''}
            onClick={command.run}
          >
            <command.Icon />
            <span>{command.label}</span>
            <ArrowUpRight size={14} />
          </button>
        ))}
        {!commands.length && <p className="muted">No matching commands.</p>}
      </div>
      <div className="palette-footer">
        <span>↑ ↓ to navigate</span>
        <span>↵ to open</span>
      </div>
    </Modal>
  );
}
