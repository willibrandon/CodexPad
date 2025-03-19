import React, { createContext, useContext, useState } from 'react';
import { Snippet } from '../App';

interface TabsContextType {
  openTabs: Snippet[];
  activeTabId: number | null;
  openTab: (snippet: Snippet) => void;
  closeTab: (id: number) => void;
  setActiveTab: (id: number) => void;
  updateTabContent: (id: number, updatedSnippet: Snippet) => void;
  tabExists: (id: number) => boolean;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export const TabsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [openTabs, setOpenTabs] = useState<Snippet[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  const openTab = (snippet: Snippet) => {
    if (!openTabs.some(tab => tab.id === snippet.id)) {
      setOpenTabs(prev => [...prev, snippet]);
    }
    setActiveTabId(snippet.id);
  };

  const closeTab = (id: number) => {
    setOpenTabs(prev => prev.filter(tab => tab.id !== id));
    
    if (activeTabId === id) {
      const remainingTabs = openTabs.filter(tab => tab.id !== id);
      if (remainingTabs.length > 0) {
        setActiveTabId(remainingTabs[remainingTabs.length - 1].id);
      } else {
        setActiveTabId(null);
      }
    }
  };

  const setActiveTab = (id: number) => {
    if (openTabs.some(tab => tab.id === id)) {
      setActiveTabId(id);
    }
  };

  const updateTabContent = (id: number, updatedSnippet: Snippet) => {
    setOpenTabs(prev => 
      prev.map(tab => tab.id === id ? updatedSnippet : tab)
    );
  };

  const tabExists = (id: number): boolean => {
    return openTabs.some(tab => tab.id === id);
  };

  return (
    <TabsContext.Provider 
      value={{ 
        openTabs, 
        activeTabId, 
        openTab, 
        closeTab, 
        setActiveTab, 
        updateTabContent,
        tabExists
      }}
    >
      {children}
    </TabsContext.Provider>
  );
};

export const useTabs = (): TabsContextType => {
  const context = useContext(TabsContext);
  if (context === undefined) {
    throw new Error('useTabs must be used within a TabsProvider');
  }
  return context;
}; 