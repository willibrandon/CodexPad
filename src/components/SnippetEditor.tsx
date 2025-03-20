import React, { useState, useEffect, useRef } from 'react';
import { Snippet } from '../App';
import TagManager from './TagManager';
import MarkdownEditor from './MarkdownEditor';
import { useExport, ExportFormat } from '../hooks/useExport';
import './SnippetEditor.css';

interface SnippetEditorProps {
  snippet: Snippet | null;
  onUpdateSnippet: (snippet: Snippet) => void;
  onDeleteSnippet: (id: number) => void;
}

const SnippetEditor: React.FC<SnippetEditorProps> = ({ 
  snippet, 
  onUpdateSnippet, 
  onDeleteSnippet 
}) => {
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | null>(null);
  const [exportDropdownVisible, setExportDropdownVisible] = useState(false);
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

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const handleContentChange = (newContent: string) => {
    setEditedContent(newContent);
    
    if (snippet) {
      const updatedSnippet = {
        ...snippet,
        content: newContent,
        updatedAt: new Date().toISOString()
      };
      debouncedSave(updatedSnippet);
    }
  };

  const handleTagsChange = (newTags: string[]) => {
    setEditedTags(newTags);
    
    if (snippet) {
      const updatedSnippet = {
        ...snippet,
        tags: newTags,
        updatedAt: new Date().toISOString()
      };
      debouncedSave(updatedSnippet);
    }
  };

  const handleFavoriteToggle = () => {
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
  };

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
        favorite={isFavorite}
        content={editedContent}
        onTagsChange={handleTagsChange}
        onFavoriteToggle={handleFavoriteToggle}
      />
      <div className="editor-content">
        <MarkdownEditor
          content={editedContent}
          onChange={handleContentChange}
          placeholder="Write your notes here using Markdown. Code blocks with syntax highlighting are supported."
        />
      </div>
    </div>
  );
};

export default SnippetEditor;
