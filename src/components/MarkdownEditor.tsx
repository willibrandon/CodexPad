import React, { useState, useEffect, useRef, useCallback, memo, useMemo, lazy, Suspense } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './MarkdownEditor.css';

// Import ReactMarkdown lazily to defer loading until needed
const ReactMarkdown = lazy(() => import('react-markdown'));

// Support for syntax highlighting
import Prism from 'prismjs';
import { loadPrismLanguage } from '../utils/prismUtils';

// Maximum size in bytes for direct rendering (approximately 100KB)
const MAX_DIRECT_RENDER_SIZE = 100 * 1024;

interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = memo(({
  content,
  onChange,
  placeholder = 'Write your notes here...'
}) => {
  const [isPreview, setIsPreview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [isLargeContent, setIsLargeContent] = useState(false);
  const [viewportContent, setViewportContent] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { settings, updateSettings } = useTheme();
  
  // Check if content is too large and update state accordingly
  useEffect(() => {
    const contentSize = new Blob([content]).size;
    setIsLargeContent(contentSize > MAX_DIRECT_RENDER_SIZE);
    
    // If we're in preview mode with large content, prepare a truncated version
    if (isPreview && contentSize > MAX_DIRECT_RENDER_SIZE) {
      // Extract first ~50KB for preview
      setViewportContent(content.substring(0, 50000) + 
        '\n\n---\n\n*Content truncated for preview. Full content will be saved.*');
    } else {
      setViewportContent(content);
    }
  }, [content, isPreview]);

  // Handle paste events to manage large content
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    const pastedSize = new Blob([pastedText]).size;
    
    // For extremely large pastes (>1MB), show a confirmation
    if (pastedSize > 1024 * 1024) {
      e.preventDefault();
      if (window.confirm(`You're pasting ${Math.round(pastedSize/1024/1024)}MB of text, which may cause performance issues. Continue?`)) {
        // Process paste in chunks using a web worker or timeout
        if (textareaRef.current) {
          const textarea = textareaRef.current;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const beforeText = content.substring(0, start);
          const afterText = content.substring(end);
          
          // Perform the update with a slight delay to allow UI to respond
          setTimeout(() => {
            onChange(beforeText + pastedText + afterText);
          }, 50);
        }
      }
    }
  }, [content, onChange]);
  
  // Memoize markdown preview component
  const MarkdownPreview = useMemo(() => {
    return (
      <ReactMarkdown
        key={`markdown-${settings.codeFont}`}
        components={{
          code: ({ node, inline, className, children, ...props }: any) => {
            let fontFamily;
            switch(settings.codeFont) {
              case 'fira-code':
                fontFamily = "'Fira Code', monospace";
                break;
              case 'jetbrains-mono':
                fontFamily = "'JetBrains Mono', monospace";
                break;
              case 'cascadia-code':
                fontFamily = "'Cascadia Code', monospace";
                break;
              default:
                fontFamily = "monospace";
            }
            
            const match = /language-(\w+)/.exec(className || '');
            if (match && !inline) {
              const language = match[1];
              loadPrismLanguage(language);
            }
            
            return !inline && match ? (
              <pre style={{ fontFamily }}>
                <code
                  className={className}
                  style={{ fontFamily }}
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </code>
              </pre>
            ) : (
              <code 
                className={className} 
                style={{ fontFamily }}
                {...props}
              >
                {children}
              </code>
            );
          }
        }}
        remarkPlugins={[]}
      >
        {viewportContent || '_No content_'}
      </ReactMarkdown>
    );
  }, [viewportContent, settings.codeFont]);

  // Debounce syntax highlighting with RAF
  useEffect(() => {
    if (isPreview && previewRef.current) {
      let rafId: number;
      const highlight = () => {
        rafId = requestAnimationFrame(() => {
          Prism.highlightAllUnder(previewRef.current!);
        });
      };
      highlight();
      return () => {
        if (rafId) cancelAnimationFrame(rafId);
      };
    }
  }, [isPreview, viewportContent]);

  // Format selected text or insert at cursor position
  const formatText = useCallback((formatType: string) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const beforeText = content.substring(0, start);
    const afterText = content.substring(end);
    
    let formattedText = '';
    let newCursorPos = 0;
    
    switch (formatType) {
      case 'bold':
        formattedText = `**${selectedText || 'bold text'}**`;
        newCursorPos = selectedText ? formattedText.length : 2;
        break;
      case 'italic':
        formattedText = `_${selectedText || 'italic text'}_`;
        newCursorPos = selectedText ? formattedText.length : 1;
        break;
      case 'code':
        formattedText = `\`${selectedText || 'code'}\``;
        newCursorPos = selectedText ? formattedText.length : 1;
        break;
      case 'heading':
        // If line already starts with #, add one more
        const lineStart = beforeText.lastIndexOf('\n') + 1;
        const currentLine = beforeText.substring(lineStart) + selectedText;
        
        if (/^#{1,5}\s/.test(currentLine)) {
          formattedText = `#${selectedText}`;
        } else if (/^#{6}\s/.test(currentLine)) {
          // If already h6, remove all #
          formattedText = selectedText.replace(/^#{6}\s/, '');
        } else {
          formattedText = `# ${selectedText || 'Heading'}`;
          newCursorPos = selectedText ? formattedText.length : 2;
        }
        break;
      case 'link':
        formattedText = `[${selectedText || 'link text'}](url)`;
        newCursorPos = selectedText ? formattedText.length - 1 : 1;
        break;
      case 'image':
        formattedText = `![${selectedText || 'alt text'}](image-url)`;
        newCursorPos = selectedText ? formattedText.length - 1 : 2;
        break;
      case 'bulletList':
        formattedText = `\n- ${selectedText || 'List item'}\n`;
        newCursorPos = selectedText ? formattedText.length : 3;
        break;
      case 'numberedList':
        formattedText = `\n1. ${selectedText || 'List item'}\n`;
        newCursorPos = selectedText ? formattedText.length : 4;
        break;
      case 'quote':
        formattedText = `> ${selectedText || 'Blockquote'}\n`;
        newCursorPos = selectedText ? formattedText.length : 2;
        break;
      case 'horizontalRule':
        formattedText = `\n\n---\n\n`;
        newCursorPos = formattedText.length;
        break;
      case 'table':
        formattedText = `\n| Column 1 | Column 2 | Column 3 |\n| -------- | -------- | -------- |\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n`;
        newCursorPos = formattedText.length;
        break;
    }
    
    const newText = beforeText + formattedText + afterText;
    onChange(newText);
    
    // Set cursor position after the operation
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + (selectedText ? formattedText.length : newCursorPos);
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  }, [content, onChange]);

  // Add a helper to insert code snippets with language
  const insertCodeSnippet = (language: string) => {
    // Create a code snippet template with the selected language
    const codeTemplate = `\n\`\`\`${language}\n// Your ${language} code here\n\`\`\`\n`;
    
    // Insert at cursor position or append to end
    if (textareaRef.current) {
      const textarea = textareaRef.current;
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

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Only handle keyboard shortcuts if not in preview mode
    if (isPreview) return;
    
    // Check for Ctrl/Cmd key combinations
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case 'b': // Bold
          e.preventDefault();
          formatText('bold');
          break;
        case 'i': // Italic
          e.preventDefault();
          formatText('italic');
          break;
        case 'k': // Link
          e.preventDefault();
          formatText('link');
          break;
        case '1': case '2': case '3': case '4': case '5': case '6': // Headings
          if (e.altKey) {
            e.preventDefault();
            const level = parseInt(e.key);
            const prefix = '#'.repeat(level) + ' ';
            
            if (textareaRef.current) {
              const textarea = textareaRef.current;
              const start = textarea.selectionStart;
              const lineStart = content.lastIndexOf('\n', start - 1) + 1;
              
              // Find the current line
              const lineEnd = content.indexOf('\n', start);
              const currentLine = content.substring(lineStart, lineEnd > -1 ? lineEnd : undefined);
              
              // Remove existing heading markers
              const cleanLine = currentLine.replace(/^#+\s/, '');
              
              // Create the new content
              const beforeText = content.substring(0, lineStart);
              const afterText = content.substring(lineEnd > -1 ? lineEnd : content.length);
              const newContent = beforeText + prefix + cleanLine + afterText;
              
              onChange(newContent);
            }
          }
          break;
        case 'f': // Fullscreen toggle
          if (e.shiftKey) {
            e.preventDefault();
            setIsFullscreen(!isFullscreen);
          }
          break;
        case 'p': // Preview toggle
          if (e.shiftKey) {
            e.preventDefault();
            setIsPreview(!isPreview);
          }
          break;
        case 'e': // Edit mode
          if (e.shiftKey && isPreview) {
            e.preventDefault();
            setIsPreview(false);
          }
          break;
        case '/': // Keyboard help
          if (e.shiftKey) {
            e.preventDefault();
            setShowKeyboardHelp(!showKeyboardHelp);
          }
          break;
      }
    }
  }, [content, formatText, isFullscreen, isPreview, onChange, showKeyboardHelp]);

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Toggle keyboard help
  const toggleKeyboardHelp = () => {
    setShowKeyboardHelp(!showKeyboardHelp);
  };

  // Handle code font change
  const handleCodeFontChange = (codeFont: string) => {
    updateSettings({ codeFont: codeFont as any });
    // Force refresh the preview if needed
    if (isPreview && previewRef.current) {
      setTimeout(() => {
        Prism.highlightAllUnder(previewRef.current!);
      }, 10);
    }
  };

  return (
    <div className={`markdown-editor ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="toolbar minimal">
        <div className="toolbar-group">
          <button
            className={`toolbar-btn ${!isPreview ? 'active' : ''}`}
            onClick={() => setIsPreview(false)}
            title="Edit (Ctrl+Shift+E)"
          >
            <span className="icon">✎</span>
          </button>
          <button
            className={`toolbar-btn ${isPreview ? 'active' : ''}`}
            onClick={() => setIsPreview(true)}
            title="Preview (Ctrl+Shift+P)"
          >
            <span className="icon">👁</span>
          </button>
        </div>
        
        {!isPreview && (
          <div className="toolbar-group">
            <button 
              className="toolbar-btn" 
              onClick={() => formatText('bold')}
              title="Bold (Ctrl+B)"
            >
              <span className="icon">B</span>
            </button>
            <button 
              className="toolbar-btn" 
              onClick={() => formatText('italic')}
              title="Italic (Ctrl+I)"
            >
              <span className="icon">I</span>
            </button>
            <button 
              className="toolbar-btn" 
              onClick={() => formatText('heading')}
              title="Heading (Ctrl+Alt+1-6 for heading levels)"
            >
              <span className="icon">H</span>
            </button>
            
            <div className="format-dropdown">
              <button className="toolbar-btn" title="Format">
                <span className="icon">⋮</span>
              </button>
              <div className="dropdown-content">
                <div className="dropdown-section">
                  <span className="dropdown-title">List</span>
                  <button onClick={() => formatText('bulletList')}>• Bullet List</button>
                  <button onClick={() => formatText('numberedList')}>1. Numbered List</button>
                  <button onClick={() => formatText('quote')}>Quote</button>
                </div>
                <div className="dropdown-divider"></div>
                <div className="dropdown-section">
                  <span className="dropdown-title">Insert</span>
                  <button onClick={() => formatText('link')}>Link</button>
                  <button onClick={() => formatText('image')}>Image</button>
                  <button onClick={() => formatText('table')}>Table</button>
                  <button onClick={() => formatText('horizontalRule')}>Horizontal Rule</button>
                </div>
              </div>
            </div>
            
            <div className="code-snippets-dropdown">
              <button className="toolbar-btn" title="Insert Code">
                <span className="icon">&lt;/&gt;</span>
              </button>
              <div className="dropdown-content">
                <button onClick={() => formatText('code')}>Inline Code</button>
                <div className="dropdown-divider"></div>
                <div className="dropdown-section">
                  <span className="dropdown-title">.NET</span>
                  <button onClick={() => insertCodeSnippet('csharp')}>C#</button>
                  <button onClick={() => insertCodeSnippet('fsharp')}>F#</button>
                  <button onClick={() => insertCodeSnippet('vbnet')}>VB.NET</button>
                  <button onClick={() => insertCodeSnippet('powershell')}>PowerShell</button>
                </div>
                <div className="dropdown-divider"></div>
                <div className="dropdown-section">
                  <span className="dropdown-title">Web</span>
                  <button onClick={() => insertCodeSnippet('javascript')}>JavaScript</button>
                  <button onClick={() => insertCodeSnippet('typescript')}>TypeScript</button>
                  <button onClick={() => insertCodeSnippet('html')}>HTML</button>
                  <button onClick={() => insertCodeSnippet('css')}>CSS</button>
                  <button onClick={() => insertCodeSnippet('json')}>JSON</button>
                </div>
                <div className="dropdown-divider"></div>
                <div className="dropdown-section">
                  <span className="dropdown-title">Other</span>
                  <button onClick={() => insertCodeSnippet('sql')}>SQL</button>
                  <button onClick={() => insertCodeSnippet('bash')}>Bash</button>
                  <button onClick={() => insertCodeSnippet('yaml')}>YAML</button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="toolbar-spacer"></div>
        
        <div className="toolbar-group">
          <button 
            className="toolbar-btn"
            onClick={toggleKeyboardHelp}
            title="Keyboard Shortcuts (Ctrl+Shift+/)"
          >
            <span className="icon">?</span>
          </button>
          
          <button 
            className={`toolbar-btn ${isFullscreen ? 'active' : ''}`}
            onClick={toggleFullscreen}
            title="Toggle Fullscreen (Ctrl+Shift+F)"
          >
            <span className="icon">{isFullscreen ? '↙' : '↗'}</span>
          </button>
          
          <div className="code-font-dropdown">
            <button className="toolbar-btn" title="Change Code Font">
              <span className="icon">A</span>
            </button>
            <div className="dropdown-content">
              <div className="dropdown-section">
                <span className="dropdown-title">Code Font</span>
                <button 
                  onClick={() => handleCodeFontChange('default')}
                  className={settings.codeFont === 'default' ? 'active' : ''}
                >
                  Default
                </button>
                <button 
                  onClick={() => handleCodeFontChange('fira-code')}
                  className={settings.codeFont === 'fira-code' ? 'active' : ''}
                >
                  Fira Code
                </button>
                <button 
                  onClick={() => handleCodeFontChange('jetbrains-mono')}
                  className={settings.codeFont === 'jetbrains-mono' ? 'active' : ''}
                >
                  JetBrains Mono
                </button>
                <button 
                  onClick={() => handleCodeFontChange('cascadia-code')}
                  className={settings.codeFont === 'cascadia-code' ? 'active' : ''}
                >
                  Cascadia Code
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {isLargeContent && (
        <div className="content-warning">
          <span>
            {isPreview 
              ? "Large content - preview is truncated but full content will be saved" 
              : "Large content - editor performance may be affected"}
          </span>
        </div>
      )}
      
      {showKeyboardHelp && (
        <div className="keyboard-help">
          <div className="keyboard-help-header">
            <h3>Keyboard Shortcuts</h3>
            <button onClick={toggleKeyboardHelp} className="close-btn">×</button>
          </div>
          <div className="keyboard-help-content">
            <div className="shortcut-group">
              <h4>Editor Controls</h4>
              <div className="shortcut-item">
                <span className="key">Ctrl+Shift+E</span>
                <span className="desc">Switch to Edit mode</span>
              </div>
              <div className="shortcut-item">
                <span className="key">Ctrl+Shift+P</span>
                <span className="desc">Switch to Preview mode</span>
              </div>
              <div className="shortcut-item">
                <span className="key">Ctrl+Shift+F</span>
                <span className="desc">Toggle Fullscreen</span>
              </div>
              <div className="shortcut-item">
                <span className="key">Ctrl+Shift+/</span>
                <span className="desc">Show/Hide Keyboard Help</span>
              </div>
            </div>
            
            <div className="shortcut-group">
              <h4>Text Formatting</h4>
              <div className="shortcut-item">
                <span className="key">Ctrl+B</span>
                <span className="desc">Bold</span>
              </div>
              <div className="shortcut-item">
                <span className="key">Ctrl+I</span>
                <span className="desc">Italic</span>
              </div>
              <div className="shortcut-item">
                <span className="key">Ctrl+K</span>
                <span className="desc">Insert Link</span>
              </div>
              <div className="shortcut-item">
                <span className="key">Ctrl+Alt+1-6</span>
                <span className="desc">Heading Level 1-6</span>
              </div>
            </div>
            
            <div className="shortcut-tip">
              <p>Tip: Select text first to apply formatting to it, or place your cursor where you want to insert formatted text.</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="editor-container">
        {isPreview ? (
          <div className="preview-container" ref={previewRef}>
            <div className="markdown-preview">
              <Suspense fallback={<div>Loading preview...</div>}>
                {MarkdownPreview}
              </Suspense>
            </div>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            className="markdown-textarea"
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
          />
        )}
      </div>
    </div>
  );
});

export default MarkdownEditor; 