import React, { useState, useEffect } from 'react';
import { Snippet } from '../App';
import { summarizationService } from '../services/ai/summarizationService';

interface SnippetListProps {
  snippets: Snippet[];
  selectedSnippet: Snippet | null;
  onSelectSnippet: (snippet: Snippet) => void;
  onDeleteSnippet: (id: number) => void;
}

const SnippetList: React.FC<SnippetListProps> = ({
  snippets,
  selectedSnippet,
  onSelectSnippet,
  onDeleteSnippet,
}) => {
  const [summaries, setSummaries] = useState<{ [key: number]: string }>({});

  // Get summaries for all snippets
  useEffect(() => {
    const generateSummaries = async () => {
      const newSummaries: { [key: number]: string } = {};
      
      for (const snippet of snippets) {
        try {
          // Handle empty snippets
          if (!snippet.content || snippet.content.trim() === '') {
            newSummaries[snippet.id] = 'No content';
            continue;
          }
          
          const summary = await summarizationService.summarize(snippet.content);
          newSummaries[snippet.id] = summary;
        } catch (error) {
          console.error(`Failed to generate summary for snippet ${snippet.id}:`, error);
          // Fall back to first few characters if summarization fails
          newSummaries[snippet.id] = snippet.content ? snippet.content.slice(0, 100) + '...' : 'No content';
        }
      }
      
      setSummaries(newSummaries);
    };

    generateSummaries();
  }, [snippets]);

  const handleDelete = (e: React.MouseEvent, snippet: Snippet) => {
    e.stopPropagation(); // Prevent snippet selection when deleting
    if (window.confirm(`Are you sure you want to delete "${snippet.title || 'Untitled'}"?`)) {
      onDeleteSnippet(snippet.id);
    }
  };

  return (
    <div className="snippet-list">
      {snippets.map((snippet) => (
        <div
          key={snippet.id}
          className={`snippet-item ${selectedSnippet?.id === snippet.id ? 'active' : ''}`}
          onClick={() => onSelectSnippet(snippet)}
        >
          <div className="snippet-header">
            <span className="snippet-title">
              {snippet.favorite && <span className="favorite-star">★</span>}
              {snippet.title || 'Untitled'}
            </span>
            <div className="snippet-actions">
              <span className="snippet-date">
                {new Date(snippet.updatedAt).toLocaleDateString()}
              </span>
              <button 
                className="snippet-delete-btn"
                onClick={(e) => handleDelete(e, snippet)}
                title="Delete snippet"
              >
                ×
              </button>
            </div>
          </div>
          {snippet.tags.length > 0 && (
            <div className="snippet-tags">
              {snippet.tags.map(tag => (
                <span key={tag} className="snippet-tag">{tag}</span>
              ))}
            </div>
          )}
          <div className="snippet-preview">
            {summaries[snippet.id] || (snippet.content ? 'Loading preview...' : 'No content')}
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
