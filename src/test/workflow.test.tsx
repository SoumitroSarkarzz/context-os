import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../services/api';
import { emptyData, useApp } from '../stores/app';
import type { Context, Session } from '../types';
import App from '../app/App';
import CreateContext from '../components/CreateContext';
import SessionControls from '../components/SessionControls';
import Search from '../pages/Search';
import Settings from '../pages/Settings';
import Notes from '../components/Notes';
vi.mock('../services/api', () => ({
  desktopAvailable: () => true,
  api: {
    state: vi.fn(),
    trackingError: vi.fn(),
    chooseFolder: vi.fn(),
    createContext: vi.fn(),
    updateContext: vi.fn(),
    resumeContext: vi.fn(),
    pauseSession: vi.fn(),
    continueSession: vi.fn(),
    suspendSession: vi.fn(),
    search: vi.fn(),
    saveSettings: vi.fn(),
    saveNote: vi.fn(),
    deleteNote: vi.fn(),
  },
}));
const context: Context = {
  id: 'ctx',
  name: 'Gundam',
  description: 'Chest materials',
  icon: 'box',
  accent: '#b8ee80',
  project_folder: '/Projects/Gundam',
  tracking_preferences: { files: false, exclusions: ['.git'] },
  status: 'inactive',
  archived: false,
  created_at: Date.now(),
  updated_at: Date.now(),
  last_active_at: null,
};
const session: Session = {
  id: 'session',
  context_id: 'ctx',
  started_at: Date.now(),
  ended_at: null,
  paused_duration: 0,
  total_duration: 0,
  status: 'active',
  paused_at: null,
  last_seen_at: Date.now(),
  summary: '',
};
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
  useApp.setState({
    data: structuredClone(emptyData),
    loaded: true,
    pending: false,
    error: null,
    loadError: null,
    trackingError: null,
    toast: null,
    page: 'home',
    selectedId: null,
    createOpen: false,
    paletteOpen: false,
    captureOpen: false,
    sidebarCollapsed: false,
  });
  vi.mocked(api.state).mockImplementation(async () => useApp.getState().data);
  vi.mocked(api.trackingError).mockResolvedValue(null);
});
describe('Context OS workflows', () => {
  it('renders the actual empty dashboard and navigates from the sidebar', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText('Your work has a place.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Contexts' }));
    expect(screen.getByText('No contexts yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByText('Never captured')).toBeInTheDocument();
  });
  it('creates a context through all wizard steps with explicit tracking consent', async () => {
    const user = userEvent.setup();
    vi.mocked(api.chooseFolder).mockResolvedValue('/Projects/Gundam');
    vi.mocked(api.createContext).mockResolvedValue(context);
    render(<CreateContext />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await user.type(screen.getByLabelText('Name'), 'Gundam');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: /Choose project folder/ }));
    await screen.findByText('/Projects/Gundam');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const files = screen.getByRole('checkbox', { name: /Project file changes/ });
    expect(files).not.toBeChecked();
    await user.click(files);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Create context' }));
    await waitFor(() =>
      expect(api.createContext).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Gundam',
          project_folder: '/Projects/Gundam',
          tracking_preferences: expect.objectContaining({ files: true }),
        }),
      ),
    );
    expect(useApp.getState().selectedId).toBe('ctx');
  });
  it('pauses, continues, and suspends the current session through native contracts', async () => {
    const user = userEvent.setup();
    useApp.setState({ data: { ...emptyData, contexts: [context], sessions: [session] } });
    vi.mocked(api.pauseSession).mockImplementation(async () => {
      const paused = { ...session, status: 'paused' as const, paused_at: Date.now() };
      useApp.setState({ data: { ...emptyData, contexts: [context], sessions: [paused] } });
      return paused;
    });
    vi.mocked(api.continueSession).mockImplementation(async () => {
      useApp.setState({ data: { ...emptyData, contexts: [context], sessions: [session] } });
      return session;
    });
    render(<SessionControls context={context} />);
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await screen.findByRole('button', { name: 'Continue session' });
    await user.click(screen.getByRole('button', { name: 'Continue session' }));
    await screen.findByRole('button', { name: 'Pause' });
    await user.click(screen.getByRole('button', { name: 'Suspend context' }));
    await waitFor(() => expect(api.suspendSession).toHaveBeenCalledWith('session'));
    expect(api.pauseSession).toHaveBeenCalledWith('session');
    expect(api.continueSession).toHaveBeenCalledWith('session');
  });
  it('shows resume errors instead of pretending restoration succeeded', async () => {
    const user = userEvent.setup();
    vi.mocked(api.resumeContext).mockRejectedValue(new Error('Project folder is unavailable.'));
    render(<SessionControls context={context} />);
    await user.click(screen.getByRole('button', { name: 'Enter context' }));
    await waitFor(() => expect(useApp.getState().error).toContain('Project folder is unavailable'));
  });
  it('searches the native FTS service and opens the result context', async () => {
    const user = userEvent.setup();
    useApp.setState({ data: { ...emptyData, contexts: [context] } });
    vi.mocked(api.search).mockResolvedValue([
      {
        id: 'note',
        context_id: 'ctx',
        kind: 'note',
        title: 'Project note',
        excerpt: 'Fix UV seam',
        timestamp: Date.now(),
      },
    ]);
    render(<Search />);
    await user.type(screen.getByRole('textbox', { name: 'Search memory' }), 'UV seam');
    await screen.findByText('Fix UV seam');
    await user.click(screen.getByRole('button', { name: /Project note/ }));
    expect(useApp.getState().page).toBe('detail');
    expect(useApp.getState().selectedId).toBe('ctx');
  });
  it('persists a theme change through the backend', async () => {
    const user = userEvent.setup();
    render(<Settings />);
    await user.click(screen.getByRole('button', { name: 'Light' }));
    await waitFor(() =>
      expect(api.saveSettings).toHaveBeenCalledWith({ ...emptyData.settings, theme: 'light' }),
    );
  });
  it('opens command palette and quick capture using keyboard shortcuts', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.keyboard('{Control>}{Shift>}[Space]{/Shift}{/Control}');
    expect(await screen.findByRole('dialog', { name: 'Quick capture' })).toBeInTheDocument();
  });
  it('autosaves Markdown notes and previews without fetching remote resources', async () => {
    const user = userEvent.setup();
    const note = {
      id: 'note',
      context_id: 'ctx',
      session_id: null,
      body: '## Next\nCorrect the UV seam.',
      pinned: false,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    useApp.setState({ data: { ...emptyData, contexts: [context], notes: [note] } });
    vi.mocked(api.saveNote).mockResolvedValue(note);
    render(<Notes contextId="ctx" />);
    const editor = screen.getByRole('textbox', { name: 'Project note' });
    await user.clear(editor);
    await user.type(editor, '## Next\nFix shoulder material.');
    await waitFor(
      () =>
        expect(api.saveNote).toHaveBeenCalledWith(
          'ctx',
          'note',
          '## Next\nFix shoulder material.',
          false,
        ),
      { timeout: 2000 },
    );
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByRole('heading', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByText('Fix shoulder material.')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
  it('keeps an action failure visible when periodic status refresh succeeds', async () => {
    useApp.setState({ error: 'Project folder is unavailable.' });
    await useApp.getState().refresh();
    expect(useApp.getState().error).toBe('Project folder is unavailable.');
  });
});

describe('Note write ordering', () => {
  it('persists a newer draft typed while the previous save is still pending', async () => {
    const user = userEvent.setup();
    const note = {
      id: 'slow-note',
      context_id: 'ctx',
      session_id: null,
      body: 'first',
      pinned: false,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    useApp.setState({ data: { ...emptyData, contexts: [context], notes: [note] } });
    let release: (() => void) | undefined;
    vi.mocked(api.saveNote)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve(note);
          }),
      )
      .mockResolvedValue(note);
    render(<Notes contextId="ctx" />);
    const editor = screen.getByRole('textbox', { name: 'Project note' });
    await user.clear(editor);
    await user.type(editor, 'second');
    await waitFor(
      () => expect(api.saveNote).toHaveBeenCalledWith('ctx', 'slow-note', 'second', false),
      { timeout: 2000 },
    );
    await user.clear(editor);
    await user.type(editor, 'third');
    release?.();
    await waitFor(() =>
      expect(api.saveNote).toHaveBeenLastCalledWith('ctx', 'slow-note', 'third', false),
    );
  });
});
