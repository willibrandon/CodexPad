import React, { useState, useEffect } from 'react';
import { Snippet } from '../App';

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
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Update local state when snippet changes
  useEffect(() => {
    if (snippet) {
      setEditedTitle(snippet.title);
      setEditedContent(snippet.content);
    } else {
      setEditedTitle('');
      setEditedContent('');
    }
  }, [snippet]);

  // Debounced save function to prevent too many updates
  const debouncedSave = (updatedSnippet: Snippet) => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    const timeoutId = setTimeout(() => {
      onUpdateSnippet(updatedSnippet);
    }, 500); // 500ms debounce
    
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

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
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

  const handleDelete = () => {
    if (snippet && window.confirm('Are you sure you want to delete this snippet?')) {
      onDeleteSnippet(snippet.id);
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
        <input
          type="text"
          className="editor-title"
          value={editedTitle}
          onChange={handleTitleChange}
          placeholder="Untitled"
        />
        <button className="delete-btn" onClick={handleDelete}>
          Delete
        </button>
      </div>
      <div className="editor-content">
        <textarea
          className="editor-textarea"
          value={editedContent}
          onChange={handleContentChange}
          placeholder="Write your notes here..."
          autoFocus
        />
      </div>
    </div>
  );
};

export default SnippetEditor;
