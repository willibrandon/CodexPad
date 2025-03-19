import React from 'react';
import { Snippet } from '../App';

interface SnippetListProps {
  snippets: Snippet[];
  selectedSnippet: Snippet | null;
  onSelectSnippet: (snippet: Snippet) => void;
}

const SnippetList: React.FC<SnippetListProps> = ({ 
  snippets, 
  selectedSnippet, 
  onSelectSnippet 
}) => {
  // Format date to a readable format
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get a preview of the content (first line or first few characters)
  const getContentPreview = (content: string) => {
    const firstLine = content.split('\n')[0];
    if (firstLine.length === 0) {
      return 'Empty snippet';
    }
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
  };

  return (
    <div className="snippet-list">
      {snippets.length === 0 ? (
        <div className="empty-state">
          <h3>No snippets found</h3>
          <p>Create a new snippet to get started</p>
        </div>
      ) : (
        snippets.map(snippet => (
          <div 
            key={snippet.id}
            className={`snippet-item ${selectedSnippet && selectedSnippet.id === snippet.id ? 'active' : ''}`}
            onClick={() => onSelectSnippet(snippet)}
          >
            <h3 className="snippet-title">{snippet.title}</h3>
            <p className="snippet-preview">{getContentPreview(snippet.content)}</p>
            <div className="snippet-date">{formatDate(snippet.updatedAt)}</div>
          </div>
        ))
      )}
    </div>
  );
};

export default SnippetList;
