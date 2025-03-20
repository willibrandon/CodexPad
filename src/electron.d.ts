// Type definitions for Electron IPC APIs exposed through preload.js

interface ElectronAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  receive: (channel: string, func: (...args: any[]) => void) => void;
  removeAllListeners: (channel: string) => void;
  getFontsPath: () => Promise<string>;
}

// Sync-related types
interface SyncStatusResponse {
  connected: boolean;
  pendingChanges: number;
  lastSyncedAt?: string;
}

interface SyncUpdateEvent {
  snippetId: number;
  version: number;
  updatedAt: string;
}

interface SyncLogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

// Extend the Window interface with our Electron API
declare global {
  interface Window {
    electron: {
      platform: string;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      send: (channel: 'window:minimize' | 'window:maximize-restore' | 'window:close', ...args: any[]) => void;
      receive: (channel: string, func: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
      getFontsPath: () => Promise<string>;
    };
  }
}

// Define the export result type
export interface ExportResult {
  success: boolean;
  message?: string;
  error?: string;
  filePath?: string;
}

// Define the type for Electron API's invoke function
export interface ElectronInvokeAPI {
  'snippets:getAll': () => Promise<any[]>;
  'snippets:create': (title: string, content: string, tags: string[]) => Promise<any>;
  'snippets:update': (snippet: any) => Promise<boolean>;
  'snippets:delete': (id: number) => Promise<boolean>;
  'snippets:search': (term: string) => Promise<any[]>;
  'sync:push': (snippet: any) => Promise<any>;
  'sync:pull': (snippetId: number) => Promise<any>;
  'sync:status': () => Promise<any>;
  'sync:toggle': (enable?: boolean) => Promise<any>;
  'sync:getLogEntries': () => Promise<any[]>;
  'sync:backup': () => Promise<any>;
  'get-fonts-path': () => Promise<string>;
  'export:markdown': (snippet: any) => Promise<ExportResult>;
  'export:html': (snippet: any) => Promise<ExportResult>;
  'export:pdf': (snippet: any) => Promise<ExportResult>;
}

export {};
