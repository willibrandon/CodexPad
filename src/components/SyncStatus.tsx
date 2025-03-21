/**
 * @fileoverview Component that displays and controls the synchronization status
 * including connection state, pending changes, and backup functionality.
 */

import React, { useState } from 'react';
import { useSyncStatus } from '../hooks/useSyncStatus';
import SyncLog from './SyncLog';
import './SyncStatus.css';

/**
 * A component that shows the current synchronization status and provides
 * controls for enabling/disabling sync, viewing logs, and triggering backups.
 * 
 * Features:
 * - Visual indicator for connection status
 * - Counter for pending changes
 * - Manual backup trigger
 * - Access to sync logs
 * - Enable/disable sync toggle
 * 
 * @component
 */
const SyncStatus: React.FC = () => {
  const { status, toggleSync, triggerBackup } = useSyncStatus();
  const [showSyncLog, setShowSyncLog] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{
    inProgress: boolean;
    message?: string;
    isError?: boolean;
  }>({ inProgress: false });

  const handleToggleSync = () => {
    toggleSync();
  };

  const handleOpenSyncLog = () => {
    setShowSyncLog(true);
  };

  const handleCloseSyncLog = () => {
    setShowSyncLog(false);
  };

  const handleBackup = async () => {
    setBackupStatus({ inProgress: true });
    try {
      const result = await triggerBackup();
      
      if (result.success) {
        setBackupStatus({ 
          inProgress: false, 
          message: result.message || 'Backup completed successfully',
          isError: false 
        });
      } else {
        setBackupStatus({ 
          inProgress: false, 
          message: result.error || 'Backup failed',
          isError: true 
        });
      }
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setBackupStatus(prev => ({ ...prev, message: undefined }));
      }, 3000);
    } catch (error) {
      setBackupStatus({ 
        inProgress: false, 
        message: 'Unexpected error during backup',
        isError: true 
      });
    }
  };

  return (
    <>
      <div className="sync-status">
        <div className="sync-indicator">
          <div 
            className={`sync-dot ${status.connected ? 'connected' : status.enabled ? 'connecting' : 'disabled'}`} 
            title={
              status.connected 
                ? 'Connected to sync server' 
                : status.enabled 
                  ? 'Connecting to sync server...' 
                  : 'Sync disabled'
            }
          />
          <span className="sync-text">
            {status.connected 
              ? 'Sync on' 
              : status.enabled 
                ? 'Connecting...' 
                : 'Sync off'
            }
          </span>
        </div>
        
        {status.pendingChanges > 0 && (
          <div className="sync-pending" title={`${status.pendingChanges} changes waiting to sync`}>
            {status.pendingChanges}
          </div>
        )}
        
        <button 
          className="sync-log-button" 
          onClick={handleOpenSyncLog}
          title="View sync log"
        >
          Log
        </button>
        
        <button 
          className="sync-backup-button" 
          onClick={handleBackup}
          disabled={backupStatus.inProgress || !status.connected}
          title={status.connected ? "Create a manual backup" : "Connect to server to enable backups"}
        >
          {backupStatus.inProgress ? 'Backing up...' : 'Backup'}
        </button>
        
        <button 
          className="sync-toggle" 
          onClick={handleToggleSync}
          title={status.enabled ? 'Turn off sync' : 'Turn on sync'}
        >
          {status.enabled ? 'Disable Sync' : 'Enable Sync'}
        </button>
      </div>
      
      {backupStatus.message && (
        <div className={`backup-status-message ${backupStatus.isError ? 'error' : 'success'}`}>
          {backupStatus.message}
        </div>
      )}
      
      <SyncLog visible={showSyncLog} onClose={handleCloseSyncLog} />
    </>
  );
};

export default SyncStatus; 