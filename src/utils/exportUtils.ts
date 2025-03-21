/**
 * @fileoverview Utility functions for exporting snippets to various formats
 * This module provides functionality to export snippets to Markdown and HTML formats,
 * with proper formatting and styling.
 * @module exportUtils
 */

import { Snippet } from '../App';
// Use dynamic import for marked to avoid TypeScript errors
const marked = require('marked');

/**
 * Formats the current date and time for use in filenames.
 * @returns {string} Formatted date string in the format YYYY-MM-DD_HH-mm
 * @private
 */
const formatDateForFilename = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
};

/**
 * Sanitizes a filename by removing illegal characters.
 * @param {string} filename - The filename to sanitize
 * @returns {string} Sanitized filename safe for file system use
 * @private
 */
const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[<>:"/\\|?*]/g, '_').trim();
};

/**
 * Exports a snippet to Markdown format.
 * Includes title, tags (if any), and content in proper Markdown structure.
 * @param {Snippet} snippet - The snippet to export
 * @returns {string} Formatted Markdown content
 */
export const exportToMarkdown = (snippet: Snippet): string => {
  let markdown = `# ${snippet.title}\n\n`;
  
  if (snippet.tags && snippet.tags.length > 0) {
    markdown += `Tags: ${snippet.tags.join(', ')}\n\n`;
  }
  
  markdown += snippet.content;
  return markdown;
};

/**
 * Exports a snippet to HTML format with styling.
 * Converts Markdown content to HTML and adds responsive styling.
 * @param {Snippet} snippet - The snippet to export
 * @returns {string} Complete HTML document as a string
 */
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

/**
 * Generates a suggested filename for the exported snippet.
 * Combines sanitized title with timestamp and appropriate extension.
 * @param {Snippet} snippet - The snippet to generate filename for
 * @param {'md' | 'html' | 'pdf'} format - The export format
 * @returns {string} Generated filename
 */
export const getSuggestedFilename = (snippet: Snippet, format: 'md' | 'html' | 'pdf'): string => {
  const sanitizedTitle = sanitizeFilename(snippet.title) || 'untitled';
  const dateStr = formatDateForFilename();
  return `${sanitizedTitle}_${dateStr}.${format}`;
};

/**
 * Interface defining options for exporting snippets.
 * @interface ExportOptions
 */
export interface ExportOptions {
  /** Format to export the snippet in */
  format: 'markdown' | 'html' | 'pdf';
  /** The snippet to export */
  snippet: Snippet;
} 