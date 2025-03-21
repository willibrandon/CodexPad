import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import './TagManager.css';
import { tagSuggestionService } from '../services/ai/tagSuggestionService';

interface TagManagerProps {
  tags: string[];
  content?: string;  // Add content prop for AI suggestions
  onTagsChange: (tags: string[]) => void;
}

const TagManager: React.FC<TagManagerProps> = memo(({
  tags = [],
  content = '',  // Default to empty string
  onTagsChange,
}) => {
  const [newTag, setNewTag] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

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
    const fetchTags = async () => {
      if (window.electron) {
        const allTags = await window.electron.invoke('snippets:getAllTags');
        if (mounted) {
          setAvailableTags(allTags || []);
        }
      }
    };
    fetchTags();
    return () => { mounted = false; };
  }, []);

  // Debounced tag suggestions with cleanup
  useEffect(() => {
    let mounted = true;
    const getSuggestions = async () => {
      if (!content || !mounted) return;
      
      setIsLoadingSuggestions(true);
      try {
        const suggestions = await tagSuggestionService.suggestTags(content, tags);
        if (mounted) {
          setSuggestedTags(suggestions);
        }
      } catch (error) {
        console.error('Failed to get tag suggestions:', error);
      } finally {
        if (mounted) {
          setIsLoadingSuggestions(false);
        }
      }
    };

    const timeoutId = setTimeout(getSuggestions, 2000);
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [content, tags]);

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
  );
});

export default TagManager; 