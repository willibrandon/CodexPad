import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

// Define the types for our theme settings
export type ThemeMode = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'medium' | 'large';
export type CodeFont = 'default' | 'fira-code' | 'jetbrains-mono' | 'cascadia-code';
export type ColorScheme = 'default' | 'solarized' | 'nord' | 'github' | 'dracula';

// Interface for our theme settings
export interface ThemeSettings {
  mode: ThemeMode;
  fontSize: FontSize;
  codeFont: CodeFont;
  colorScheme: ColorScheme;
}

// Default theme settings
const defaultSettings: ThemeSettings = {
  mode: 'system',
  fontSize: 'medium',
  codeFont: 'default',
  colorScheme: 'default'
};

// Create the context with default values
interface ThemeContextType {
  settings: ThemeSettings;
  updateSettings: (settings: Partial<ThemeSettings>) => void;
  resetToDefaults: () => void;
  isDarkMode: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
  resetToDefaults: () => {},
  isDarkMode: false
});

// Create a hook to use the theme context
export const useTheme = () => useContext(ThemeContext);

// Create a provider component
interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Get stored settings or use defaults
  const [settings, setSettings] = useState<ThemeSettings>(() => {
    const storedSettings = localStorage.getItem('themeSettings');
    return storedSettings ? JSON.parse(storedSettings) : defaultSettings;
  });
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Check for system dark mode preference
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
  
  // Update isDarkMode when settings change
  useEffect(() => {
    if (settings.mode === 'dark') {
      setIsDarkMode(true);
    } else if (settings.mode === 'light') {
      setIsDarkMode(false);
    }
    // If it's 'system', the other useEffect will handle it
  }, [settings.mode]);
  
  // Apply CSS classes based on theme settings
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