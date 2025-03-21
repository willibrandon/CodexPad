/**
 * @fileoverview Component that implements custom window controls for the Electron application
 * with platform-specific behavior and theme integration.
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import ThemeSettings from './ThemeSettings';
import './WindowControls.css';

/**
 * A component that renders window controls (minimize, maximize/restore, close)
 * and application controls (theme toggle, settings) with platform-specific behavior.
 * 
 * Features:
 * - Platform-specific controls (Windows/macOS)
 * - Window state management (minimize, maximize, restore, close)
 * - Theme toggle integration
 * - Settings access
 * - Electron IPC communication
 * 
 * @component
 */
const WindowControls: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { isDarkMode, updateSettings } = useTheme();
  const isMac = window.electron && window.electron.platform === 'darwin';

  /**
   * Sets up event listeners for window state changes and theme controls
   */
  useEffect(() => {
    if (!window.electron) return;

    // Listen for window state changes
    window.electron.receive('window-maximized', () => setIsMaximized(true));
    window.electron.receive('window-unmaximized', () => setIsMaximized(false));

    // Get initial window state
    window.electron.invoke('window:isMaximized').then(setIsMaximized);

    // Listen for theme toggle and settings events
    window.electron.receive('toggle-theme', () => {
      updateSettings({ mode: isDarkMode ? 'light' : 'dark' });
    });

    window.electron.receive('open-settings', () => {
      setIsSettingsOpen(true);
    });

    // Cleanup listeners
    return () => {
      if (window.electron) {
        window.electron.removeAllListeners('window-maximized');
        window.electron.removeAllListeners('window-unmaximized');
        window.electron.removeAllListeners('toggle-theme');
        window.electron.removeAllListeners('open-settings');
      }
    };
  }, [isDarkMode, updateSettings]);

  /**
   * Minimizes the application window
   */
  const handleMinimize = () => {
    if (window.electron) {
      window.electron.send('window:minimize');
    }
  };

  /**
   * Toggles between maximized and restored window states
   */
  const handleMaximizeRestore = () => {
    if (window.electron) {
      window.electron.send('window:maximize-restore');
    }
  };

  /**
   * Closes the application window
   */
  const handleClose = () => {
    if (window.electron) {
      window.electron.send('window:close');
    }
  };

  /**
   * Toggles between light and dark themes
   */
  const handleToggleTheme = () => {
    updateSettings({ mode: isDarkMode ? 'light' : 'dark' });
  };

  /**
   * Opens the theme settings modal
   */
  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
  };

  /**
   * Closes the theme settings modal
   */
  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  // On macOS, we don't need to render the custom window controls
  // but we still want to show the theme toggle and settings
  if (isMac) {
    return (
      <div className="window-controls-spacer">
        <div className="app-controls">
          <button 
            className="app-control"
            onClick={handleToggleTheme}
            title={isDarkMode ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            {isDarkMode ? (
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="currentColor" d="M9.37,5.51C9.19,6.15,9.1,6.82,9.1,7.5c0,4.08,3.32,7.4,7.4,7.4c0.68,0,1.35-0.09,1.99-0.27C17.45,17.19,14.93,19,12,19 c-3.86,0-7-3.14-7-7C5,9.07,6.81,6.55,9.37,5.51z M12,3c-4.97,0-9,4.03-9,9s4.03,9,9,9s9-4.03,9-9c0-0.46-0.04-0.92-0.1-1.36 c-0.98,1.37-2.58,2.26-4.4,2.26c-2.98,0-5.4-2.42-5.4-5.4c0-1.81,0.89-3.42,2.26-4.4C12.92,3.04,12.46,3,12,3L12,3z"/>
              </svg>
            )}
          </button>
          <button 
            className="app-control"
            onClick={handleOpenSettings}
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="currentColor" d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
            </svg>
          </button>
        </div>
        
        {isSettingsOpen && (
          <ThemeSettings isOpen={isSettingsOpen} onClose={handleCloseSettings} />
        )}
      </div>
    );
  }

  return (
    <div className="window-controls-container">
      <div className="app-controls">
        <button 
          className="app-control"
          onClick={handleToggleTheme}
          title={isDarkMode ? "Switch to Light Theme" : "Switch to Dark Theme"}
        >
          {isDarkMode ? (
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="currentColor" d="M9.37,5.51C9.19,6.15,9.1,6.82,9.1,7.5c0,4.08,3.32,7.4,7.4,7.4c0.68,0,1.35-0.09,1.99-0.27C17.45,17.19,14.93,19,12,19 c-3.86,0-7-3.14-7-7C5,9.07,6.81,6.55,9.37,5.51z M12,3c-4.97,0-9,4.03-9,9s4.03,9,9,9s9-4.03,9-9c0-0.46-0.04-0.92-0.1-1.36 c-0.98,1.37-2.58,2.26-4.4,2.26c-2.98,0-5.4-2.42-5.4-5.4c0-1.81,0.89-3.42,2.26-4.4C12.92,3.04,12.46,3,12,3L12,3z"/>
            </svg>
          )}
        </button>
        <button 
          className="app-control"
          onClick={handleOpenSettings}
          title="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="currentColor" d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
          </svg>
        </button>
      </div>
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
      
      {isSettingsOpen && (
        <ThemeSettings isOpen={isSettingsOpen} onClose={handleCloseSettings} />
      )}
    </div>
  );
};

export default WindowControls; 