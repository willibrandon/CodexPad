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
  // Function to get a clean text preview from markdown content
  const getContentPreview = (content: string) => {
    // Remove markdown syntax for preview
    const cleanText = content
      .replace(/```[\s\S]*?```/g, '[Code Block]') // Replace code blocks
      .replace(/`([^`]+)`/g, '$1')               // Remove inline code markers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // Replace links with just the text
      .replace(/#+\s(.+)/g, '$1')                // Remove heading markers
      .replace(/(?:\*\*|__)(.*?)(?:\*\*|__)/g, '$1') // Remove bold
      .replace(/(?:\*|_)(.*?)(?:\*|_)/g, '$1')   // Remove italic
      .replace(/!\[([^\]]+)\]\([^)]+\)/g, '[Image: $1]'); // Replace images
    
    // Limit preview length
    return cleanText.length > 100 ? cleanText.slice(0, 100) + '...' : cleanText;
  };

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
            {getContentPreview(snippet.content)}
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
