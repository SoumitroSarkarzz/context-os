import { useCallback, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, FolderOpen } from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../stores/app';
import type { Context, ContextInput } from '../types';
import { ContextIcon, iconOptions, Modal } from './ui';
const exclusions = ['.git', 'node_modules', 'target', 'dist', 'build', '.cache', '.DS_Store'];
const initial: ContextInput = {
  name: '',
  description: '',
  icon: 'layers',
  accent: '#b8ee80',
  project_folder: '',
  tracking_preferences: { files: false, exclusions },
};
const colors = ['#b8ee80', '#89b8f8', '#d0a5f7', '#eab787', '#80d9ca'];
export default function CreateContext({
  editing,
  onDone,
}: {
  editing?: Context;
  onDone?: () => void;
}) {
  const [input, setInput] = useState<ContextInput>(editing ? { ...editing } : initial);
  const [step, setStep] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const { action, pending, navigate, error } = useApp();
  const close = useCallback(() => {
    useApp.setState({ createOpen: false });
    onDone?.();
  }, [onDone]);
  const set = (key: keyof ContextInput, value: ContextInput[typeof key]) =>
    setInput((prev) => ({ ...prev, [key]: value }));
  const choose = async () => {
    try {
      const path = await api.chooseFolder();
      if (typeof path === 'string') set('project_folder', path);
    } catch (e) {
      setLocalError(String(e));
    }
  };
  const valid =
    step === 0
      ? !!input.name.trim() && input.name.trim().length <= 100
      : step === 1
        ? !!input.project_folder
        : true;
  const save = async () => {
    const context = await action(
      () => (editing ? api.updateContext(editing.id, input) : api.createContext(input)),
      editing ? 'Context updated' : 'Context created',
    );
    if (context) {
      close();
      navigate('detail', context.id);
    }
  };
  return (
    <Modal title={editing ? 'Edit context' : 'Create a context'} onClose={close}>
      <div className="wizard-progress">
        {['Identity', 'Workspace', 'Privacy', 'Personalize'].map((label, i) => (
          <span key={label} className={i === step ? 'current' : i < step ? 'done' : ''}>
            <span>{i < step ? <Check size={11} /> : i + 1}</span>
            {label}
          </span>
        ))}
      </div>
      <div className="wizard-body">
        {step === 0 && (
          <>
            <span className="eyebrow">01 / A PLACE FOR YOUR WORK</span>
            <h3>What are you working on?</h3>
            <p>Give this context a name you’ll recognize when you return.</p>
            <label>
              Name
              <input
                autoFocus
                maxLength={100}
                placeholder="e.g. Blender — Gundam"
                value={input.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </label>
            <label>
              Description <span className="muted">optional</span>
              <textarea
                maxLength={4000}
                rows={3}
                placeholder="The goal, the idea, or a little context…"
                value={input.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </label>
          </>
        )}
        {step === 1 && (
          <>
            <span className="eyebrow">02 / YOUR WORKSPACE</span>
            <h3>Where does this work live?</h3>
            <p>Select a project folder. Context OS never copies its contents.</p>
            <button className="folder-picker" onClick={() => void choose()}>
              <FolderOpen size={27} />
              <strong>
                {input.project_folder ? 'Change project folder' : 'Choose project folder'}
              </strong>
              <span>{input.project_folder || 'Opens your system folder picker'}</span>
            </button>
            <p className="hint">Use a dedicated project directory, rather than your home folder.</p>
          </>
        )}
        {step === 2 && (
          <>
            <span className="eyebrow">03 / EXPLICIT BY DESIGN</span>
            <h3>You choose what is remembered.</h3>
            <p>Tracking runs only during an active session. All data stays on this device.</p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={input.tracking_preferences.files}
                onChange={(e) =>
                  set('tracking_preferences', {
                    ...input.tracking_preferences,
                    files: e.target.checked,
                  })
                }
              />
              <span>
                <strong>Project file changes</strong>
                <small>Names, paths, sizes, and timestamps. Never file contents.</small>
              </span>
            </label>
            <div className="permission-row">
              <Check size={16} />
              <span>
                <strong>Session duration</strong>
                <small>Recorded when you start a session; pauses are excluded.</small>
              </span>
            </div>
            <label>
              Ignore file or folder names
              <textarea
                rows={2}
                value={input.tracking_preferences.exclusions.join(', ')}
                onChange={(e) =>
                  set('tracking_preferences', {
                    ...input.tracking_preferences,
                    exclusions: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <p className="hint">
              Applications, browser pages, window titles, terminal directories, and AI summaries are
              planned for later releases and are not tracked.
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <span className="eyebrow">04 / MAKE IT YOURS</span>
            <h3>A familiar face for your context.</h3>
            <p>A subtle visual cue makes returning easier.</p>
            <label>Icon</label>
            <div className="swatches">
              {iconOptions.map((icon) => (
                <button
                  aria-label={`${icon} icon`}
                  className={input.icon === icon ? 'selected' : ''}
                  key={icon}
                  onClick={() => set('icon', icon)}
                >
                  <ContextIcon icon={icon} />
                </button>
              ))}
            </div>
            <label>Accent</label>
            <div className="swatches colors">
              {colors.map((color) => (
                <button
                  aria-label={`${color} accent`}
                  className={input.accent === color ? 'selected' : ''}
                  key={color}
                  style={{ background: color }}
                  onClick={() => set('accent', color)}
                >
                  {input.accent === color && <Check size={15} />}
                </button>
              ))}
            </div>
            <div className="context-preview">
              <span style={{ color: input.accent }}>
                <ContextIcon icon={input.icon} size={28} />
              </span>
              <div>
                <strong>{input.name}</strong>
                <small>
                  {input.tracking_preferences.files
                    ? 'File metadata + session duration'
                    : 'Session duration only'}
                </small>
              </div>
            </div>
          </>
        )}
        {(localError || error) && (
          <p className="form-error" role="alert">
            {localError || error}
          </p>
        )}
      </div>
      <div className="modal-footer">
        <button className="button ghost" onClick={() => (step ? setStep(step - 1) : close())}>
          <ChevronLeft size={15} />
          {step ? 'Back' : 'Cancel'}
        </button>
        <button
          className="button primary"
          disabled={!valid || pending}
          onClick={() => (step < 3 ? setStep(step + 1) : void save())}
        >
          {step < 3 ? 'Continue' : editing ? 'Save changes' : 'Create context'}
          <ChevronRight size={15} />
        </button>
      </div>
    </Modal>
  );
}
