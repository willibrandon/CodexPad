/**
 * @fileoverview Command Palette component for quick access to application commands
 * Implements a Spotlight/VS Code-like interface with search, keyboard navigation,
 * and categorized command display
 * @module CommandPalette
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useKeyboardShortcuts, KeyboardShortcut, ShortcutCategory } from '../contexts/KeyboardShortcutsContext';
import './CommandPalette.css';

/**
 * Props for the CommandPalette component
 * @interface CommandPaletteProps
 */
interface CommandPaletteProps {
  /** Whether the command palette is currently open */
  isOpen: boolean;
  /** Callback function to close the command palette */
  onClose: () => void;
}

/**
 * Command Palette component providing quick access to application commands
 * Features include:
 * - Fuzzy search for commands
 * - Keyboard navigation
 * - Command categorization
 * - Keyboard shortcut display
 * 
 * @component
 * @param {CommandPaletteProps} props - Component props
 * @returns {React.ReactElement | null} The command palette or null if not open
 */
const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const { shortcuts } = useKeyboardShortcuts();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedCommandRef = useRef<HTMLDivElement>(null);

  /**
   * Filter commands based on search term
   * Matches against command name, description, and category
   */
  const filteredCommands = useMemo(() => {
    if (!searchTerm.trim()) {
      return shortcuts;
    }
    const lowerCaseSearch = searchTerm.toLowerCase();
    return shortcuts.filter(shortcut => 
      shortcut.name.toLowerCase().includes(lowerCaseSearch) ||
      shortcut.description.toLowerCase().includes(lowerCaseSearch) ||
      shortcut.category.toLowerCase().includes(lowerCaseSearch)
    );
  }, [searchTerm, shortcuts]);

  /**
   * Reset selection when search term changes
   * @effect
   */
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  /**
   * Focus input and reset state when palette opens
   * @effect
   */
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearchTerm('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  /**
   * Scroll selected command into view
   * @effect
   */
  useEffect(() => {
    if (selectedCommandRef.current) {
      selectedCommandRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }
  }, [selectedIndex]);

  /**
   * Handle keyboard navigation and command execution
   * @param {React.KeyboardEvent} e - Keyboard event
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < filteredCommands.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
    }

    if (e.key === 'Enter' && filteredCommands.length > 0) {
      const selectedCommand = filteredCommands[selectedIndex];
      if (selectedCommand) {
        selectedCommand.action();
        onClose();
      }
    }
  }, [filteredCommands, selectedIndex, onClose]);

  /**
   * Render keyboard shortcut display
   * @param {KeyboardShortcut} shortcut - The shortcut to render
   * @returns {React.ReactElement} Rendered shortcut component
   */
  const renderShortcut = useCallback((shortcut: KeyboardShortcut) => {
    return (
      <div className="command-shortcut">
        {shortcut.keys.map((key, index) => (
          <span key={index} className="key">{key}</span>
        ))}
      </div>
    );
  }, []);

  /**
   * Group commands by category
   */
  const commandsByCategory = useMemo(() => {
    const grouped: Record<string, KeyboardShortcut[]> = {};
    
    filteredCommands.forEach(cmd => {
      if (!grouped[cmd.category]) {
        grouped[cmd.category] = [];
      }
      grouped[cmd.category].push(cmd);
    });
    
    return grouped;
  }, [filteredCommands]);

  if (!isOpen) return null;

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

export default React.memo(CommandPalette); 