/**
 * @fileoverview A search bar component with advanced search operators and help functionality.
 * Supports tag-based search, language filtering, date ranges, and other search operators.
 * Includes a help panel that shows available search operators and examples.
 * 
 * @module SearchBar
 */

import React, { useState, useRef, useEffect } from 'react';
import { useKeyboardShortcuts } from '../contexts/KeyboardShortcutsContext';
import './SearchBar.css';

/**
 * Props interface for the SearchBar component
 * @interface SearchBarProps
 */
interface SearchBarProps {
  /** Callback function triggered when search term changes */
  onSearch: (term: string) => void;
}

/**
 * A search bar component with advanced search capabilities and integrated help.
 * Supports various search operators and provides a help panel for users.
 * 
 * Features:
 * - Tag-based search (tag:react)
 * - Language filtering (language:typescript)
 * - Date range queries (created:>2024-01-01)
 * - Special filters (is:favorite)
 * - Exclusion operators (-term)
 * 
 * @component
 * @param {SearchBarProps} props - Component props
 * @returns {React.ReactElement} The rendered search bar
 */
const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  /** Current search term state */
  const [searchTerm, setSearchTerm] = useState('');
  
  /** Controls visibility of the help panel */
  const [showHelp, setShowHelp] = useState(false);
  
  /** Reference to the help button for click outside detection */
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  
  /** Reference to the help panel for click outside detection */
  const helpPanelRef = useRef<HTMLDivElement>(null);
  
  /** Reference to the search input for focus management */
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  /** Hook to manage search focus state in the keyboard shortcuts context */
  const { setSearchFocused } = useKeyboardShortcuts();

  // Close help panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showHelp &&
          helpPanelRef.current &&
          helpButtonRef.current &&
          !helpPanelRef.current.contains(event.target as Node) &&
          !helpButtonRef.current.contains(event.target as Node)) {
        setShowHelp(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showHelp]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    onSearch(term);
  };

  const toggleHelp = () => {
    setShowHelp(!showHelp);
  };

  // Update search focused state
  const handleFocus = () => {
    setSearchFocused(true);
  };

  const handleBlur = () => {
    setSearchFocused(false);
  };

  return (
    <div className="search-container">
      <input
        ref={searchInputRef}
        type="text"
        className="search-input"
        placeholder="Search snippets... (press ? for help)"
        value={searchTerm}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === '?' && !showHelp) {
            e.preventDefault();
            setShowHelp(true);
          } else if (e.key === 'Escape' && showHelp) {
            setShowHelp(false);
          } else if (e.key === 'Escape' && !showHelp) {
            searchInputRef.current?.blur();
          }
        }}
      />
      
      <button
        ref={helpButtonRef}
        className="search-help-button"
        onClick={toggleHelp}
        title="Search Help"
      >
        ?
      </button>

      {showHelp && (
        <div ref={helpPanelRef} className="search-help">
          <h3>Search Operators</h3>
          
          <div className="search-help-section">
            <h4>Tags</h4>
            <div className="search-help-item">
              <span className="search-help-operator">tag:react</span>
              <span className="search-help-desc">Find snippets with specific tag</span>
            </div>
          </div>

          <div className="search-help-section">
            <h4>Code Language</h4>
            <div className="search-help-item">
              <span className="search-help-operator">language:typescript</span>
              <span className="search-help-desc">Find snippets with specific language</span>
            </div>
          </div>

          <div className="search-help-section">
            <h4>Dates</h4>
            <div className="search-help-item">
              <span className="search-help-operator">created:{'>'}2024-01-01</span>
              <span className="search-help-desc">Created after date</span>
            </div>
            <div className="search-help-item">
              <span className="search-help-operator">updated:{'<'}2024-02-01</span>
              <span className="search-help-desc">Updated before date</span>
            </div>
          </div>

          <div className="search-help-section">
            <h4>Other Filters</h4>
            <div className="search-help-item">
              <span className="search-help-operator">is:favorite</span>
              <span className="search-help-desc">Show only favorites</span>
            </div>
            <div className="search-help-item">
              <span className="search-help-operator">-term</span>
              <span className="search-help-desc">Exclude results with term</span>
            </div>
          </div>

          <div className="search-help-examples">
            <div className="search-help-example">
              Example: react tag:hooks language:typescript -class
            </div>
            <div className="search-help-example">
              Example: is:favorite created:{'>'}2024-01-01
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
