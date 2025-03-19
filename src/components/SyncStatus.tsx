import React from 'react';
import { useSyncStatus } from '../hooks/useSyncStatus';
import './SyncStatus.css';

const SyncStatus: React.FC = () => {
  const { status, toggleSync } = useSyncStatus();

  const handleToggleSync = () => {
    toggleSync();
  };

  return (
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
        className="sync-toggle" 
        onClick={handleToggleSync}
        title={status.enabled ? 'Turn off sync' : 'Turn on sync'}
      >
        {status.enabled ? 'Disable Sync' : 'Enable Sync'}
      </button>
    </div>
  );
};

export default SyncStatus; 