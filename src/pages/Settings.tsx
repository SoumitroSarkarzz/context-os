import { Monitor, Sun, Moon, ShieldCheck, HardDrive, Keyboard, Sparkles } from 'lucide-react';
import { useApp } from '../stores/app';
import { api } from '../services/api';
import { SectionTitle } from '../components/ui';
import type { Settings as Preferences } from '../types';
export default function Settings() {
  const { data, action, pending } = useApp();
  const settings = data.settings;
  const update = (change: Partial<Preferences>) =>
    void action(() => api.saveSettings({ ...settings, ...change }));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR DEVICE. YOUR RULES.</span>
          <h1>
            Settings<span className="accent-text">.</span>
          </h1>
          <p>A quieter workspace, on your terms.</p>
        </div>
        <span className="small-badge">V0.1</span>
      </div>
      <div className="settings-layout">
        <section className="panel">
          <SectionTitle label="Appearance" />
          <div className="setting-row">
            <div>
              <strong>Theme</strong>
              <p>Make yourself at home.</p>
            </div>
            <div className="segmented">
              {(
                [
                  { id: 'system', label: 'System', Icon: Monitor },
                  { id: 'dark', label: 'Dark', Icon: Moon },
                  { id: 'light', label: 'Light', Icon: Sun },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  className={settings.theme === id ? 'selected' : ''}
                  disabled={pending}
                  onClick={() => update({ theme: id })}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="setting-row">
            <span>
              <strong>Compact layout</strong>
              <small>Reduce spacing in the workspace.</small>
            </span>
            <input
              type="checkbox"
              checked={settings.compact}
              onChange={(e) => update({ compact: e.target.checked })}
            />
          </label>
          <label className="setting-row">
            <span>
              <strong>Reopen last context view</strong>
              <small>
                Return to the last selected context on launch. Tracking never starts automatically.
              </small>
            </span>
            <input
              type="checkbox"
              checked={settings.reopen_last}
              onChange={(e) => update({ reopen_last: e.target.checked })}
            />
          </label>
        </section>
        <section className="panel">
          <SectionTitle label="Privacy" aside={<ShieldCheck size={18} />} />
          <p className="privacy-intro">
            Local first. No account, cloud, telemetry, or external AI.
          </p>
          <div className="privacy-columns">
            <div>
              <h3>Stored locally</h3>
              {[
                'Context metadata',
                'File paths and event timestamps',
                'Session duration',
                'Notes and checkpoints',
              ].map((t) => (
                <p key={t}>
                  <span className="accent-text">✓</span>
                  {t}
                </p>
              ))}
            </div>
            <div>
              <h3>Never captured</h3>
              {[
                'File contents',
                'Keystrokes and clipboard',
                'Screenshots and passwords',
                'Terminal commands',
              ].map((t) => (
                <p key={t}>
                  <span className="muted">×</span>
                  {t}
                </p>
              ))}
            </div>
          </div>
          <p className="hint">
            File tracking is opt-in per context and only runs during active sessions. Accessibility
            and browser access are not requested in V0.1.
          </p>
        </section>
        <section className="panel">
          <SectionTitle label="Storage" aside={<HardDrive size={18} />} />
          <div className="storage-stats">
            <div>
              <strong>{(data.database_bytes / 1024 / 1024).toFixed(2)} MB</strong>
              <small>Local database + journal</small>
            </div>
            <div>
              <strong>{data.event_count.toLocaleString()}</strong>
              <small>Activity events</small>
            </div>
            <div>
              <strong>{data.checkpoints.length}</strong>
              <small>Checkpoints</small>
            </div>
          </div>
          <p className="hint">
            Database: your operating system’s application data directory. Delete a context in its
            settings to remove its history. Export/import is planned for V1.0.
          </p>
        </section>
        <section className="panel">
          <SectionTitle label="Keyboard" aside={<Keyboard size={18} />} />
          <div className="shortcut-grid">
            {[
              ['Command palette', '⌘ K'],
              ['New context', '⌘ N'],
              ['Toggle sidebar', '⌘ B'],
              ['Search memory', '⌘ ⇧ F'],
              ['Quick capture', '⌘ ⇧ Space'],
            ].map(([label, key]) => (
              <div key={label}>
                <span>{label}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
          <p className="hint">
            Use Ctrl instead of ⌘ on Linux and Windows. Shortcuts operate while Context OS is
            focused.
          </p>
        </section>
        <section className="panel">
          <SectionTitle label="Optional integrations" aside={<Sparkles size={18} />} />
          <div className="setting-row">
            <div>
              <strong>Ollama · planned for V0.3</strong>
              <p>AI is not connected in this release. Checkpoints and search work without it.</p>
            </div>
            <span className="small-badge">NOT IMPLEMENTED</span>
          </div>
          <p className="hint">
            Application tracking, Git activity, menu bar integration, launch rules, and snapshots
            are planned for V0.2. Browser/window/terminal metadata are planned for V0.4.
          </p>
        </section>
      </div>
    </>
  );
}
