// Type definitions for Electron IPC APIs exposed through preload.js

interface IElectronAPI {
  invoke(channel: string, ...args: any[]): Promise<any>;
  receive(channel: string, func: (...args: any[]) => void): void;
  removeAllListeners(channel: string): void;
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

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}

export {};
