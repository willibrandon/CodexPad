/**
 * @fileoverview Context provider for managing tab state and operations
 * including opening, closing, and switching between tabs.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snippet } from '../App';

/**
 * Represents the state of a snippet editor
 */
interface EditorState {
  /** Whether the editor is in preview mode */
  isPreviewMode: boolean;
  /** Reference to the textarea element */
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

/**
 * Context type definition for tab management
 */
interface TabsContextType {
  /** Array of currently open snippets */
  openTabs: Snippet[];
  /** ID of the currently active tab, or null if no tab is active */
  activeTabId: number | null;
  /** Opens a new tab with the given snippet */
  openTab: (snippet: Snippet) => void;
  /** Closes the tab with the given ID */
  closeTab: (id: number) => void;
  /** Sets the active tab to the given ID */
  setActiveTab: (id: number) => void;
  /** Updates the content of a tab */
  updateTabContent: (id: number, updatedSnippet: Snippet) => void;
  /** Checks if a tab with the given ID exists */
  tabExists: (id: number) => boolean;
  /** Gets the editor state of the active tab */
  getActiveEditor: () => EditorState | undefined;
  /** Updates the editor state for a specific tab */
  updateEditorState: (id: number, state: EditorState) => void;
}

/**
 * Context for managing tab state and operations
 */
const TabsContext = createContext<TabsContextType | undefined>(undefined);

/**
 * Provider component that manages tab state and operations
 * Handles opening, closing, and switching between tabs, as well as
 * maintaining editor state for each tab.
 * 
 * @component
 */
export const TabsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [openTabs, setOpenTabs] = useState<Snippet[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [editorStates, setEditorStates] = useState<Map<number, EditorState>>(new Map());

  const openTab = (snippet: Snippet) => {
    if (!openTabs.some(tab => tab.id === snippet.id)) {
      setOpenTabs(prev => [...prev, snippet]);
    }
    setActiveTabId(snippet.id);
  };

  const closeTab = (id: number) => {
    setOpenTabs(prev => prev.filter(tab => tab.id !== id));
    setEditorStates(prev => {
      const newStates = new Map(prev);
      newStates.delete(id);
      return newStates;
    });
    
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

  const getActiveEditor = () => {
    if (activeTabId === null) return undefined;
    return editorStates.get(activeTabId);
  };

  const updateEditorState = useCallback((id: number, state: EditorState) => {
    setEditorStates(prev => {
      // Skip update if the state hasn't changed
      const currentState = prev.get(id);
      if (currentState && 
          currentState.isPreviewMode === state.isPreviewMode && 
          currentState.textareaRef === state.textareaRef) {
        return prev; // Return existing state to avoid unnecessary updates
      }
      
      // Otherwise, update with new state
      const newStates = new Map(prev);
      newStates.set(id, state);
      return newStates;
    });
  }, []);

  return (
    <TabsContext.Provider 
      value={{ 
        openTabs, 
        activeTabId, 
        openTab, 
        closeTab, 
        setActiveTab, 
        updateTabContent,
        tabExists,
        getActiveEditor,
        updateEditorState
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