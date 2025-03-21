/**
 * @fileoverview Type definitions for Electron IPC APIs exposed through preload.js
 * Defines interfaces for communication between renderer and main processes.
 */

/**
 * Core Electron API interface exposed to renderer process
 */
interface ElectronAPI {
  /** Invokes a main process function and returns a promise */
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  /** Registers a callback for receiving messages from main process */
  receive: (channel: string, func: (...args: any[]) => void) => void;
  /** Removes all listeners for a specific channel */
  removeAllListeners: (channel: string) => void;
  /** Gets the path to system fonts */
  getFontsPath: () => Promise<string>;
}

/**
 * Synchronization status response interface
 */
interface SyncStatusResponse {
  /** Whether connected to sync server */
  connected: boolean;
  /** Number of changes waiting to be synced */
  pendingChanges: number;
  /** ISO timestamp of last successful sync */
  lastSyncedAt?: string;
}

/**
 * Sync update event interface
 */
interface SyncUpdateEvent {
  /** ID of the snippet being synced */
  snippetId: number;
  /** Version number of the sync */
  version: number;
  /** ISO timestamp of the update */
  updatedAt: string;
}

/**
 * Sync log entry interface
 */
interface SyncLogEntry {
  /** Unique identifier for the log entry */
  id: string;
  /** ISO timestamp of when the event occurred */
  timestamp: string;
  /** Type of log entry for visual differentiation */
  type: 'info' | 'success' | 'error' | 'warning';
  /** Main message describing the sync event */
  message: string;
  /** Optional detailed information about the event */
  details?: string;
}

/**
 * Global window interface extension for Electron
 */
declare global {
  interface Window {
    electron: {
      /** Current platform (win32, darwin, linux) */
      platform: string;
      /** Invokes a main process function */
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      /** Sends a message to the main process */
      send: (channel: 'window:minimize' | 'window:maximize-restore' | 'window:close', ...args: any[]) => void;
      /** Registers a callback for receiving messages */
      receive: (channel: string, func: (...args: any[]) => void) => void;
      /** Removes all listeners for a channel */
      removeAllListeners: (channel: string) => void;
      /** Gets the path to system fonts */
      getFontsPath: () => Promise<string>;
    };
  }
}

/**
 * Export operation result interface
 */
export interface ExportResult {
  /** Whether the export was successful */
  success: boolean;
  /** Optional success message */
  message?: string;
  /** Optional error message if failed */
  error?: string;
  /** Path to the exported file if successful */
  filePath?: string;
}

/**
 * Type definitions for all available IPC invoke channels
 */
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
