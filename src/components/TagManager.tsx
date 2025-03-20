import React, { useState, useEffect, useCallback } from 'react';
import './TagManager.css';
import { tagSuggestionService } from '../services/ai/tagSuggestionService';

interface TagManagerProps {
  tags: string[];
  favorite: boolean;
  content?: string;  // Add content prop for AI suggestions
  onTagsChange: (tags: string[]) => void;
  onFavoriteToggle: () => void;
}

const TagManager: React.FC<TagManagerProps> = ({
  tags = [],
  favorite = false,
  content = '',  // Default to empty string
  onTagsChange,
  onFavoriteToggle,
}) => {
  const [newTag, setNewTag] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  useEffect(() => {
    // Fetch all available tags when component mounts
    const fetchTags = async () => {
      if (window.electron) {
        const allTags = await window.electron.invoke('snippets:getAllTags');
        setAvailableTags(allTags || []);
      }
    };
    fetchTags();
  }, []);

  // Get AI suggestions when content changes
  useEffect(() => {
    const debouncedSuggestions = setTimeout(async () => {
      if (content) {
        setIsLoadingSuggestions(true);
        try {
          const suggestions = await tagSuggestionService.suggestTags(content, tags);
          setSuggestedTags(suggestions);
        } catch (error) {
          console.error('Failed to get tag suggestions:', error);
        } finally {
          setIsLoadingSuggestions(false);
        }
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(debouncedSuggestions);
  }, [content, tags]);

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTag && !tags.includes(newTag)) {
      const updatedTags = [...tags, newTag];
      onTagsChange(updatedTags);
      setNewTag('');
      
      // Add to available tags if it's new
      if (!availableTags.includes(newTag)) {
        setAvailableTags([...availableTags, newTag].sort());
      }
    }
  };

  const handleAddSuggestedTag = (tag: string) => {
    if (!tags.includes(tag)) {
      const updatedTags = [...tags, tag];
      onTagsChange(updatedTags);
      setSuggestedTags(suggestedTags.filter(t => t !== tag));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = tags.filter(tag => tag !== tagToRemove);
    onTagsChange(updatedTags);
  };

  return (
    <div className="tag-manager">
      <div className="favorite-toggle">
        <button
          className={`favorite-button ${favorite ? 'active' : ''}`}
          onClick={onFavoriteToggle}
          title={favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {favorite ? '★' : '☆'}
        </button>
      </div>
      
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
      
      {suggestedTags.length > 0 && (
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
};

export default TagManager; 