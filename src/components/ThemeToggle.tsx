/**
 * @fileoverview Component that provides theme switching functionality
 * and access to theme settings.
 */

import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import ThemeSettings from './ThemeSettings';
import './ThemeToggle.css';

/**
 * A component that renders theme controls including a light/dark mode toggle
 * and a button to access detailed theme settings.
 * 
 * Features:
 * - Light/dark mode toggle with icons
 * - Settings button to open theme customization
 * - Smooth transitions between states
 * - Accessible button controls
 * 
 * @component
 */
const ThemeToggle: React.FC = () => {
  const { settings, updateSettings, isDarkMode } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  /**
   * Toggles between light and dark theme modes
   */
  const toggleTheme = () => {
    updateSettings({ mode: isDarkMode ? 'light' : 'dark' });
  };

  /**
   * Opens the theme settings modal
   */
  const openSettings = () => {
    setIsSettingsOpen(true);
  };

  /**
   * Closes the theme settings modal
   */
  const closeSettings = () => {
    setIsSettingsOpen(false);
  };

  return (
    <div className="theme-toggle">
      <button 
        className="theme-toggle-btn" 
        onClick={toggleTheme}
        aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
        title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
      >
        {isDarkMode ? (
          <span role="img" aria-label="Light mode">☀️</span>
        ) : (
          <span role="img" aria-label="Dark mode">🌙</span>
        )}
      </button>

      <button 
        className="theme-settings-btn" 
        onClick={openSettings}
        aria-label="Theme settings"
        title="Theme settings"
      >
        <span className="settings-icon">⚙️</span>
      </button>

      {isSettingsOpen && (
        <ThemeSettings isOpen={isSettingsOpen} onClose={closeSettings} />
      )}
    </div>
  );
};

export default ThemeToggle; 