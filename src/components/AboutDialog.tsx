import React from 'react';
import './AboutDialog.css';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content about-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>About CodexPad</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="dialog-body">
          <div className="app-info">
            <h3>CodexPad</h3>
            <p>Version 0.1.0</p>
            <p>A modern, fast, and efficient code snippet manager.</p>
          </div>
          <div className="features">
            <h4>Features:</h4>
            <ul>
              <li>Organize and manage code snippets</li>
              <li>Syntax highlighting for multiple languages</li>
              <li>Fast full-text search</li>
              <li>Keyboard-driven workflow</li>
              <li>Multiple export formats</li>
            </ul>
          </div>
          <div className="credits">
            <p>© 2025 CodexPad. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutDialog; 