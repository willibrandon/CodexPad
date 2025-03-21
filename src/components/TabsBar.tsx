/**
 * @fileoverview Component that renders a horizontal bar of tabs for snippet navigation
 * with support for selection, closing, and favorite status indication.
 */

import React from 'react';
import { useTabs } from './TabsContext';
import './TabsBar.css';

/**
 * A component that displays a horizontal scrollable list of tabs representing open snippets.
 * Supports tab selection, closing via click or middle-click, and displays favorite status.
 * 
 * Features:
 * - Horizontal scrolling for many tabs
 * - Active tab highlighting
 * - Close button for each tab
 * - Middle-click to close
 * - Favorite status indicator
 * - Empty state handling
 * 
 * @component
 */
const TabsBar: React.FC = () => {
  const { openTabs, activeTabId, setActiveTab, closeTab } = useTabs();

  /**
   * Handles click on a tab to make it active
   * @param {number} id - ID of the tab to activate
   */
  const handleTabClick = (id: number) => {
    setActiveTab(id);
  };

  /**
   * Handles click on a tab's close button
   * @param {React.MouseEvent} e - Click event
   * @param {number} id - ID of the tab to close
   */
  const handleTabClose = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    closeTab(id);
  };

  /**
   * Handles middle-click on a tab for quick closing
   * @param {React.MouseEvent} e - Mouse event
   * @param {number} id - ID of the tab to close
   */
  const handleTabMiddleClick = (e: React.MouseEvent, id: number) => {
    if (e.button === 1) { // Middle mouse button
      e.preventDefault();
      closeTab(id);
    }
  };

  return (
    <div className="tabs-bar">
      {openTabs.length === 0 ? (
        <div className="tabs-empty">No open snippets</div>
      ) : (
        <div className="tabs-container">
          {openTabs.map(tab => (
            <div 
              key={tab.id}
              className={`tab-item ${activeTabId === tab.id ? 'active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
              onMouseDown={(e) => handleTabMiddleClick(e, tab.id)}
            >
              <span className="tab-title">
                {tab.favorite && <span className="tab-favorite">★</span>}
                {tab.title || 'Untitled'}
              </span>
              <button 
                className="tab-close"
                onClick={(e) => handleTabClose(e, tab.id)}
                title="Close tab"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TabsBar; 