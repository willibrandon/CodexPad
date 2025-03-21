/**
 * @fileoverview Custom hook for managing snippet synchronization status
 * This module provides functionality to monitor and control the synchronization
 * state between the local database and remote server.
 * @module useSyncStatus
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Interface representing the current synchronization status
 * @interface SyncStatus
 */
export interface SyncStatus {
  /** Whether synchronization is enabled */
  enabled: boolean;
  /** Whether connected to sync server */
  connected: boolean;
  /** Number of changes waiting to be synced */
  pendingChanges: number;
  /** ISO timestamp of last successful sync */
  lastSyncedAt?: string;
}

/**
 * Custom hook for managing synchronization status and operations.
 * Provides functions to monitor sync status and control sync operations.
 * @returns {Object} Object containing sync status and control functions
 */
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

  /**
   * Toggles synchronization on/off.
   * @param {boolean} [enable] - Optional flag to explicitly set sync state
   * @returns {Promise<boolean>} New sync enabled state
   */
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

  /**
   * Triggers a manual backup of the database.
   * @returns {Promise<{success: boolean, message?: string, error?: string}>} Backup result
   */
  const triggerBackup = useCallback(async () => {
    if (window.electron) {
      try {
        const result = await window.electron.invoke('sync:backup');
        return { success: true, message: result.message };
      } catch (error: any) {
        console.error('Failed to trigger backup:', error);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'Electron API not available' };
  }, []);

  /**
   * Forces a snippet to be pushed to the server.
   * @param {any} snippet - The snippet to push
   * @returns {Promise<{success: boolean, error?: string}>} Push result
   */
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

  /**
   * Pulls a specific snippet from the server.
   * @param {number} snippetId - ID of the snippet to pull
   * @returns {Promise<{success: boolean, error?: string}>} Pull result
   */
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
    pullSnippet,
    triggerBackup
  };
} 