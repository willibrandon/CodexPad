/**
 * @fileoverview Component for managing snippet tags with AI-powered suggestions
 * and real-time updates.
 */

import React, { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import './TagManager.css';
import { tagSuggestionService } from '../services/ai/tagSuggestionService';

/**
 * Props for the TagManager component
 */
interface TagManagerProps {
  /** Array of current tags */
  tags: string[];
  /** Content to analyze for tag suggestions */
  content?: string;
  /** Callback when tags are added or removed */
  onTagsChange: (tags: string[]) => void;
}

/**
 * A component that manages tags for snippets, including adding, removing,
 * and suggesting tags based on content analysis.
 * 
 * Features:
 * - Add/remove tags
 * - AI-powered tag suggestions
 * - Tag autocomplete from existing tags
 * - Real-time updates
 * 
 * @component
 */
const TagManager: React.FC<TagManagerProps> = memo(({
  tags = [],
  content = '',  // Default to empty string
  onTagsChange,
}) => {
  const [newTag, setNewTag] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const mountedRef = useRef<boolean>(true);
  const lastContentRef = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Memoize tag operations
  const handleAddTag = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (newTag && !tags.includes(newTag)) {
      const updatedTags = [...tags, newTag];
      onTagsChange(updatedTags);
      setNewTag('');
      
      if (!availableTags.includes(newTag)) {
        setAvailableTags(prev => [...prev, newTag].sort());
      }
    }
  }, [newTag, tags, onTagsChange, availableTags]);

  const handleAddSuggestedTag = useCallback((tag: string) => {
    if (!tags.includes(tag)) {
      onTagsChange([...tags, tag]);
      setSuggestedTags(prev => prev.filter(t => t !== tag));
    }
  }, [tags, onTagsChange]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  }, [tags, onTagsChange]);

  // Fetch available tags only once on mount
  useEffect(() => {
    let mounted = true;
    mountedRef.current = true;
    
    const fetchTags = async () => {
      if (window.electron) {
        const allTags = await window.electron.invoke('snippets:getAllTags');
        if (mounted) {
          setAvailableTags(allTags || []);
        }
      }
    };
    fetchTags();
    return () => { 
      mounted = false; 
      mountedRef.current = false;
    };
  }, []);

  // Handler for getting tag suggestions (called automatically)
  const getSuggestions = useCallback(async () => {
    // Skip if empty content or not mounted
    if (!content || !mountedRef.current) return;
    
    // Skip if content hasn't changed
    if (content === lastContentRef.current) return;
    
    // Update last content reference
    lastContentRef.current = content;
    
    setIsLoadingSuggestions(true);
    try {
      // Only use a very limited portion of content for suggestions
      const trimmedContent = content.substring(0, 1500);
      const suggestions = await tagSuggestionService.suggestTags(trimmedContent, tags);
      if (mountedRef.current) {
        setSuggestedTags(suggestions);
      }
    } catch (error) {
      console.error('Failed to get tag suggestions:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoadingSuggestions(false);
      }
    }
  }, [content, tags]);

  // Automatically get suggestions when content changes (with debounce)
  useEffect(() => {
    if (!content || content.length < 50) return;
    
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set a new timer to delay suggestions (3 second debounce)
    debounceTimerRef.current = setTimeout(() => {
      getSuggestions();
    }, 3000);
    
    // Clear timer on cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [content, getSuggestions]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Memoize rendered tags
  const renderedTags = useMemo(() => (
    <div className="tags-container">
      {(tags || []).map(tag => (
        <span key={tag} className="tag">
          {tag}
          <button
            className="remove-tag"
            onClick={() => handleRemoveTag(tag)}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  ), [tags, handleRemoveTag]);

  // Memoize suggested tags - always render the container to prevent layout shift
  const renderedSuggestedTags = useMemo(() => (
    <div className="suggested-tags-container">
      {(suggestedTags.length > 0 || isLoadingSuggestions) && (
        <div className="suggested-tags">
          <span className="suggested-tags-label">
            {isLoadingSuggestions ? 'Getting suggestions...' : 'Suggested tags:'}
          </span>
          {suggestedTags.map(tag => (
            <button
              key={tag}
              className="suggested-tag"
              onClick={() => handleAddSuggestedTag(tag)}
              title="Click to add this tag"
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  ), [suggestedTags, isLoadingSuggestions, handleAddSuggestedTag]);

  return (
    <div className="tag-manager">
      {renderedTags}
      {renderedSuggestedTags}
      
      <div className="tag-manager-controls">
        <form onSubmit={handleAddTag} className="add-tag-form">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add a tag..."
            list="available-tags"
          />
          <datalist id="available-tags">
            {availableTags.map(tag => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
          <button type="submit">Add</button>
        </form>
      </div>
    </div>
  );
});

export default TagManager; 