import React, { useState, useEffect, useCallback } from 'react';
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
import { TabsProvider, useTabs } from './components/TabsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { KeyboardShortcutsProvider, useKeyboardShortcuts } from './contexts/KeyboardShortcutsContext';
import { tagSuggestionService } from './services/ai/tagSuggestionService';
import { summarizationService } from './services/ai/summarizationService';
import { SearchService } from './services/search/searchService';
import AppMenu from './components/AppMenu';

// Define TypeScript interfaces for our data
export interface Snippet {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  favorite: boolean;
}

// Import our custom electron TypeScript definitions
import './electron.d.ts';

const searchService = new SearchService();

// Inner App component that uses the tabs context
const AppContent: React.FC = () => {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSnippets, setFilteredSnippets] = useState<Snippet[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { openTab, activeTabId, openTabs, updateTabContent, closeTab, tabExists } = useTabs();
  const { 
    commandPaletteOpen, 
    setCommandPaletteOpen, 
    shortcutsHelpOpen, 
    setShortcutsHelpOpen 
  } = useKeyboardShortcuts();

  // Get the currently active snippet
  const activeSnippet = openTabs.find(tab => tab.id === activeTabId) || null;

  // Handler function for creating a new snippet
  const handleCreateNewSnippet = useCallback(async () => {
    try {
      if (window.electron) {
        const newTitle = 'New Snippet';
        const newContent = '';
        const newTags: string[] = [];
        
        const id = await window.electron.invoke('snippets:create', newTitle, newContent, newTags);
        const newSnippet = {
          id,
          title: newTitle,
          content: newContent,
          tags: newTags,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          favorite: false
        };
        
        // Update local state
        setSnippets(prev => [newSnippet, ...prev]);
        
        // Open the new snippet in a tab
        openTab(newSnippet);
      }
    } catch (error) {
      console.error('Failed to create new snippet:', error);
    }
  }, [openTab]);

  // Handler for opening the import dialog
  const handleOpenImportDialog = useCallback(() => {
    setImportDialogOpen(true);
  }, []);

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
          setSnippets(loadedSnippets);
          
          // Initialize AI services with loaded snippets
          await Promise.all([
            tagSuggestionService.initialize(loadedSnippets),
            summarizationService.initialize(loadedSnippets)
          ]);
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
    const updateFilteredSnippets = async () => {
      const filtered = await searchService.searchSnippets(searchTerm, snippets);
      setFilteredSnippets(filtered);
    };
    
    updateFilteredSnippets();
  }, [snippets, searchTerm]);

  const loadSnippets = async () => {
    try {
      if (window.electron) {
        const loadedSnippets = await window.electron.invoke('snippets:getAll');
        setSnippets(loadedSnippets);
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
        await window.electron.invoke('snippets:update', updatedSnippet);
        
        // Update local state
        setSnippets(prev => 
          prev.map(s => s.id === updatedSnippet.id ? updatedSnippet : s)
        );
        
        // Update the tab state if it's open
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
        setSnippets(prev => prev.filter(s => s.id !== id));
        
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
    </div>
  );
};

// Main App component wrapped with providers
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
