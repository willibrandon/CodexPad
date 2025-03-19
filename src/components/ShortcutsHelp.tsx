import React from 'react';
import { useKeyboardShortcuts, ShortcutCategory } from '../contexts/KeyboardShortcutsContext';
import './ShortcutsHelp.css';

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutsHelp: React.FC<ShortcutsHelpProps> = ({ isOpen, onClose }) => {
  const { shortcuts } = useKeyboardShortcuts();

  // Group shortcuts by category
  const getShortcutsByCategory = () => {
    const grouped: Record<string, typeof shortcuts> = {};
    
    // Sort shortcuts by category
    shortcuts.forEach(shortcut => {
      if (!grouped[shortcut.category]) {
        grouped[shortcut.category] = [];
      }
      grouped[shortcut.category].push(shortcut);
    });
    
    return grouped;
  };

  // Render keyboard keys
  const renderKeys = (keys: string[]) => {
    return (
      <div className="shortcut-keys">
        {keys.map((key, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span>+</span>}
            <span className="key">{key}</span>
          </React.Fragment>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  const shortcutsByCategory = getShortcutsByCategory();

  return (
    <div className="shortcuts-help-overlay" onClick={onClose}>
      <div className="shortcuts-help-container" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-help-header">
          <h3>Keyboard Shortcuts</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="shortcuts-help-content">
          {Object.entries(shortcutsByCategory).map(([category, categoryShortcuts]) => (
            <section key={category} className="shortcuts-section">
              <h4>{category}</h4>
              <div className="shortcuts-list">
                {categoryShortcuts.map(shortcut => (
                  <div key={shortcut.id} className="shortcut-item">
                    <span className="shortcut-description">{shortcut.description}</span>
                    {renderKeys(shortcut.keys)}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="shortcuts-section">
            <h4>General</h4>
            <div className="shortcuts-list">
              <div className="shortcut-item">
                <span className="shortcut-description">Open command palette</span>
                <div className="shortcut-keys">
                  <span className="key">Ctrl</span>
                  <span>+</span>
                  <span className="key">P</span>
                </div>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-description">Show this help dialog</span>
                <div className="shortcut-keys">
                  <span className="key">F1</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="shortcuts-help-footer">
          <button className="close-shortcuts-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsHelp; 