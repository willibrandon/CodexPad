import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Prism from 'prismjs';

// Import Prism core styles
import 'prismjs/themes/prism-tomorrow.css';

// Import base language support first
import 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';   // JavaScript (needed by TypeScript)
import 'prismjs/components/prism-markup';       // HTML

// Then import dependent languages
import 'prismjs/components/prism-csharp';       // C#
import 'prismjs/components/prism-fsharp';       // F#
import 'prismjs/components/prism-powershell';   // PowerShell
import 'prismjs/components/prism-css';          // CSS  
import 'prismjs/components/prism-typescript';   // TypeScript
import 'prismjs/components/prism-json';         // JSON
import 'prismjs/components/prism-sql';          // SQL
import 'prismjs/components/prism-bash';         // Bash
import 'prismjs/components/prism-yaml';         // YAML
import 'prismjs/components/prism-markdown';     // Markdown
import 'prismjs/components/prism-jsx';          // JSX
import 'prismjs/components/prism-tsx';          // TSX

// Import VB.NET last since it depends on other languages
// This fixes the "Cannot set properties of undefined (setting 'comment')" error
import 'prismjs/components/prism-basic';        // Basic (needed by VB.NET)
import 'prismjs/components/prism-vbnet';        // VB.NET

import './MarkdownEditor.css';

interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  content,
  onChange,
  placeholder = 'Write your notes here...'
}) => {
  const [isPreview, setIsPreview] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Apply syntax highlighting when preview mode is activated
  useEffect(() => {
    if (isPreview && previewRef.current) {
      Prism.highlightAllUnder(previewRef.current);
    }
  }, [isPreview, content]);

  // Add a helper to insert code snippets with language
  const insertCodeSnippet = (language: string) => {
    // Create a code snippet template with the selected language
    const codeTemplate = `\n\`\`\`${language}\n// Your ${language} code here\n\`\`\`\n`;
    
    // Insert at cursor position or append to end
    const textarea = document.querySelector('.markdown-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const textBefore = content.substring(0, start);
      const textAfter = content.substring(end);
      
      // Update content
      const newContent = textBefore + codeTemplate + textAfter;
      onChange(newContent);
      
      // Set cursor position after insertion
      setTimeout(() => {
        textarea.focus();
        const newPosition = start + codeTemplate.indexOf('// Your');
        textarea.setSelectionRange(newPosition, newPosition + `// Your ${language} code here`.length);
      }, 0);
    }
  };

  return (
    <div className="markdown-editor">
      <div className="toolbar">
        <button
          className={`toolbar-btn ${!isPreview ? 'active' : ''}`}
          onClick={() => setIsPreview(false)}
        >
          Edit
        </button>
        <button
          className={`toolbar-btn ${isPreview ? 'active' : ''}`}
          onClick={() => setIsPreview(true)}
        >
          Preview
        </button>
        
        {!isPreview && (
          <div className="code-snippets-dropdown">
            <button className="toolbar-btn code-btn">
              Insert Code
            </button>
            <div className="dropdown-content">
              <button onClick={() => insertCodeSnippet('csharp')}>C#</button>
              <button onClick={() => insertCodeSnippet('fsharp')}>F#</button>
              <button onClick={() => insertCodeSnippet('vbnet')}>VB.NET</button>
              <button onClick={() => insertCodeSnippet('powershell')}>PowerShell</button>
              <button onClick={() => insertCodeSnippet('javascript')}>JavaScript</button>
              <button onClick={() => insertCodeSnippet('typescript')}>TypeScript</button>
              <button onClick={() => insertCodeSnippet('html')}>HTML</button>
              <button onClick={() => insertCodeSnippet('css')}>CSS</button>
              <button onClick={() => insertCodeSnippet('json')}>JSON</button>
              <button onClick={() => insertCodeSnippet('sql')}>SQL</button>
            </div>
          </div>
        )}
      </div>
      
      <div className="editor-container">
        {isPreview ? (
          <div className="preview-container" ref={previewRef}>
            <div className="markdown-preview">
              <ReactMarkdown>
                {content || '_No content_'}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <textarea
            className="markdown-textarea"
            value={content}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        )}
      </div>
    </div>
  );
};

export default MarkdownEditor; 