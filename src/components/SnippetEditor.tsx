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
  const { updateTabContent, updateEditorState } = useTabs();
  /** Title of the snippet being edited */
  const [editedTitle, setEditedTitle] = useState('');
  
  /** Content of the snippet being edited */
  const [editedContent, setEditedContent] = useState('');
  
  /** Tags associated with the snippet */
  const [editedTags, setEditedTags] = useState<string[]>([]);
  
  /** Favorite status of the snippet */
  const [isFavorite, setIsFavorite] = useState(false);
  
  /** Timeout ID for debounced saving */
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  
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
  
  // Update local state when snippet changes
  useEffect(() => {
    if (snippet) {
      setEditedTitle(snippet.title);
      setEditedContent(snippet.content);
      setEditedTags(snippet.tags || []);
      setIsFavorite(snippet.favorite || false);
      setSaveStatus('saved');
    } else {
      setEditedTitle('');
      setEditedContent('');
      setEditedTags([]);
      setIsFavorite(false);
      setSaveStatus(null);
    }
  }, [snippet]);

  // Clear save status after showing "Saved"
  useEffect(() => {
    if (saveStatus === 'saved') {
      const timeout = setTimeout(() => {
        setSaveStatus(null);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [saveStatus]);

  // Debounced save function to prevent too many updates
  const debouncedSave = (updatedSnippet: Snippet) => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    setSaveStatus('saving');
    
    const timeoutId = setTimeout(() => {
      onUpdateSnippet(updatedSnippet);
      setSaveStatus('saved');
    }, 1500); // 1.5 second debounce
    
    setSaveTimeout(timeoutId);
  };

  // Memoize callbacks
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setEditedTitle(newTitle);
    
    if (snippet) {
      const updatedSnippet = {
        ...snippet,
        title: newTitle,
        updatedAt: new Date().toISOString()
      };
      debouncedSave(updatedSnippet);
    }
  }, [snippet, debouncedSave]);

  const handleContentChange = useCallback((newContent: string) => {
    setEditedContent(newContent);
    
    if (snippet) {
      const updatedSnippet = {
        ...snippet,
        content: newContent,
        updatedAt: new Date().toISOString()
      };
      debouncedSave(updatedSnippet);
    }
  }, [snippet, debouncedSave]);

  const handleTagsChange = useCallback((newTags: string[]) => {
    setEditedTags(newTags);
    
    if (snippet) {
      const updatedSnippet = {
        ...snippet,
        tags: newTags,
        updatedAt: new Date().toISOString()
      };
      debouncedSave(updatedSnippet);
    }
  }, [snippet, debouncedSave]);

  const handleFavoriteToggle = useCallback(() => {
    const newFavorite = !isFavorite;
    setIsFavorite(newFavorite);
    
    if (snippet) {
      const updatedSnippet = {
        ...snippet,
        favorite: newFavorite,
        updatedAt: new Date().toISOString()
      };
      debouncedSave(updatedSnippet);
    }
  }, [snippet, isFavorite, debouncedSave]);

  const handleDelete = () => {
    if (snippet && window.confirm('Are you sure you want to delete this snippet?')) {
      onDeleteSnippet(snippet.id);
    }
  };
  
  const handleExportDropdownToggle = () => {
    setExportDropdownVisible(prev => !prev);
  };
  
  const handleExport = async (format: ExportFormat) => {
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
          message: result.error || `Failed to export as ${format}`,
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
  };

  // Add handler for editor state changes
  const handleEditorStateChange = useCallback((state: { isPreviewMode: boolean; textareaRef: React.RefObject<HTMLTextAreaElement> }) => {
    if (snippet) {
      // Update the editor state in the TabsContext
      updateEditorState(snippet.id, state);
    }
  }, [snippet, updateEditorState]);

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
            type="text"
            className="editor-title"
            value={editedTitle}
            onChange={handleTitleChange}
            placeholder="Untitled"
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
