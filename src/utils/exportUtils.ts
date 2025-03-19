import { Snippet } from '../App';
// Use dynamic import for marked to avoid TypeScript errors
const marked = require('marked');

// Format Date for file names
const formatDateForFilename = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
};

// Clean filename by removing illegal characters
const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[<>:"/\\|?*]/g, '_').trim();
};

// Export single snippet to Markdown
export const exportToMarkdown = (snippet: Snippet): string => {
  let markdown = `# ${snippet.title}\n\n`;
  
  if (snippet.tags && snippet.tags.length > 0) {
    markdown += `Tags: ${snippet.tags.join(', ')}\n\n`;
  }
  
  markdown += snippet.content;
  return markdown;
};

// Export single snippet to HTML
export const exportToHtml = (snippet: Snippet): string => {
  const markdown = exportToMarkdown(snippet);
  const htmlContent = marked(markdown);
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${snippet.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    pre {
      background-color: #f5f5f5;
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
    }
    code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.9em;
    }
    blockquote {
      border-left: 4px solid #ddd;
      padding-left: 20px;
      margin-left: 0;
      color: #666;
    }
    img {
      max-width: 100%;
    }
    .tags {
      color: #666;
      font-style: italic;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
};

// Get suggested filename based on snippet title and export format
export const getSuggestedFilename = (snippet: Snippet, format: 'md' | 'html' | 'pdf'): string => {
  const sanitizedTitle = sanitizeFilename(snippet.title) || 'untitled';
  const dateStr = formatDateForFilename();
  return `${sanitizedTitle}_${dateStr}.${format}`;
};

// Interface for export options
export interface ExportOptions {
  format: 'markdown' | 'html' | 'pdf';
  snippet: Snippet;
} 