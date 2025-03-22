/**
 * @fileoverview A full-featured snippet editor component that provides editing, tagging,
 * and export capabilities for code snippets. Includes real-time saving, markdown editing,
 * and export functionality.
 * 
 * @module SnippetEditor
 */

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Snippet } from '../App';
import TagManager from './TagManager';
import MarkdownEditor from './MarkdownEditor';
import { useExport, ExportFormat } from '../hooks/useExport';
import { useTabs } from './TabsContext';
import './SnippetEditor.css';

/**
 * Props interface for the SnippetEditor component
 * @interface SnippetEditorProps
 */
interface SnippetEditorProps {
  /** The snippet to edit, or null if no snippet is selected */
  snippet: Snippet | null;
  /** Callback function to handle snippet updates */
  onUpdateSnippet: (snippet: Snippet) => void;
  /** Callback function to handle snippet deletion */
  onDeleteSnippet: (id: number) => void;
}

/**
 * A comprehensive editor component for managing code snippets.
 * Provides functionality for editing, tagging, favoriting, and exporting snippets.
 * 
 * Features:
 * - Real-time saving with debounce
 * - Markdown editing with preview
 * - Tag management
 * - Export to multiple formats (Markdown, HTML, PDF)
 * - Favorite/unfavorite functionality
 * - Save status indicators
 * 
 * @component
 * @param {SnippetEditorProps} props - Component props
 * @returns {React.ReactElement} The rendered snippet editor
 */
const SnippetEditor: React.FC<SnippetEditorProps> = memo(({ 
  snippet, 
  onUpdateSnippet, 
  onDeleteSnippet 
}) => {
  console.log('SnippetEditor rendering with snippet ID:', snippet?.id);

  const { updateTabContent, updateEditorState } = useTabs();
  
  /** Title of the snippet being edited */
  const [editedTitle, setEditedTitle] = useState('');
  
  /** Reference to the title input element */
  const titleInputRef = useRef<HTMLInputElement>(null);
  
  /** Track if initial focus/select has been done */
  const hasInitialFocusRef = useRef(false);
  
  /** Track previous snippet ID for true change detection */
  const prevSnippetIdRef = useRef<number | null>(null);
  
  /** Content of the snippet being edited */
  const [editedContent, setEditedContent] = useState('');
  
  /** Tags associated with the snippet */
  const [editedTags, setEditedTags] = useState<string[]>([]);
  
  /** Favorite status of the snippet */
  const [isFavorite, setIsFavorite] = useState(false);
  
  /** Timeout IDs for debounced saving */
  const [titleSaveTimeout, setTitleSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [contentSaveTimeout, setContentSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  
  /** Current save status indicator */
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | null>(null);
  
  /** Controls visibility of the export dropdown */
  const [exportDropdownVisible, setExportDropdownVisible] = useState(false);
  
  /** Export operation status and feedback */
  const [exportStatus, setExportStatus] = useState<{
    status: 'idle' | 'exporting' | 'success' | 'error';
    message?: string;
    format?: ExportFormat;
  }>({
    status: 'idle'
  });
  
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const { exportSnippet } = useExport();
  
  // Listen for clicks outside the export dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setExportDropdownVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Clear export status message after 3 seconds
  useEffect(() => {
    if (exportStatus.status === 'success' || exportStatus.status === 'error') {
      const timer = setTimeout(() => {
        setExportStatus({ status: 'idle' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [exportStatus]);
  
  // Update local state ONLY on genuine ID changes
  useEffect(() => {
    const currentId = snippet?.id ?? null;
    const prevId = prevSnippetIdRef.current;

    console.log('Snippet change detected:', { 
      currentId, 
      prevId, 
      title: snippet?.title,
      editedTitle 
    });

    // Only update if ID actually changed
    if (currentId !== prevId) {
      console.log('Genuine snippet ID change, updating local state');
      
      if (snippet) {
        setEditedTitle(snippet.title);
        setEditedContent(snippet.content);
        setEditedTags(snippet.tags || []);
        setIsFavorite(snippet.favorite || false);
        setSaveStatus('saved');
        
        // Reset focus flag for new snippets
        if (snippet.title === 'New Snippet') {
          hasInitialFocusRef.current = false;
        }
      } else {
        setEditedTitle('');
        setEditedContent('');
        setEditedTags([]);
        setIsFavorite(false);
        setSaveStatus(null);
      }
      
      prevSnippetIdRef.current = currentId;
    }
  }, [snippet?.id]); // Only depend on ID changes

  // Handle one-time focus and selection for new snippets
  useEffect(() => {
    if (snippet?.title === 'New Snippet' && !hasInitialFocusRef.current && titleInputRef.current) {
      console.log('Applying initial focus and selection');
      
      // Mark that we've handled initial focus
      hasInitialFocusRef.current = true;
      
      // Small timeout to ensure DOM and React updates are complete
      setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
          titleInputRef.current.select();
        }
      }, 100);
    }
  }, [snippet?.title]);

  // Clear save status after showing "Saved"
  useEffect(() => {
    if (saveStatus === 'saved') {
      const timeout = setTimeout(() => {
        setSaveStatus(null);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [saveStatus]);

  // Debounced save functions with different timings for different types of changes
  const debouncedSaveTitle = useCallback((updatedSnippet: Snippet) => {
    if (titleSaveTimeout) {
      clearTimeout(titleSaveTimeout);
    }
    
    setSaveStatus('saving');
    
    const timeoutId = setTimeout(() => {
      onUpdateSnippet(updatedSnippet);
      setSaveStatus('saved');
    }, 300); // 300ms debounce for title changes
    
    setTitleSaveTimeout(timeoutId);
  }, [titleSaveTimeout, onUpdateSnippet]);

  const debouncedSaveContent = useCallback((updatedSnippet: Snippet) => {
    if (contentSaveTimeout) {
      clearTimeout(contentSaveTimeout);
    }
    
    setSaveStatus('saving');
    
    const timeoutId = setTimeout(() => {
      onUpdateSnippet(updatedSnippet);
      setSaveStatus('saved');
    }, 1500); // 1.5 second debounce for content changes
    
    setContentSaveTimeout(timeoutId);
  }, [contentSaveTimeout, onUpdateSnippet]);

  // Memoize callbacks with proper dependencies
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    console.log('handleTitleChange fired:', { 
      newTitle, 
      currentTitle: editedTitle,
      snippetId: snippet?.id 
    });
    
    setEditedTitle(newTitle);
    
    if (snippet) {
      const updatedSnippet = {
        ...snippet,
        title: newTitle,
        updatedAt: new Date().toISOString()
      };
      debouncedSaveTitle(updatedSnippet);
    }
  }, [snippet, debouncedSaveTitle]);

  const handleContentChange = useCallback((newContent: string) => {
    setEditedContent(newContent);
    
    if (snippet) {
      const updatedSnippet = {
        ...snippet,
        content: newContent,
        updatedAt: new Date().toISOString()
      };
      debouncedSaveContent(updatedSnippet);
    }
  }, [snippet, debouncedSaveContent]);

  const handleTagsChange = useCallback((newTags: string[]) => {
    setEditedTags(newTags);
    
    if (snippet) {
      const updatedSnippet = {
        ...snippet,
        tags: newTags,
        updatedAt: new Date().toISOString()
      };
      debouncedSaveTitle(updatedSnippet); // Use shorter debounce for tags
    }
  }, [snippet, debouncedSaveTitle]);

  const handleFavoriteToggle = useCallback(() => {
    const newFavorite = !isFavorite;
    setIsFavorite(newFavorite);
    
    if (snippet) {
      const updatedSnippet = {
        ...snippet,
        favorite: newFavorite,
        updatedAt: new Date().toISOString()
      };
      debouncedSaveTitle(updatedSnippet); // Use shorter debounce for favorite toggle
    }
  }, [snippet, isFavorite, debouncedSaveTitle]);

  const handleDelete = useCallback(() => {
    if (snippet && window.confirm('Are you sure you want to delete this snippet?')) {
      onDeleteSnippet(snippet.id);
    }
  }, [snippet, onDeleteSnippet]);
  
  const handleExportDropdownToggle = useCallback(() => {
    setExportDropdownVisible(prev => !prev);
  }, []);
  
  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!snippet) return;
    
    setExportStatus({
      status: 'exporting',
      format
    });
    
    setExportDropdownVisible(false);
    
    try {
      const result = await exportSnippet(snippet, format);
      
      if (result.success) {
        setExportStatus({
          status: 'success',
          message: `Exported as ${format.toUpperCase()} successfully`,
          format
        });
      } else {
        setExportStatus({
          status: 'error',
          message: result.error || `Export as ${format} failed`,
          format
        });
      }
    } catch (error: any) {
      setExportStatus({
        status: 'error',
        message: error.message || `Export as ${format} failed`,
        format
      });
    }
  }, [snippet, exportSnippet]);

  // Add handler for editor state changes
  const handleEditorStateChange = useCallback((state: { isPreviewMode: boolean; textareaRef: React.RefObject<HTMLTextAreaElement> }) => {
    if (snippet) {
      // Update the editor state in the TabsContext
      // Use ID instead of the entire snippet to reduce dependency changes
      const snippetId = snippet.id;
      updateEditorState(snippetId, state);
    }
  }, [snippet?.id, updateEditorState]); // Only depend on the ID, not the entire snippet object

  // Clean up timeouts when component unmounts or snippet changes
  useEffect(() => {
    return () => {
      if (titleSaveTimeout) clearTimeout(titleSaveTimeout);
      if (contentSaveTimeout) clearTimeout(contentSaveTimeout);
    };
  }, [titleSaveTimeout, contentSaveTimeout]);

  if (!snippet) {
    return (
      <div className="snippet-editor">
        <div className="empty-state">
          <h3>No snippet selected</h3>
          <p>Select a snippet from the list or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="snippet-editor">
      <div className="editor-header">
        <div className="editor-header-left">
          <button
            className={`favorite-button ${isFavorite ? 'active' : ''}`}
            onClick={handleFavoriteToggle}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? '★' : '☆'}
          </button>
          <input
            ref={titleInputRef}
            type="text"
            className="editor-title"
            value={editedTitle}
            onChange={handleTitleChange}
            placeholder="Untitled"
            onKeyDown={(e) => console.log('Key down on title input:', e.key)}
          />
          {saveStatus && (
            <span className={`save-status ${saveStatus}`}>
              {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
            </span>
          )}
        </div>
        <div className="editor-header-right">
          <div className="export-dropdown-container" ref={exportDropdownRef}>
            <button 
              className="export-btn" 
              onClick={handleExportDropdownToggle}
              title="Export snippet"
            >
              Export
            </button>
            {exportDropdownVisible && (
              <div className="export-dropdown">
                <button onClick={() => handleExport('markdown')}>
                  Export as Markdown
                </button>
                <button onClick={() => handleExport('html')}>
                  Export as HTML
                </button>
                <button onClick={() => handleExport('pdf')}>
                  Export as PDF
                </button>
              </div>
            )}
          </div>
          <button className="delete-btn" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>
      
      {exportStatus.status !== 'idle' && (
        <div className={`export-status ${exportStatus.status}`}>
          {exportStatus.status === 'exporting' 
            ? `Exporting as ${exportStatus.format?.toUpperCase()}...` 
            : exportStatus.message
          }
        </div>
      )}
      
      <TagManager
        tags={editedTags}
        content={editedContent}
        onTagsChange={handleTagsChange}
      />
      <div className="editor-content">
        <MarkdownEditor
          content={editedContent}
          onChange={handleContentChange}
          placeholder="Write your notes here using Markdown. Code blocks with syntax highlighting are supported."
          onEditorStateChange={handleEditorStateChange}
        />
      </div>
    </div>
  );
});

export default SnippetEditor;