import { useState, useEffect, useCallback } from 'react';

export interface SyncStatus {
  enabled: boolean;
  connected: boolean;
  pendingChanges: number;
  lastSyncedAt?: string;
}

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>({
    enabled: true,
    connected: false,
    pendingChanges: 0
  });

  // Get initial status
  useEffect(() => {
    const fetchStatus = async () => {
      if (window.electron) {
        try {
          const syncStatus = await window.electron.invoke('sync:status');
          setStatus(syncStatus);
        } catch (error) {
          console.error('Failed to get sync status:', error);
        }
      }
    };

    fetchStatus();
  }, []);

  // Listen for status updates
  useEffect(() => {
    if (window.electron) {
      const handleStatusUpdate = (newStatus: SyncStatus) => {
        setStatus(prev => ({ ...prev, ...newStatus }));
      };

      window.electron.receive('sync:connection-status', handleStatusUpdate);

      return () => {
        window.electron.removeAllListeners('sync:connection-status');
      };
    }
  }, []);

  // Toggle sync enable/disable
  const toggleSync = useCallback(async (enable?: boolean) => {
    if (window.electron) {
      try {
        const result = await window.electron.invoke('sync:toggle', enable);
        setStatus(prev => ({ ...prev, enabled: result.enabled }));
        return result.enabled;
      } catch (error: any) {
        console.error('Failed to toggle sync:', error);
        return status.enabled;
      }
    }
    return status.enabled;
  }, [status.enabled]);

  // Force push a snippet to the server
  const pushSnippet = useCallback(async (snippet: any) => {
    if (window.electron) {
      try {
        return await window.electron.invoke('sync:push', snippet);
      } catch (error: any) {
        console.error('Failed to push snippet:', error);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'Electron API not available' };
  }, []);

  // Pull a snippet from the server
  const pullSnippet = useCallback(async (snippetId: number) => {
    if (window.electron) {
      try {
        return await window.electron.invoke('sync:pull', snippetId);
      } catch (error: any) {
        console.error('Failed to pull snippet:', error);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'Electron API not available' };
  }, []);

  return {
    status,
    toggleSync,
    pushSnippet,
    pullSnippet
  };
} 