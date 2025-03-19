import React, { useState, useEffect, useRef } from 'react';
import { useKeyboardShortcuts, KeyboardShortcut, ShortcutCategory } from '../contexts/KeyboardShortcutsContext';
import './CommandPalette.css';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const { shortcuts } = useKeyboardShortcuts();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCommands, setFilteredCommands] = useState<KeyboardShortcut[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedCommandRef = useRef<HTMLDivElement>(null);

  // Filter commands when search term changes
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCommands([...shortcuts]);
    } else {
      const lowerCaseSearch = searchTerm.toLowerCase();
      const filtered = shortcuts.filter(shortcut => 
        shortcut.name.toLowerCase().includes(lowerCaseSearch) ||
        shortcut.description.toLowerCase().includes(lowerCaseSearch) ||
        shortcut.category.toLowerCase().includes(lowerCaseSearch)
      );
      setFilteredCommands(filtered);
    }
    setSelectedIndex(0);
  }, [searchTerm, shortcuts]);

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll to selected item
  useEffect(() => {
    if (selectedCommandRef.current) {
      selectedCommandRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Escape to close
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    // Arrow up/down to navigate
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < filteredCommands.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
    }

    // Enter to execute
    if (e.key === 'Enter' && filteredCommands.length > 0) {
      const selectedCommand = filteredCommands[selectedIndex];
      if (selectedCommand) {
        selectedCommand.action();
        onClose();
      }
    }
  };

  // Render the shortcut keys
  const renderShortcut = (shortcut: KeyboardShortcut) => {
    return (
      <div className="command-shortcut">
        {shortcut.keys.map((key, index) => (
          <span key={index} className="key">{key}</span>
        ))}
      </div>
    );
  };

  // Group commands by category
  const getCommandsByCategory = () => {
    const grouped: Record<string, KeyboardShortcut[]> = {};
    
    filteredCommands.forEach(cmd => {
      if (!grouped[cmd.category]) {
        grouped[cmd.category] = [];
      }
      grouped[cmd.category].push(cmd);
    });
    
    return grouped;
  };

  if (!isOpen) return null;

  const commandsByCategory = getCommandsByCategory();
  let currentIndex = 0;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input">
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>
        
        <div className="command-palette-results">
          {filteredCommands.length > 0 ? (
            Object.entries(commandsByCategory).map(([category, commands]) => (
              <div key={category}>
                <div className="command-palette-category">{category}</div>
                {commands.map(command => {
                  const isSelected = currentIndex === selectedIndex;
                  const itemRef = isSelected ? selectedCommandRef : null;
                  const result = (
                    <div
                      key={command.id}
                      ref={itemRef}
                      className={`command-palette-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        command.action();
                        onClose();
                      }}
                    >
                      <span className="command-name">{command.name}</span>
                      <span className="command-description">{command.description}</span>
                      {renderShortcut(command)}
                    </div>
                  );
                  currentIndex++;
                  return result;
                })}
              </div>
            ))
          ) : (
            <div className="command-palette-empty">
              No commands match your search
            </div>
          )}
        </div>
        
        <div className="command-palette-hint">
          <span>↑↓ to navigate</span>
          <span>Enter to execute</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette; 