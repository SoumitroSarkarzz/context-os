import { invoke, isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type {
  AppData,
  Checkpoint,
  Context,
  ContextInput,
  Note,
  ResumeResult,
  SearchResult,
  Session,
  Settings,
} from '../types';
export const desktopAvailable = () => isTauri();
async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!desktopAvailable())
    throw new Error(
      'The desktop engine is unavailable here. Launch Context OS with npm run tauri dev to use local tracking and storage.',
    );
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw new Error(String(error));
  }
}
export const api = {
  state: () => call<AppData>('get_state'),
  createContext: (input: ContextInput) => call<Context>('create_context', { input }),
  updateContext: (id: string, input: ContextInput) =>
    call<Context>('update_context', { id, input }),
  archiveContext: (id: string, archived: boolean) =>
    call<void>('archive_context', { id, archived }),
  deleteContext: (id: string) => call<void>('delete_context', { id }),
  startSession: (contextId: string) => call<Session>('start_session', { contextId }),
  pauseSession: (id: string) => call<Session>('pause_session', { id }),
  continueSession: (id: string) => call<Session>('continue_session', { id }),
  suspendSession: (id: string) => call<Checkpoint>('suspend_session', { id }),
  resumeContext: (id: string) => call<ResumeResult>('resume_context', { id }),
  saveNote: (contextId: string, id: string | null, body: string, pinned: boolean) =>
    call<Note>('save_note', { contextId, id, body, pinned }),
  deleteNote: (id: string) => call<void>('delete_note', { id }),
  saveSettings: (settings: Settings) => call<void>('save_settings', { settings }),
  search: (query: string) => call<SearchResult[]>('search_memory', { query }),
  openFolder: (id: string) => call<void>('open_project_folder', { id }),
  trackingError: () => call<string | null>('get_tracking_error'),
  chooseFolder: async () => {
    if (!desktopAvailable()) throw new Error('Folder selection requires the desktop app.');
    return await open({ directory: true, multiple: false, title: 'Choose a project folder' });
  },
};
