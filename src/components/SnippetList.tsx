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
  onSelectSnippet,
}) => {
  return (
    <div className="snippet-list">
      {snippets.map((snippet) => (
        <div
          key={snippet.id}
          className={`snippet-item ${selectedSnippet?.id === snippet.id ? 'selected' : ''}`}
          onClick={() => onSelectSnippet(snippet)}
        >
          <div className="snippet-header">
            <span className="snippet-title">
              {snippet.favorite && <span className="favorite-star">★</span>}
              {snippet.title || 'Untitled'}
            </span>
            <span className="snippet-date">
              {new Date(snippet.updatedAt).toLocaleDateString()}
            </span>
          </div>
          {snippet.tags.length > 0 && (
            <div className="snippet-tags">
              {snippet.tags.map(tag => (
                <span key={tag} className="snippet-tag">{tag}</span>
              ))}
            </div>
          )}
          <div className="snippet-preview">
            {snippet.content.slice(0, 100)}
            {snippet.content.length > 100 && '...'}
          </div>
        </div>
      ))}
      {snippets.length === 0 && (
        <div className="empty-state">
          <p>No snippets found</p>
        </div>
      )}
    </div>
  );
};

export default SnippetList;
