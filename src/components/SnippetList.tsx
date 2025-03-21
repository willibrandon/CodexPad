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
   * Generates summaries for all snippets using AI service
   * Falls back to content preview if summarization fails
   */
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
