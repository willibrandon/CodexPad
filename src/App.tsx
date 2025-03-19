import React, { useState, useEffect } from 'react';
import './App.css';
import SearchBar from './components/SearchBar';
import SnippetList from './components/SnippetList';
import SnippetEditor from './components/SnippetEditor';
import TabsBar from './components/TabsBar';
import SyncStatus from './components/SyncStatus';
import ThemeToggle from './components/ThemeToggle';
import ThemeStatus from './components/ThemeStatus';
import { TabsProvider, useTabs } from './components/TabsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { tagSuggestionService } from './services/ai/tagSuggestionService';
import { summarizationService } from './services/ai/summarizationService';
import { SearchService } from './services/search/searchService';
import { loadLocalFonts } from './utils/fontLoader';

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
  const { openTab, activeTabId, openTabs, updateTabContent } = useTabs();

  // Get the currently active snippet
  const activeSnippet = openTabs.find(tab => tab.id === activeTabId) || null;

  // Load all snippets and initialize AI services on component mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load local fonts
        await loadLocalFonts();
        
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
    }
    
    return () => {
      if (window.electron) {
        window.electron.removeAllListeners('create-new-snippet');
      }
    };
  }, []);

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

  const handleCreateNewSnippet = async () => {
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
  };

  const handleDeleteSnippet = async (id: number) => {
    try {
      if (window.electron) {
        await window.electron.invoke('snippets:delete', id);
        
        // Update local state
        setSnippets(prev => prev.filter(s => s.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete snippet:', error);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">CodexPad</h1>
        <SearchBar onSearch={handleSearch} />
        <div className="header-actions">
          <ThemeToggle />
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
    </div>
  );
};

// Main App component wrapped with TabsProvider
function App() {
  return (
    <ThemeProvider>
      <TabsProvider>
        <AppContent />
      </TabsProvider>
    </ThemeProvider>
  );
}

export default App;
