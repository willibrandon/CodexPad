import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { Snippet } from '../App';
import { useTabs } from '../components/TabsContext';

// Define shortcut categories
export enum ShortcutCategory {
  Navigation = 'Navigation',
  Editing = 'Editing',
  Search = 'Search',
  View = 'View',
}

// Define interface for a keyboard shortcut
export interface KeyboardShortcut {
  id: string;
  name: string;
  keys: string[];
  category: ShortcutCategory;
  action: () => void;
  description: string;
}

interface KeyboardShortcutsContextType {
  shortcuts: KeyboardShortcut[];
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  unregisterShortcut: (id: string) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  searchFocused: boolean;
  setSearchFocused: (focused: boolean) => void;
  shortcutsHelpOpen: boolean;
  setShortcutsHelpOpen: (open: boolean) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(undefined);

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

      // Open command palette with Ctrl+P or Cmd+P
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
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
          window.electron.invoke('create-new-snippet');
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

export const useKeyboardShortcuts = (): KeyboardShortcutsContextType => {
  const context = useContext(KeyboardShortcutsContext);
  if (context === undefined) {
    throw new Error('useKeyboardShortcuts must be used within a KeyboardShortcutsProvider');
  }
  return context;
}; 