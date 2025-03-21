/**
 * @fileoverview Component that displays a log of synchronization events and activities
 * with filtering and real-time updates.
 */

import React, { useState, useEffect, useRef } from 'react';
import './SyncLog.css';

/**
 * Represents a single synchronization log entry
 */
export interface SyncLogEntry {
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
 * Props for the SyncLog component
 */
interface SyncLogProps {
  /** Whether the log modal is visible */
  visible: boolean;
  /** Callback function to close the log modal */
  onClose: () => void;
}

/**
 * A modal component that displays synchronization log entries with real-time updates.
 * Supports different types of log entries (info, success, error, warning) with
 * timestamps and detailed information.
 *
 * @component
 */
const SyncLog: React.FC<SyncLogProps> = ({ visible, onClose }) => {
  const [logEntries, setLogEntries] = useState<SyncLogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load initial log entries when opened
  useEffect(() => {
    if (visible && window.electron) {
      setIsLoading(true);
      window.electron.invoke('sync:getLogEntries')
        .then((entries: SyncLogEntry[]) => {
          setLogEntries(entries || []);
        })
        .catch(error => {
          console.error('Failed to load log entries:', error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [visible]);

  // Listen for sync log events from the main process
  useEffect(() => {
    if (window.electron) {
      const handleLogEntry = (entry: SyncLogEntry) => {
        setLogEntries(prev => [entry, ...prev].slice(0, 100)); // Keep last 100 entries
      };

      window.electron.receive('sync:log-entry', handleLogEntry);

      return () => {
        window.electron.removeAllListeners('sync:log-entry');
      };
    }
  }, []);

  // Scroll to the top when new entries are added
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logEntries]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (!visible) return null;

  return (
    <div className="sync-log-overlay">
      <div className="sync-log-container">
        <div className="sync-log-header">
          <h3>Synchronization Log</h3>
          <button className="close-button" onClick={onClose} title="Close log">×</button>
        </div>
        
        <div className="sync-log-content" ref={logContainerRef}>
          {isLoading ? (
            <div className="sync-log-loading">Loading log entries...</div>
          ) : logEntries.length === 0 ? (
            <div className="sync-log-empty">No sync activities recorded yet.</div>
          ) : (
            logEntries.map(entry => (
              <div 
                key={entry.id} 
                className={`sync-log-entry sync-log-${entry.type}`}
              >
                <div className="sync-log-entry-header">
                  <span className="sync-log-timestamp">{formatTimestamp(entry.timestamp)}</span>
                  <span className="sync-log-type">{entry.type.toUpperCase()}</span>
                </div>
                <div className="sync-log-message">{entry.message}</div>
                {entry.details && (
                  <div className="sync-log-details">{entry.details}</div>
                )}
              </div>
            ))
          )}
        </div>
        
        <div className="sync-log-footer">
          <button 
            className="sync-log-clear" 
            onClick={() => setLogEntries([])}
            disabled={logEntries.length === 0 || isLoading}
          >
            Clear Log
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncLog; 