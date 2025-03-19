import React, { useState } from 'react';
import { useSyncStatus } from '../hooks/useSyncStatus';
import SyncLog from './SyncLog';
import './SyncStatus.css';

const SyncStatus: React.FC = () => {
  const { status, toggleSync } = useSyncStatus();
  const [showSyncLog, setShowSyncLog] = useState(false);

  const handleToggleSync = () => {
    toggleSync();
  };

  const handleOpenSyncLog = () => {
    setShowSyncLog(true);
  };

  const handleCloseSyncLog = () => {
    setShowSyncLog(false);
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
          className="sync-toggle" 
          onClick={handleToggleSync}
          title={status.enabled ? 'Turn off sync' : 'Turn on sync'}
        >
          {status.enabled ? 'Disable Sync' : 'Enable Sync'}
        </button>
      </div>
      
      <SyncLog visible={showSyncLog} onClose={handleCloseSyncLog} />
    </>
  );
};

export default SyncStatus; 