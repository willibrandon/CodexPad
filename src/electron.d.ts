// Type definitions for Electron IPC APIs exposed through preload.js

interface IElectronAPI {
  invoke(channel: string, ...args: any[]): Promise<any>;
  receive(channel: string, func: (...args: any[]) => void): void;
  removeAllListeners(channel: string): void;
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}

export {};
