import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './ThemeSettings.css';

interface ThemeSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const ThemeSettings: React.FC<ThemeSettingsProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, resetToDefaults, isDarkMode } = useTheme();
  const previewRef = useRef<HTMLElement>(null);

  // Get the current font family name
  const getCurrentFontName = () => {
    switch (settings.codeFont) {
      case 'fira-code': return 'Fira Code';
      case 'jetbrains-mono': return 'JetBrains Mono';
      case 'cascadia-code': return 'Cascadia Code';
      default: return 'Menlo, Monaco, Courier New, monospace';
    }
  };

  const handleModeChange = (mode: 'light' | 'dark' | 'system') => {
    updateSettings({ mode });
  };

  const handleColorSchemeChange = (colorScheme: string) => {
    updateSettings({ colorScheme: colorScheme as any });
  };

  const handleFontSizeChange = (fontSize: string) => {
    updateSettings({ fontSize: fontSize as any });
  };

  const handleCodeFontChange = (codeFont: string) => {
    updateSettings({ codeFont: codeFont as any });
    // Force the preview to update by changing a style
    if (previewRef.current) {
      const currentStyle = previewRef.current.style.opacity;
      previewRef.current.style.opacity = '0.99';
      setTimeout(() => {
        if (previewRef.current) {
          previewRef.current.style.opacity = currentStyle;
        }
      }, 50);
    }
  };

  // Only render if the settings panel is open
  if (!isOpen) return null;

  return (
    <div className="theme-settings-overlay" onClick={onClose}>
      <div className="theme-settings-container" onClick={(e) => e.stopPropagation()}>
        <div className="theme-settings-header">
          <h3>Theme Settings</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="theme-settings-content">
          <section className="settings-section">
            <h4>Theme Mode</h4>
            <div className="theme-mode-buttons">
              <button 
                className={`theme-btn ${settings.mode === 'light' ? 'active' : ''}`}
                onClick={() => handleModeChange('light')}
              >
                <span role="img" aria-label="Light mode">☀️</span> Light
              </button>
              <button 
                className={`theme-btn ${settings.mode === 'dark' ? 'active' : ''}`}
                onClick={() => handleModeChange('dark')}
              >
                <span role="img" aria-label="Dark mode">🌙</span> Dark
              </button>
              <button 
                className={`theme-btn ${settings.mode === 'system' ? 'active' : ''}`}
                onClick={() => handleModeChange('system')}
              >
                <span role="img" aria-label="System mode">🖥️</span> System
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h4>Color Scheme</h4>
            <div className="color-scheme-buttons">
              <button 
                className={`color-scheme-btn default ${settings.colorScheme === 'default' ? 'active' : ''}`}
                onClick={() => handleColorSchemeChange('default')}
              >
                Default
              </button>
              <button 
                className={`color-scheme-btn solarized ${settings.colorScheme === 'solarized' ? 'active' : ''}`}
                onClick={() => handleColorSchemeChange('solarized')}
              >
                Solarized
              </button>
              <button 
                className={`color-scheme-btn nord ${settings.colorScheme === 'nord' ? 'active' : ''}`}
                onClick={() => handleColorSchemeChange('nord')}
              >
                Nord
              </button>
              <button 
                className={`color-scheme-btn github ${settings.colorScheme === 'github' ? 'active' : ''}`}
                onClick={() => handleColorSchemeChange('github')}
              >
                GitHub
              </button>
              <button 
                className={`color-scheme-btn dracula ${settings.colorScheme === 'dracula' ? 'active' : ''}`}
                onClick={() => handleColorSchemeChange('dracula')}
              >
                Dracula
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h4>Font Size</h4>
            <div className="font-size-buttons">
              <button 
                className={`font-size-btn ${settings.fontSize === 'small' ? 'active' : ''}`}
                onClick={() => handleFontSizeChange('small')}
              >
                Small
              </button>
              <button 
                className={`font-size-btn ${settings.fontSize === 'medium' ? 'active' : ''}`}
                onClick={() => handleFontSizeChange('medium')}
              >
                Medium
              </button>
              <button 
                className={`font-size-btn ${settings.fontSize === 'large' ? 'active' : ''}`}
                onClick={() => handleFontSizeChange('large')}
              >
                Large
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h4>Code Font</h4>
            <div className="code-font-buttons">
              <button 
                className={`code-font-btn ${settings.codeFont === 'default' ? 'active' : ''}`}
                onClick={() => handleCodeFontChange('default')}
              >
                Default
              </button>
              <button 
                className={`code-font-btn ${settings.codeFont === 'fira-code' ? 'active' : ''}`}
                onClick={() => handleCodeFontChange('fira-code')}
              >
                Fira Code
              </button>
              <button 
                className={`code-font-btn ${settings.codeFont === 'jetbrains-mono' ? 'active' : ''}`}
                onClick={() => handleCodeFontChange('jetbrains-mono')}
              >
                JetBrains Mono
              </button>
              <button 
                className={`code-font-btn ${settings.codeFont === 'cascadia-code' ? 'active' : ''}`}
                onClick={() => handleCodeFontChange('cascadia-code')}
              >
                Cascadia Code
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h4>Preview</h4>
            <div className="code-preview">
              <pre>
                <code 
                  ref={previewRef} 
                  className="preview-code" 
                  style={{
                    fontFamily: getCurrentFontName(),
                    fontSize: 'var(--code-font-size)',
                    lineHeight: 1.5
                  }}
                >
{`function example() {
  // Preview of the selected font
  const message = "Hello!";
  return message.repeat(2);
}`}
                </code>
              </pre>
            </div>
          </section>
        </div>

        <div className="theme-settings-footer">
          <button 
            className="reset-btn"
            onClick={resetToDefaults}
          >
            Reset to Defaults
          </button>
          <button 
            className="close-settings-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettings; 