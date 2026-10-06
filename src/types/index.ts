export interface TrackingPreferences {
  files: boolean;
  exclusions: string[];
}
export interface ContextInput {
  name: string;
  description: string;
  icon: string;
  accent: string;
  project_folder: string;
  tracking_preferences: TrackingPreferences;
}
export interface Context extends ContextInput {
  id: string;
  status: 'active' | 'suspended' | 'inactive' | 'archived';
  created_at: number;
  updated_at: number;
  last_active_at: number | null;
  archived: boolean;
}
export interface Session {
  id: string;
  context_id: string;
  started_at: number;
  ended_at: number | null;
  paused_duration: number;
  total_duration: number;
  status: 'active' | 'paused' | 'completed';
  paused_at: number | null;
  last_seen_at: number;
  summary: string;
}
export interface ActivityEvent {
  id: string;
  context_id: string;
  session_id: string | null;
  event_type: string;
  timestamp: number;
  source: string;
  metadata: { path?: string; previous_path?: string; duration?: number; reason?: string };
}
export interface Note {
  id: string;
  context_id: string;
  session_id: string | null;
  body: string;
  pinned: boolean;
  created_at: number;
  updated_at: number;
}
export interface Checkpoint {
  id: string;
  context_id: string;
  session_id: string;
  timestamp: number;
  duration: number;
  summary: string;
  completed: string[];
  unfinished: string[];
  next_action: string;
  files: string[];
}
export interface Settings {
  theme: 'system' | 'dark' | 'light';
  compact: boolean;
  reopen_last: boolean;
}
export interface AppData {
  contexts: Context[];
  sessions: Session[];
  events: ActivityEvent[];
  notes: Note[];
  checkpoints: Checkpoint[];
  settings: Settings;
  event_count: number;
  database_bytes: number;
}
export interface SearchResult {
  id: string;
  context_id: string;
  kind: string;
  title: string;
  excerpt: string;
  timestamp: number;
}
export interface ResumeResult {
  session: Session;
  folder_opened: boolean;
  warning: string | null;
}
export type Page = 'home' | 'contexts' | 'memory' | 'timeline' | 'search' | 'settings' | 'detail';
