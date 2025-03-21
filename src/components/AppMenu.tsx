import React, { useState, useCallback, useEffect, useRef } from 'react';
import WindowControls from './WindowControls';
import { useTabs } from './TabsContext';
import './AppMenu.css';

const AppMenu: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { activeTabId, openTabs, getActiveEditor } = useTabs();
  const isMac = window.electron && window.electron.platform === 'darwin';
  
  // Store current editor selection when menu opens
  const selectionRef = useRef<{start: number, end: number} | null>(null);
  
  // Check if a snippet is open
  const isSnippetOpen = activeTabId !== null && openTabs.length > 0;
  
  // Check if editor is in edit mode
  const editorState = getActiveEditor();
  const canEdit = isSnippetOpen && editorState && !editorState.isPreviewMode;

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

  // This handler prevents the default behavior that would cause the selection to be lost
  const handleMenuMouseDown = useCallback((e: React.MouseEvent, menuName: string) => {
    // Prevent default behavior only for the Edit menu
    if (menuName === 'edit') {
      e.preventDefault();
      
      // Store the current selection
      if (editorState?.textareaRef?.current) {
        const textarea = editorState.textareaRef.current;
        selectionRef.current = {
          start: textarea.selectionStart,
          end: textarea.selectionEnd
        };
      }
    }
  }, [editorState]);

  // When opening/clicking a menu
  const handleMenuClick = useCallback((menuName: string) => {
    // Toggle the menu
    setActiveMenu(activeMenu === menuName ? null : menuName);
  }, [activeMenu]);

  const handleMenuAction = useCallback((action: string, format?: string) => {
    console.log(`Menu action triggered: ${action}${format ? ', format: ' + format : ''}`);
    
    // For edit operations, check if we can edit
    if (['undo', 'redo', 'cut', 'copy', 'paste'].includes(action)) {
      if (canEdit && editorState?.textareaRef?.current) {
        const textarea = editorState.textareaRef.current;
        
        // Restore selection for copy/cut operations
        if ((action === 'cut' || action === 'copy') && selectionRef.current && 
            selectionRef.current.start !== selectionRef.current.end) {
          textarea.focus();
          textarea.setSelectionRange(selectionRef.current.start, selectionRef.current.end);
        } else {
          textarea.focus();
        }
        
        // Execute command
        document.execCommand(action);
        
        return;
      }
    }
    
    // For other actions, use the Electron API
    if (window.electron) {
      if (format) {
        console.log(`Invoking menu-action with: ${action}, ${format}`);
        window.electron.invoke('menu-action', action, format);
      } else {
        console.log(`Invoking menu-action with: ${action}`);
        window.electron.invoke('menu-action', action);
      }
    }
    
    setActiveMenu(null);
  }, [canEdit, editorState]);

  // Check if there is text selected
  const hasSelectedText = selectionRef.current && 
                          selectionRef.current.start !== selectionRef.current.end;

  return (
    <div className={`app-menu ${isMac ? 'mac-app-menu' : ''}`} ref={menuRef}>
      <div className="menu-bar">
        {!isMac && (
          <div className="menu-bar-items">
            <div 
              className={`menu-item ${activeMenu === 'file' ? 'active' : ''}`}
              onClick={() => handleMenuClick('file')}
            >
              File
              {activeMenu === 'file' && (
                <div className="menu-dropdown">
                  <button className="menu-dropdown-item" onClick={() => handleMenuAction('new')}>
                    New Snippet
                    <span className="shortcut">Ctrl+N</span>
                  </button>
                  <div className="menu-separator" />
                  <button className="menu-dropdown-item" onClick={() => handleMenuAction('import')}>
                    Import...
                  </button>
                  <button className={`menu-dropdown-item ${!isSnippetOpen ? 'disabled' : ''}`} disabled={!isSnippetOpen}>
                    Export
                    {isSnippetOpen && (
                      <div className="menu-submenu">
                        <button className="menu-dropdown-item" onClick={() => handleMenuAction('export', 'markdown')}>
                          Markdown (.md)
                        </button>
                        <button className="menu-dropdown-item" onClick={() => handleMenuAction('export', 'html')}>
                          HTML (.html)
                        </button>
                        <button className="menu-dropdown-item" onClick={() => handleMenuAction('export', 'pdf')}>
                          PDF (.pdf)
                        </button>
                      </div>
                    )}
                  </button>
                  <div className="menu-separator" />
                  <button className="menu-dropdown-item" onClick={() => handleMenuAction('exit')}>
                    Exit
                  </button>
                </div>
              )}
            </div>

            <div 
              className={`menu-item ${activeMenu === 'edit' ? 'active' : ''}`}
              onMouseDown={(e) => handleMenuMouseDown(e, 'edit')}
              onClick={() => handleMenuClick('edit')}
            >
              Edit
              {activeMenu === 'edit' && (
                <div className="menu-dropdown">
                  <button 
                    className={`menu-dropdown-item ${!canEdit ? 'disabled' : ''}`} 
                    onClick={() => handleMenuAction('undo')} 
                    disabled={!canEdit}
                  >
                    Undo
                    <span className="shortcut">Ctrl+Z</span>
                  </button>
                  <button 
                    className={`menu-dropdown-item ${!canEdit ? 'disabled' : ''}`} 
                    onClick={() => handleMenuAction('redo')} 
                    disabled={!canEdit}
                  >
                    Redo
                    <span className="shortcut">Ctrl+Y</span>
                  </button>
                  <div className="menu-separator" />
                  <button 
                    className={`menu-dropdown-item ${(!canEdit || !hasSelectedText) ? 'disabled' : ''}`} 
                    onClick={() => handleMenuAction('cut')} 
                    disabled={!canEdit || !hasSelectedText}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    Cut
                    <span className="shortcut">Ctrl+X</span>
                  </button>
                  <button 
                    className={`menu-dropdown-item ${(!canEdit || !hasSelectedText) ? 'disabled' : ''}`} 
                    onClick={() => handleMenuAction('copy')} 
                    disabled={!canEdit || !hasSelectedText}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    Copy
                    <span className="shortcut">Ctrl+C</span>
                  </button>
                  <button 
                    className={`menu-dropdown-item ${!canEdit ? 'disabled' : ''}`} 
                    onClick={() => handleMenuAction('paste')} 
                    disabled={!canEdit}
                  >
                    Paste
                    <span className="shortcut">Ctrl+V</span>
                  </button>
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
                  <button className="menu-dropdown-item" onClick={() => handleMenuAction('command-palette')}>
                    Command Palette
                    <span className="shortcut">Ctrl+Shift+P</span>
                  </button>
                </div>
              )}
            </div>

            <div 
              className={`menu-item ${activeMenu === 'help' ? 'active' : ''}`}
              onClick={() => handleMenuClick('help')}
            >
              Help
              {activeMenu === 'help' && (
                <div className="menu-dropdown">
                  <button className="menu-dropdown-item" onClick={() => handleMenuAction('keyboard-shortcuts')}>
                    Keyboard Shortcuts
                    <span className="shortcut">F1</span>
                  </button>
                  <button className="menu-dropdown-item" onClick={() => handleMenuAction('documentation')}>
                    Documentation
                  </button>
                  <div className="menu-separator" />
                  <button className="menu-dropdown-item" onClick={() => handleMenuAction('about')}>
                    About CodexPad
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="menu-bar-drag-region" />
        <WindowControls />
      </div>
    </div>
  );
};

export default AppMenu; 