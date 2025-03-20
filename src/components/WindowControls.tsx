import React, { useState, useEffect } from 'react';
import './WindowControls.css';

const WindowControls: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!window.electron) return;

    // Listen for window state changes
    window.electron.receive('window-maximized', () => setIsMaximized(true));
    window.electron.receive('window-unmaximized', () => setIsMaximized(false));

    // Get initial window state
    window.electron.invoke('window:isMaximized').then(setIsMaximized);

    // Cleanup listeners
    return () => {
      if (window.electron) {
        window.electron.removeAllListeners('window-maximized');
        window.electron.removeAllListeners('window-unmaximized');
      }
    };
  }, []);

  const handleMinimize = () => {
    if (window.electron) {
      window.electron.send('window:minimize');
    }
  };

  const handleMaximizeRestore = () => {
    if (window.electron) {
      window.electron.send('window:maximize-restore');
    }
  };

  const handleClose = () => {
    if (window.electron) {
      window.electron.send('window:close');
    }
  };

  return (
    <div className="window-controls">
      <button 
        className="window-control minimize"
        onClick={handleMinimize}
        title="Minimize"
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect fill="currentColor" width="10" height="1" x="1" y="6"/>
        </svg>
      </button>
      <button 
        className="window-control maximize"
        onClick={handleMaximizeRestore}
        title={isMaximized ? "Restore" : "Maximize"}
      >
        {isMaximized ? (
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path fill="currentColor" d="M3.5,4.5v3h3v-3H3.5z M2,3h6v6H2V3z M4,1h6v6H9V2H4V1z"/>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path fill="currentColor" d="M2,2v8h8V2H2z M3,3h6v6H3V3z"/>
          </svg>
        )}
      </button>
      <button 
        className="window-control close"
        onClick={handleClose}
        title="Close"
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path fill="currentColor" d="M7.1,6l3.3-3.3c0.3-0.3,0.3-0.8,0-1.1c-0.3-0.3-0.8-0.3-1.1,0L6,4.9L2.7,1.6c-0.3-0.3-0.8-0.3-1.1,0c-0.3,0.3-0.3,0.8,0,1.1L4.9,6L1.6,9.3c-0.3,0.3-0.3,0.8,0,1.1c0.3,0.3,0.8,0.3,1.1,0L6,7.1l3.3,3.3c0.3,0.3,0.8,0.3,1.1,0c0.3-0.3,0.3-0.8,0-1.1L7.1,6z"/>
        </svg>
      </button>
    </div>
  );
};

export default WindowControls; 