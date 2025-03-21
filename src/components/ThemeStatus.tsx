/**
 * @fileoverview Component that displays current theme configuration status
 * including mode, color scheme, and font settings.
 */

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './ThemeStatus.css';

/**
 * A component that shows the current theme configuration status.
 * Displays the active theme mode (light/dark), color scheme, and font settings.
 * 
 * Features:
 * - Theme mode indicator (Light/Dark/System)
 * - Color scheme display
 * - Font size and family information
 * - Responsive layout
 * 
 * @component
 */
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