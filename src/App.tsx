import React, { useState, useEffect } from 'react';
import './App.css';
import SearchBar from './components/SearchBar';
import SnippetList from './components/SnippetList';
import SnippetEditor from './components/SnippetEditor';

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

function App() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSnippets, setFilteredSnippets] = useState<Snippet[]>([]);

  // Load all snippets on component mount
  useEffect(() => {
    loadSnippets();
    
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
    if (searchTerm.trim() === '') {
      setFilteredSnippets(snippets);
    } else {
      // Client-side filtering (can be replaced with DB search)
      const filtered = snippets.filter(snippet => 
        snippet.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        snippet.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredSnippets(filtered);
    }
  }, [snippets, searchTerm]);

  const loadSnippets = async () => {
    try {
      if (window.electron) {
        const loadedSnippets = await window.electron.invoke('snippets:getAll');
        setSnippets(loadedSnippets);
        
        // Select the first snippet if available and none is selected
        if (loadedSnippets.length > 0 && !selectedSnippet) {
          setSelectedSnippet(loadedSnippets[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load snippets:', error);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleSelectSnippet = (snippet: Snippet) => {
    setSelectedSnippet(snippet);
  };

  const handleUpdateSnippet = async (updatedSnippet: Snippet) => {
    try {
      if (window.electron) {
        await window.electron.invoke('snippets:update', updatedSnippet);
        
        // Update local state
        setSnippets(prev => 
          prev.map(s => s.id === updatedSnippet.id ? updatedSnippet : s)
        );
        setSelectedSnippet(updatedSnippet);
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
        setSelectedSnippet(newSnippet);
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
        const updatedSnippets = snippets.filter(s => s.id !== id);
        setSnippets(updatedSnippets);
        
        // If the deleted snippet was selected, select another one
        if (selectedSnippet && selectedSnippet.id === id) {
          setSelectedSnippet(updatedSnippets.length > 0 ? updatedSnippets[0] : null);
        }
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
        <button className="new-snippet-btn" onClick={handleCreateNewSnippet}>
          New Snippet
        </button>
      </header>
      
      <div className="app-container">
        <SnippetList 
          snippets={filteredSnippets} 
          selectedSnippet={selectedSnippet} 
          onSelectSnippet={handleSelectSnippet}
        />
        
        <SnippetEditor 
          snippet={selectedSnippet} 
          onUpdateSnippet={handleUpdateSnippet}
          onDeleteSnippet={handleDeleteSnippet}
        />
      </div>
    </div>
  );
}

export default App;
