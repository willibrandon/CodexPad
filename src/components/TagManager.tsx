import React, { useState, useEffect } from 'react';
import './TagManager.css';

interface TagManagerProps {
  tags: string[];
  favorite: boolean;
  onTagsChange: (tags: string[]) => void;
  onFavoriteToggle: () => void;
}

const TagManager: React.FC<TagManagerProps> = ({
  tags = [],
  favorite = false,
  onTagsChange,
  onFavoriteToggle,
}) => {
  const [newTag, setNewTag] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);

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