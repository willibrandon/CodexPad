import React, { useState, useCallback, useEffect, useRef } from 'react';
import WindowControls from './WindowControls';
import { useTabs } from './TabsContext';
import './AppMenu.css';

const AppMenu: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { activeTabId, openTabs } = useTabs();
  const isMac = window.electron && window.electron.platform === 'darwin';
  
  // Check if a snippet is open
  const isSnippetOpen = activeTabId !== null && openTabs.length > 0;

  // Handle clicks outside the menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleMenuClick = useCallback((menuName: string) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  }, [activeMenu]);

  const handleMenuAction = useCallback((action: string, format?: string) => {
    console.log(`Menu action: ${action}${format ? ', format: ' + format : ''}`);
    if (window.electron) {
      if (format) {
        window.electron.invoke('menu-action', action, format);
      } else {
        window.electron.invoke('menu-action', action);
      }
    }
    setActiveMenu(null);
  }, []);

  return (
    <div className={`app-menu ${isMac ? 'mac-app-menu' : ''}`} ref={menuRef}>
      <div className="menu-bar">
        <div className="menu-bar-drag-region" />
        {!isMac && (
          <div className="menu-bar-items">
            <div 
              className={`menu-item ${activeMenu === 'file' ? 'active' : ''}`}
              onClick={() => handleMenuClick('file')}
            >
              File
              {activeMenu === 'file' && (
                <div className="menu-dropdown">
                  <div className="menu-dropdown-item" onClick={() => handleMenuAction('new')}>
                    New Snippet
                    <span className="shortcut">Ctrl+N</span>
                  </div>
                  <div className="menu-separator" />
                  <div className="menu-dropdown-item" onClick={() => handleMenuAction('import')}>
                    Import...
                  </div>
                  <div className={`menu-dropdown-item ${!isSnippetOpen ? 'disabled' : ''}`}>
                    Export
                    {isSnippetOpen && (
                      <div className="menu-submenu">
                        <div className="menu-dropdown-item" onClick={() => handleMenuAction('export', 'markdown')}>
                          Markdown (.md)
                        </div>
                        <div className="menu-dropdown-item" onClick={() => handleMenuAction('export', 'html')}>
                          HTML (.html)
                        </div>
                        <div className="menu-dropdown-item" onClick={() => handleMenuAction('export', 'pdf')}>
                          PDF (.pdf)
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="menu-separator" />
                  <div className="menu-dropdown-item" onClick={() => handleMenuAction('exit')}>
                    Exit
                  </div>
                </div>
              )}
            </div>

            <div 
              className={`menu-item ${activeMenu === 'edit' ? 'active' : ''}`}
              onClick={() => handleMenuClick('edit')}
            >
              Edit
              {activeMenu === 'edit' && (
                <div className="menu-dropdown">
                  <div className="menu-dropdown-item" onClick={() => handleMenuAction('undo')}>
                    Undo
                    <span className="shortcut">Ctrl+Z</span>
                  </div>
                  <div className="menu-dropdown-item" onClick={() => handleMenuAction('redo')}>
                    Redo
                    <span className="shortcut">Ctrl+Y</span>
                  </div>
                  <div className="menu-separator" />
                  <div className="menu-dropdown-item" onClick={() => handleMenuAction('cut')}>
                    Cut
                    <span className="shortcut">Ctrl+X</span>
                  </div>
                  <div className="menu-dropdown-item" onClick={() => handleMenuAction('copy')}>
                    Copy
                    <span className="shortcut">Ctrl+C</span>
                  </div>
                  <div className="menu-dropdown-item" onClick={() => handleMenuAction('paste')}>
                    Paste
                    <span className="shortcut">Ctrl+V</span>
                  </div>
                </div>
              )}
            </div>

            <div 
              className={`menu-item ${activeMenu === 'view' ? 'active' : ''}`}
              onClick={() => handleMenuClick('view')}
            >
              View
              {activeMenu === 'view' && (
                <div className="menu-dropdown">
                  <div className="menu-dropdown-item" onClick={() => handleMenuAction('command-palette')}>
                    Command Palette
                    <span className="shortcut">Ctrl+Shift+P</span>
                  </div>
                  <div className="menu-separator" />
                  <div className="menu-dropdown-item" onClick={() => handleMenuAction('toggle-theme')}>
                    Toggle Theme
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <WindowControls />
      </div>
    </div>
  );
};

export default AppMenu; 