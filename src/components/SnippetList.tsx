/**
 * @fileoverview A component that displays a list of code snippets with AI-powered summaries,
 * tags, and favorite status. Provides selection and deletion capabilities.
 * 
 * @module SnippetList
 */

import React, { useState, useEffect } from 'react';
import { Snippet } from '../App';
import { summarizationService } from '../services/ai/summarizationService';

/**
 * Props interface for the SnippetList component
 * @interface SnippetListProps
 */
interface SnippetListProps {
  /** Array of snippets to display */
  snippets: Snippet[];
  /** Currently selected snippet or null if none selected */
  selectedSnippet: Snippet | null;
  /** Callback function when a snippet is selected */
  onSelectSnippet: (snippet: Snippet) => void;
  /** Callback function when a snippet is deleted */
  onDeleteSnippet: (id: number) => void;
}

/**
 * A component that renders a list of code snippets with AI-generated summaries.
 * Each snippet displays its title, tags, last updated date, and a preview of its content.
 * 
 * Features:
 * - AI-powered content summarization
 * - Favorite status indication
 * - Tag display
 * - Delete functionality with confirmation
 * - Empty state handling
 * 
 * @component
 * @param {SnippetListProps} props - Component props
 * @returns {React.ReactElement} The rendered snippet list
 */
const SnippetList: React.FC<SnippetListProps> = ({
  snippets,
  selectedSnippet,
  onSelectSnippet,
  onDeleteSnippet,
}) => {
  /** Map of snippet IDs to their AI-generated summaries */
  const [summaries, setSummaries] = useState<{ [key: number]: string }>({});

  /**
   * Generates summaries for snippets that need them
   */
  useEffect(() => {
    let isMounted = true;
    
    const generateMissingSummaries = async () => {
      const newSummaries: { [key: number]: string } = { ...summaries };
      let hasChanges = false;
      
      for (const snippet of snippets) {
        // Skip if snippet has a valid summary (not undefined and not 'No content')
        if (snippet.summary && snippet.summary !== 'No content') {
          continue;
        }
        
        try {
          // Handle empty snippets
          if (!snippet.content || snippet.content.trim() === '') {
            if (!summaries[snippet.id] || summaries[snippet.id] !== 'No content') {
              newSummaries[snippet.id] = 'No content';
              hasChanges = true;
            }
            continue;
          }
          
          // Generate summary for non-empty snippets without a valid summary
          const summary = await summarizationService.summarize(snippet.content);
          
          // Only update if component is still mounted
          if (!isMounted) return;
          
          // Only update if the summary is different from what we have
          if (summary !== summaries[snippet.id]) {
            newSummaries[snippet.id] = summary;
            hasChanges = true;
          }
        } catch (error) {
          console.error(`Failed to generate summary for snippet ${snippet.id}:`, error);
          // Fall back to content preview only if we don't already have a summary
          if (!isMounted) return;
          const fallbackSummary = snippet.content ? snippet.content.slice(0, 100) + '...' : 'No content';
          if (fallbackSummary !== summaries[snippet.id]) {
            newSummaries[snippet.id] = fallbackSummary;
            hasChanges = true;
          }
        }
      }
      
      // Only update state if something has changed
      if (hasChanges && isMounted) {
        setSummaries(newSummaries);
      }
    };

    generateMissingSummaries();
    
    return () => {
      isMounted = false;
    };
  }, [snippets]); // Only depend on snippets array

  /**
   * Handles snippet deletion with confirmation
   * @param {React.MouseEvent} e - Click event
   * @param {Snippet} snippet - Snippet to delete
   */
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
            {snippet.summary || summaries[snippet.id] || (snippet.content ? snippet.content.slice(0, 100) + '...' : 'No content')}
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
