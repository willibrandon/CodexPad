import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './ThemeStatus.css';

const ThemeStatus: React.FC = () => {
  const { settings, isDarkMode } = useTheme();
  
  return (
    <div className="theme-status">
      <div className="theme-status-item">
        <span className="theme-status-label">Theme:</span>
        <span className="theme-status-value">
          {isDarkMode ? 'Dark' : 'Light'} 
          {settings.mode === 'system' && ' (System)'}
        </span>
      </div>
      
      <div className="theme-status-item">
        <span className="theme-status-label">Color:</span>
        <span className="theme-status-value">
          {settings.colorScheme.charAt(0).toUpperCase() + settings.colorScheme.slice(1)}
        </span>
      </div>
      
      <div className="theme-status-item">
        <span className="theme-status-label">Font:</span>
        <span className="theme-status-value">
          {settings.fontSize.charAt(0).toUpperCase() + settings.fontSize.slice(1)} / 
          {settings.codeFont === 'default' ? 'System' : 
            settings.codeFont === 'fira-code' ? 'Fira' :
            settings.codeFont === 'jetbrains-mono' ? 'JetBrains' : 'Cascadia'}
        </span>
      </div>
    </div>
  );
};

export default ThemeStatus; 