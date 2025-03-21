/**
 * @fileoverview Keyboard shortcuts context and provider for application-wide keyboard shortcuts
 * This module provides a React context for managing global keyboard shortcuts,
 * command palette state, search focus state, and keyboard shortcuts help dialog.
 * @module KeyboardShortcutsContext
 */

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { Snippet } from '../App';
import { useTabs } from '../components/TabsContext';

/**
 * Enumeration of shortcut categories for organization
 * @enum {string}
 */
export enum ShortcutCategory {
  Navigation = 'Navigation',
  Editing = 'Editing',
  Search = 'Search',
  View = 'View',
}

/**
 * Interface defining a keyboard shortcut
 * @interface KeyboardShortcut
 */
export interface KeyboardShortcut {
  /** Unique identifier for the shortcut */
  id: string;
  /** Display name of the shortcut */
  name: string;
  /** Array of keys that make up the shortcut (e.g., ['Ctrl', 'S']) */
  keys: string[];
  /** Category the shortcut belongs to */
  category: ShortcutCategory;
  /** Function to execute when shortcut is triggered */
  action: () => void;
  /** Description of what the shortcut does */
  description: string;
}

/**
 * Interface for keyboard shortcuts context value
 * @interface KeyboardShortcutsContextType
 */
interface KeyboardShortcutsContextType {
  /** List of registered keyboard shortcuts */
  shortcuts: KeyboardShortcut[];
  /** Function to register a new shortcut */
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  /** Function to unregister an existing shortcut */
  unregisterShortcut: (id: string) => void;
  /** Whether the command palette is open */
  commandPaletteOpen: boolean;
  /** Function to set command palette open state */
  setCommandPaletteOpen: (open: boolean) => void;
  /** Whether the search input is focused */
  searchFocused: boolean;
  /** Function to set search focus state */
  setSearchFocused: (focused: boolean) => void;
  /** Whether the shortcuts help dialog is open */
  shortcutsHelpOpen: boolean;
  /** Function to set shortcuts help dialog open state */
  setShortcutsHelpOpen: (open: boolean) => void;
}

// Create the context with undefined default value
const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(undefined);

/**
 * Provider component for keyboard shortcuts functionality
 * Manages global keyboard shortcuts and related UI states
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components
 */
export const KeyboardShortcutsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const { activeTabId, openTabs, openTab, closeTab, setActiveTab } = useTabs();

  // Register a new shortcut - memoized to prevent dependency cycles
  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setShortcuts(prev => {
      // Replace if exists, otherwise add
      const exists = prev.some(s => s.id === shortcut.id);
      if (exists) {
        return prev.map(s => s.id === shortcut.id ? shortcut : s);
      } else {
        return [...prev, shortcut];
      }
    });
  }, []);

  // Unregister a shortcut - memoized to prevent dependency cycles
  const unregisterShortcut = useCallback((id: string) => {
    setShortcuts(prev => prev.filter(s => s.id !== id));
  }, []);

  // Handle global keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if we're in an input field or textarea (unless it's the search field)
      if (
        (e.target instanceof HTMLInputElement || 
         e.target instanceof HTMLTextAreaElement) && 
        !searchFocused
      ) {
        return;
      }

      // Open command palette with Ctrl+Shift+P or Cmd+Shift+P
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Open shortcuts help with F1
      if (e.key === 'F1') {
        e.preventDefault();
        setShortcutsHelpOpen(true);
        return;
      }

      // Check for matching shortcuts
      for (const shortcut of shortcuts) {
        const matchesCtrlOrMeta = shortcut.keys.includes('Ctrl') || shortcut.keys.includes('Cmd');
        const matchesShift = shortcut.keys.includes('Shift');
        const matchesAlt = shortcut.keys.includes('Alt');
        const matchesKey = shortcut.keys.includes(e.key);

        if (
          matchesKey && 
          (matchesCtrlOrMeta === (e.ctrlKey || e.metaKey)) &&
          (matchesShift === e.shiftKey) &&
          (matchesAlt === e.altKey)
        ) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, searchFocused, commandPaletteOpen]);

  // Register default global shortcuts using a separate ID to prevent re-registration
  const tabsKey = useMemo(() => openTabs.map(t => t.id).join(','), [openTabs]);
  
  useEffect(() => {
    // Default shortcuts
    // 1. Global search focus (Ctrl+F or Cmd+F)
    registerShortcut({
      id: 'global-search',
      name: 'Focus Search',
      keys: ['Ctrl', 'f'],
      category: ShortcutCategory.Search,
      action: () => {
        const searchInput = document.querySelector('.search-input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          setSearchFocused(true);
        }
      },
      description: 'Focus the search bar'
    });

    // 2. Command palette (Ctrl+P or Cmd+P) - handled in the keydown handler

    // 3. Next tab (Ctrl+Tab or Cmd+Tab)
    registerShortcut({
      id: 'next-tab',
      name: 'Next Tab',
      keys: ['Ctrl', 'Tab'],
      category: ShortcutCategory.Navigation,
      action: () => {
        if (openTabs.length > 1 && activeTabId !== null) {
          const currentIndex = openTabs.findIndex(tab => tab.id === activeTabId);
          const nextIndex = (currentIndex + 1) % openTabs.length;
          setActiveTab(openTabs[nextIndex].id);
        }
      },
      description: 'Navigate to the next tab'
    });

    // 4. Previous tab (Ctrl+Shift+Tab or Cmd+Shift+Tab)
    registerShortcut({
      id: 'previous-tab',
      name: 'Previous Tab',
      keys: ['Ctrl', 'Shift', 'Tab'],
      category: ShortcutCategory.Navigation,
      action: () => {
        if (openTabs.length > 1 && activeTabId !== null) {
          const currentIndex = openTabs.findIndex(tab => tab.id === activeTabId);
          const prevIndex = (currentIndex - 1 + openTabs.length) % openTabs.length;
          setActiveTab(openTabs[prevIndex].id);
        }
      },
      description: 'Navigate to the previous tab'
    });

    // 5. Close current tab (Ctrl+W or Cmd+W)
    registerShortcut({
      id: 'close-tab',
      name: 'Close Tab',
      keys: ['Ctrl', 'w'],
      category: ShortcutCategory.Navigation,
      action: () => {
        if (activeTabId !== null) {
          closeTab(activeTabId);
        }
      },
      description: 'Close the current tab'
    });

    // 6. New snippet (Ctrl+N or Cmd+N)
    registerShortcut({
      id: 'new-snippet',
      name: 'New Snippet',
      keys: ['Ctrl', 'n'],
      category: ShortcutCategory.Editing,
      action: () => {
        if (window.electron) {
          window.electron.invoke('menu-action', 'new');
        }
      },
      description: 'Create a new snippet'
    });

    // 7. Save snippet (Ctrl+S or Cmd+S)
    registerShortcut({
      id: 'save-snippet',
      name: 'Save Snippet',
      keys: ['Ctrl', 's'],
      category: ShortcutCategory.Editing,
      action: () => {
        // This will be implemented in the SnippetEditor component
        document.dispatchEvent(new CustomEvent('save-snippet'));
      },
      description: 'Save the current snippet'
    });

    // 8. Switch to tab by number (Ctrl+1, Ctrl+2, etc.)
    for (let i = 1; i <= 9; i++) {
      registerShortcut({
        id: `goto-tab-${i}`,
        name: `Go to Tab ${i}`,
        keys: ['Ctrl', i.toString()],
        category: ShortcutCategory.Navigation,
        action: () => {
          if (openTabs.length >= i) {
            setActiveTab(openTabs[i - 1].id);
          }
        },
        description: `Switch to tab ${i}`
      });
    }

    // 9. Show keyboard shortcuts (F1) - handled in the keydown handler
    registerShortcut({
      id: 'show-shortcuts',
      name: 'Keyboard Shortcuts',
      keys: ['F1'],
      category: ShortcutCategory.View,
      action: () => {
        setShortcutsHelpOpen(true);
      },
      description: 'Show keyboard shortcuts help'
    });

  }, [registerShortcut, activeTabId, tabsKey, setActiveTab, closeTab]);

  // Create a stable context value to avoid unnecessary re-renders
  const contextValue = useMemo(() => ({
    shortcuts,
    registerShortcut,
    unregisterShortcut,
    commandPaletteOpen,
    setCommandPaletteOpen,
    searchFocused,
    setSearchFocused,
    shortcutsHelpOpen,
    setShortcutsHelpOpen
  }), [
    shortcuts,
    registerShortcut,
    unregisterShortcut,
    commandPaletteOpen,
    setCommandPaletteOpen,
    searchFocused,
    setSearchFocused,
    shortcutsHelpOpen,
    setShortcutsHelpOpen
  ]);

  return (
    <KeyboardShortcutsContext.Provider value={contextValue}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
};

/**
 * Hook to use keyboard shortcuts context
 * @returns {KeyboardShortcutsContextType} Keyboard shortcuts context value
 * @throws {Error} If used outside of KeyboardShortcutsProvider
 */
export const useKeyboardShortcuts = (): KeyboardShortcutsContextType => {
  const context = useContext(KeyboardShortcutsContext);
  if (context === undefined) {
    throw new Error('useKeyboardShortcuts must be used within a KeyboardShortcutsProvider');
  }
  return context;
}; 