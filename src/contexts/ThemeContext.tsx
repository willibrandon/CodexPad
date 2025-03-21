/**
 * @fileoverview Theme context and provider for application-wide theming
 * This module provides a React context for managing theme settings including
 * dark/light mode, font sizes, code fonts, and color schemes.
 * @module ThemeContext
 */

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

/** Type for theme mode selection */
export type ThemeMode = 'light' | 'dark' | 'system';
/** Type for font size selection */
export type FontSize = 'small' | 'medium' | 'large';
/** Type for code font selection */
export type CodeFont = 'default' | 'fira-code' | 'jetbrains-mono' | 'cascadia-code';
/** Type for color scheme selection */
export type ColorScheme = 'default' | 'solarized' | 'nord' | 'github' | 'dracula';

/**
 * Interface defining theme settings
 * @interface ThemeSettings
 */
export interface ThemeSettings {
  /** Selected theme mode */
  mode: ThemeMode;
  /** Selected font size */
  fontSize: FontSize;
  /** Selected code font */
  codeFont: CodeFont;
  /** Selected color scheme */
  colorScheme: ColorScheme;
}

/** Default theme settings */
const defaultSettings: ThemeSettings = {
  mode: 'system',
  fontSize: 'medium',
  codeFont: 'default',
  colorScheme: 'default'
};

/**
 * Interface for theme context value
 * @interface ThemeContextType
 */
interface ThemeContextType {
  /** Current theme settings */
  settings: ThemeSettings;
  /** Function to update theme settings */
  updateSettings: (settings: Partial<ThemeSettings>) => void;
  /** Function to reset settings to defaults */
  resetToDefaults: () => void;
  /** Whether dark mode is currently active */
  isDarkMode: boolean;
}

// Create the context with default values
const ThemeContext = createContext<ThemeContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
  resetToDefaults: () => {},
  isDarkMode: false
});

/**
 * Hook to use theme context
 * @returns {ThemeContextType} Theme context value
 */
export const useTheme = () => useContext(ThemeContext);

/**
 * Props for ThemeProvider component
 * @interface ThemeProviderProps
 */
interface ThemeProviderProps {
  /** Child components */
  children: ReactNode;
}

/**
 * Provider component for theme functionality
 * Manages theme settings and applies them to the document
 * @param {ThemeProviderProps} props - Component props
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Initialize settings from localStorage or defaults
  const [settings, setSettings] = useState<ThemeSettings>(() => {
    const storedSettings = localStorage.getItem('themeSettings');
    return storedSettings ? JSON.parse(storedSettings) : defaultSettings;
  });
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Monitor system dark mode preference
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (settings.mode === 'system') {
        setIsDarkMode(e.matches);
      }
    };
    
    // Initial check
    handleChange(darkModeMediaQuery);
    
    // Listen for changes
    darkModeMediaQuery.addEventListener('change', handleChange);
    
    return () => {
      darkModeMediaQuery.removeEventListener('change', handleChange);
    };
  }, [settings.mode]);
  
  // Update dark mode when settings change
  useEffect(() => {
    if (settings.mode === 'dark') {
      setIsDarkMode(true);
    } else if (settings.mode === 'light') {
      setIsDarkMode(false);
    }
    // If it's 'system', the other useEffect will handle it
  }, [settings.mode]);
  
  // Apply theme classes to document
  useEffect(() => {
    const htmlElement = document.documentElement;
    
    // Remove all previous theme classes
    htmlElement.classList.remove('light-mode', 'dark-mode');
    htmlElement.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    htmlElement.classList.remove('code-font-default', 'code-font-fira-code', 'code-font-jetbrains-mono', 'code-font-cascadia-code');
    htmlElement.classList.remove('color-scheme-default', 'color-scheme-solarized', 'color-scheme-nord', 'color-scheme-github', 'color-scheme-dracula');
    
    // Add new classes based on current settings
    htmlElement.classList.add(isDarkMode ? 'dark-mode' : 'light-mode');
    htmlElement.classList.add(`font-size-${settings.fontSize}`);
    htmlElement.classList.add(`code-font-${settings.codeFont}`);
    htmlElement.classList.add(`color-scheme-${settings.colorScheme}`);
    
  }, [settings, isDarkMode]);
  
  // Store settings in localStorage when they change
  useEffect(() => {
    localStorage.setItem('themeSettings', JSON.stringify(settings));
  }, [settings]);
  
  // Update settings
  const updateSettings = (newSettings: Partial<ThemeSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };
  
  // Reset to defaults
  const resetToDefaults = () => {
    setSettings(defaultSettings);
  };
  
  return (
    <ThemeContext.Provider value={{ settings, updateSettings, resetToDefaults, isDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}; 