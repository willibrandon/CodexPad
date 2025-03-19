import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import ThemeSettings from './ThemeSettings';
import './ThemeToggle.css';

const ThemeToggle: React.FC = () => {
  const { settings, updateSettings, isDarkMode } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const toggleTheme = () => {
    updateSettings({ mode: isDarkMode ? 'light' : 'dark' });
  };

  const openSettings = () => {
    setIsSettingsOpen(true);
  };

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