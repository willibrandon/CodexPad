import React from 'react';
import { useTabs } from './TabsContext';
import './TabsBar.css';

const TabsBar: React.FC = () => {
  const { openTabs, activeTabId, setActiveTab, closeTab } = useTabs();

  const handleTabClick = (id: number) => {
    setActiveTab(id);
  };

  const handleTabClose = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    closeTab(id);
  };

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