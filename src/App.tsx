/**
 * @fileoverview Main application component that manages the overall app state
 * and provides the core layout structure.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import SearchBar from './components/SearchBar';
import SnippetList from './components/SnippetList';
import SnippetEditor from './components/SnippetEditor';
import TabsBar from './components/TabsBar';
import SyncStatus from './components/SyncStatus';
import ThemeStatus from './components/ThemeStatus';
import CommandPalette from './components/CommandPalette';
import ShortcutsHelp from './components/ShortcutsHelp';
import ImportDialog from './components/ImportDialog';
import AboutDialog from './components/AboutDialog';
import { TabsProvider, useTabs } from './components/TabsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { KeyboardShortcutsProvider, useKeyboardShortcuts } from './contexts/KeyboardShortcutsContext';
import { tagSuggestionService } from './services/ai/tagSuggestionService';
import { summarizationService } from './services/ai/summarizationService';
import { SearchService } from './services/search/searchService';
import AppMenu from './components/AppMenu';
import { modelInitializer } from './services/ai/modelInitializer';

/**
 * Core snippet data structure
 */
export interface Snippet {
  /** Unique identifier for the snippet */
  id: number;
  /** Title of the snippet */
  title: string;
  /** Main content of the snippet */
  content: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Array of associated tags */
  tags: string[];
  /** Whether the snippet is marked as favorite */
  favorite: boolean;
}

// Import our custom electron TypeScript definitions
import './electron.d.ts';

// Create a stable instance of the search service
const searchService = new SearchService();

/**
 * Main application content component that handles:
 * - Snippet management (CRUD operations)
 * - Search functionality
 * - Import/Export features
 * - AI-powered features
 * - Keyboard shortcuts
 * - Theme management
 * 
 * @component
 */
const AppContent: React.FC = () => {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSnippets, setFilteredSnippets] = useState<Snippet[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const { openTab, activeTabId, openTabs, updateTabContent, closeTab, tabExists } = useTabs();
  const { 
    commandPaletteOpen, 
    setCommandPaletteOpen, 
    shortcutsHelpOpen, 
    setShortcutsHelpOpen 
  } = useKeyboardShortcuts();
  
  // Use a ref to avoid re-creating memoized functions when snippets change
  const snippetsRef = useRef<Snippet[]>([]);
  snippetsRef.current = snippets;
  
  // Reference to track if component is mounted
  const mountedRef = useRef<boolean>(true);

  // Register memory pressure handler
  useEffect(() => {
    if (window.electron) {
      // Request memory info every 30 seconds to check for high memory usage
      const memoryCheckInterval = setInterval(async () => {
        try {
          const memoryInfo = await window.electron.invoke('get-memory-info');
          
          // If memory usage is high (>70% of available memory), force cleanup
          if (memoryInfo && memoryInfo.percentUsed > 70) {
            console.log('High memory usage detected, cleaning up resources...');
            modelInitializer.cleanupUnusedResources();
            
            // Request garbage collection if available
            if (window.gc) {
              try {
                window.gc();
              } catch (e) {
                // Ignore errors if gc isn't available
              }
            }
          }
        } catch (err) {
          // Ignore errors
        }
      }, 30000);
      
      return () => clearInterval(memoryCheckInterval);
    }
  }, []);

  // Register app lifecycle listeners
  useEffect(() => {
    mountedRef.current = true;
    
    // Listen for app visibility changes
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      
      // When app is not visible, clean up unused resources
      if (!isVisible) {
        modelInitializer.cleanupUnusedResources();
      }
    };
    
    // Handle app shutdown
    const handleBeforeUnload = () => {
      modelInitializer.dispose();
    };
    
    // Register listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Get the currently active snippet
  const activeSnippet = openTabs.find(tab => tab.id === activeTabId) || null;

  // Handler function for creating a new snippet
  const handleCreateNewSnippet = useCallback(async () => {
    try {
      if (window.electron) {
        const newTitle = 'New Snippet';
        const newContent = '';
        const newTags: string[] = [];
        
        const newSnippet = await window.electron.invoke('snippets:create', newTitle, newContent, newTags);
        
        // Ensure tags is initialized
        const snippetWithTags = {
          ...newSnippet,
          tags: newSnippet.tags || []
        };
        
        // Update snippets state
        setSnippets(prev => {
          const updated = [snippetWithTags, ...prev];
          
          // Immediately update filteredSnippets based on current search term
          if (searchTerm) {
            const filtered = updated.filter(s => 
              s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
              s.content.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredSnippets(filtered);
          } else {
            // If no search term, filtered list should match full list
            setFilteredSnippets(updated);
          }
          
          return updated;
        });
        
        // Open the new snippet in a tab
        openTab(snippetWithTags);
      }
    } catch (error) {
      console.error('Failed to create new snippet:', error);
    }
  }, [openTab, searchTerm]);

  // Handler for opening the import dialog
  const handleOpenImportDialog = useCallback(() => {
    setImportDialogOpen(true);
  }, []);

  // Listen for menu actions
  useEffect(() => {
    if (window.electron) {
      window.electron.receive('menu-action', (action: string) => {
        console.log('App.tsx received menu action:', action);
        switch (action) {
          case 'command-palette':
            console.log('Opening command palette');
            setCommandPaletteOpen(true);
            break;
          case 'keyboard-shortcuts':
            console.log('Opening keyboard shortcuts');
            setShortcutsHelpOpen(true);
            break;
          case 'documentation':
            console.log('Opening documentation');
            // Open documentation in default browser
            window.electron.invoke('open-external-url', 'https://github.com/yourusername/codexpad/wiki');
            break;
          case 'about':
            console.log('Opening about dialog');
            setAboutDialogOpen(true);
            break;
          default:
            console.log('Unhandled menu action:', action);
        }
      });
      
      // Add handler for memory-pressure events from the OS
      window.electron.receive('memory-pressure', (level: string) => {
        console.log(`Memory pressure detected: ${level}`);
        // Aggressive cleanup on memory pressure
        modelInitializer.cleanupUnusedResources();
      });
    }
    
    return () => {
      if (window.electron) {
        window.electron.removeAllListeners('memory-pressure');
      }
    };
  }, [setCommandPaletteOpen, setShortcutsHelpOpen, setAboutDialogOpen]);

  // Handle export snippet from menu action
  const handleExportSnippet = useCallback(async (format: string) => {
    console.log(`Export snippet called with format: ${format}`);
    // Make sure there's an active snippet to export
    if (activeSnippet) {
      console.log(`Active snippet found: ${activeSnippet.title}`);
      try {
        if (window.electron) {
          console.log(`Invoking export:${format}`);
          const result = await window.electron.invoke(`export:${format}`, activeSnippet);
          console.log(`Export result:`, result);
          // The export functionality is handled by the main process
          // We could add a toast notification here if desired
          console.log(`Export ${result.success ? 'successful' : 'failed'}: ${result.message || ''}`);
        }
      } catch (error) {
        console.error('Failed to export snippet:', error);
      }
    } else {
      console.log('No active snippet found for export');
    }
  }, [activeSnippet]);

  // Load all snippets and initialize AI services on component mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load snippets
        if (window.electron) {
          const loadedSnippets = await window.electron.invoke('snippets:getAll');
          if (mountedRef.current) {
            setSnippets(loadedSnippets);
            // Also update filtered snippets immediately
            setFilteredSnippets(loadedSnippets);
          
            // Initialize AI services with loaded snippets - lazy load to reduce initial memory usage
            setTimeout(() => {
              if (mountedRef.current) {
                // Only initialize one service at a time to reduce memory pressure
                tagSuggestionService.initialize(loadedSnippets)
                  .then(() => {
                    // After tag service is initialized, initialize summarization service
                    if (mountedRef.current) {
                      return summarizationService.initialize(loadedSnippets);
                    }
                  })
                  .catch(err => console.error('Failed to initialize AI services:', err));
              }
            }, 5000); // Wait 5 seconds before initializing AI to let the app stabilize
          }
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };
    
    initializeApp();
    
    // Listen for "create-new-snippet" event from main process
    if (window.electron) {
      window.electron.receive('create-new-snippet', handleCreateNewSnippet);
      window.electron.receive('open-import-dialog', handleOpenImportDialog);
      window.electron.receive('export-snippet', handleExportSnippet);
    }
    
    return () => {
      if (window.electron) {
        window.electron.removeAllListeners('create-new-snippet');
        window.electron.removeAllListeners('open-import-dialog');
        window.electron.removeAllListeners('export-snippet');
      }
    };
  }, [handleCreateNewSnippet, handleOpenImportDialog, handleExportSnippet]);

  // Update filtered snippets when snippets or search term changes
  useEffect(() => {
    // Store the latest search term for the async operation
    const currentSearchTerm = searchTerm;
    let isCancelled = false;
    
    // Create a stable reference for comparing snippets
    const currentSnippets = snippetsRef.current;
    
    // Use memoized search function
    const updateFilteredSnippets = async () => {
      try {
        // Skip the update if snippets are empty to prevent unnecessary processing
        if (currentSnippets.length === 0) {
          if (!isCancelled && mountedRef.current) {
            setFilteredSnippets([]);
          }
          return;
        }
        
        const filtered = await searchService.searchSnippets(currentSearchTerm, currentSnippets);
        // Only update state if not cancelled and component is still mounted
        if (!isCancelled && mountedRef.current) {
          setFilteredSnippets(filtered);
        }
      } catch (error) {
        console.error('Error filtering snippets:', error);
      }
    };
    
    updateFilteredSnippets();
    
    // Cleanup function to prevent state updates after unmount or when dependencies change
    return () => {
      isCancelled = true;
    };
  }, [searchTerm, snippets]); // Add snippets as a dependency

  const loadSnippets = async () => {
    try {
      if (window.electron) {
        const loadedSnippets = await window.electron.invoke('snippets:getAll');
        setSnippets(loadedSnippets);
        setFilteredSnippets(loadedSnippets); // Also update filtered snippets when manually loading
      }
    } catch (error) {
      console.error('Failed to load snippets:', error);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleSelectSnippet = (snippet: Snippet) => {
    openTab(snippet);
  };

  const handleUpdateSnippet = async (updatedSnippet: Snippet) => {
    try {
      if (window.electron) {
        // Send update to main process
        await window.electron.invoke('snippets:update', updatedSnippet);
        
        // Update snippets state
        setSnippets(prev => {
          const updated = prev.map(s => s.id === updatedSnippet.id ? updatedSnippet : s);
          
          // Immediately update filteredSnippets based on current search term
          if (searchTerm) {
            const filtered = updated.filter(s => 
              s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
              s.content.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredSnippets(filtered);
          } else {
            // If no search term, filtered list should match full list
            setFilteredSnippets(updated);
          }
          
          return updated;
        });

        // Update the tab content
        updateTabContent(updatedSnippet.id, updatedSnippet);
      }
    } catch (error) {
      console.error('Failed to update snippet:', error);
    }
  };

  const handleDeleteSnippet = async (id: number) => {
    try {
      if (window.electron) {
        await window.electron.invoke('snippets:delete', id);
        
        // Update local state
        setSnippets(prev => {
          const newSnippets = prev.filter(s => s.id !== id);
          // Also update filtered snippets immediately
          setFilteredSnippets(current => current.filter(s => s.id !== id));
          return newSnippets;
        });
        
        // Close the tab if it's open
        if (tabExists(id)) {
          closeTab(id);
        }
      }
    } catch (error) {
      console.error('Failed to delete snippet:', error);
    }
  };

  const handleCloseImportDialog = () => {
    setImportDialogOpen(false);
  };

  const handleImportSnippets = async (importedSnippets: Partial<Snippet>[]) => {
    try {
      if (window.electron) {
        const newSnippets: Snippet[] = [];
        
        // Create each imported snippet
        for (const importedSnippet of importedSnippets) {
          const title = importedSnippet.title || 'Imported Snippet';
          const content = importedSnippet.content || '';
          const tags = importedSnippet.tags || [];
          
          const id = await window.electron.invoke('snippets:create', title, content, tags);
          const newSnippet = {
            id,
            title,
            content,
            tags,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            favorite: false
          };
          
          newSnippets.push(newSnippet);
        }
        
        // Update local state
        setSnippets(prev => [...newSnippets, ...prev]);
        
        // Open the first imported snippet in a tab if there is one
        if (newSnippets.length > 0) {
          openTab(newSnippets[0]);
        }
      }
    } catch (error) {
      console.error('Failed to import snippets:', error);
    }
  };

  const handleCloseCommandPalette = () => {
    setCommandPaletteOpen(false);
  };

  const handleCloseShortcutsHelp = () => {
    setShortcutsHelpOpen(false);
  };

  const handleCloseAboutDialog = () => {
    setAboutDialogOpen(false);
  };

  return (
    <div className="app">
      <AppMenu />
      <header className="app-header">
        <h1 className="app-title">CodexPad</h1>
        <SearchBar onSearch={handleSearch} />
        <div className="header-actions">
          <button className="import-btn" onClick={handleOpenImportDialog} title="Import from other apps">
            Import
          </button>
          <button className="new-snippet-btn" onClick={handleCreateNewSnippet}>
            New Snippet
          </button>
        </div>
      </header>
      
      <div className="app-container">
        <SnippetList 
          snippets={filteredSnippets} 
          selectedSnippet={activeSnippet} 
          onSelectSnippet={handleSelectSnippet}
          onDeleteSnippet={handleDeleteSnippet}
        />
        
        <div className="editor-container">
          <TabsBar />
          
          <SnippetEditor 
            snippet={activeSnippet} 
            onUpdateSnippet={handleUpdateSnippet}
            onDeleteSnippet={handleDeleteSnippet}
          />
          
          <SyncStatus />
          <ThemeStatus />
        </div>
      </div>

      <CommandPalette 
        isOpen={commandPaletteOpen}
        onClose={handleCloseCommandPalette}
      />

      <ShortcutsHelp
        isOpen={shortcutsHelpOpen}
        onClose={handleCloseShortcutsHelp}
      />

      <ImportDialog
        isOpen={importDialogOpen}
        onClose={handleCloseImportDialog}
        onImport={handleImportSnippets}
      />

      <AboutDialog
        isOpen={aboutDialogOpen}
        onClose={handleCloseAboutDialog}
      />
    </div>
  );
};

/**
 * Root application component that provides necessary context providers
 * and renders the main application content.
 * 
 * Features:
 * - Theme management
 * - Tab management
 * - Keyboard shortcuts
 * - Context providers
 * 
 * @component
 */
function App() {
  return (
    <ThemeProvider>
      <TabsProvider>
        <KeyboardShortcutsProvider>
          <AppContent />
        </KeyboardShortcutsProvider>
      </TabsProvider>
    </ThemeProvider>
  );
}

export default App;
