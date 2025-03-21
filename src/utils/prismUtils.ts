/**
 * @fileoverview Utility functions for Prism.js syntax highlighting
 * This module provides lazy loading functionality for Prism.js language definitions,
 * improving initial load performance by only loading languages when needed.
 * @module prismUtils
 */

import Prism from 'prismjs';

/**
 * Lazily loads a Prism language definition.
 * Maps common aliases to their proper language names and only loads supported languages.
 * @param {string} language - The language identifier to load
 */
export const loadPrismLanguage = (language: string) => {
  try {
    // Map some common aliases to their Prism language names
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'cs': 'csharp',
      'fs': 'fsharp',
      'sh': 'bash',
      'yml': 'yaml',
      'jsx': 'jsx',
      'tsx': 'tsx',
      'cpp': 'cpp',
      'c++': 'cpp',
      'php': 'php',
    };

    // Define a list of supported languages to avoid unnecessary imports
    const supportedLanguages = [
      'javascript', 'typescript', 'jsx', 'tsx', 'css', 'html', 
      'csharp', 'fsharp', 'python', 'java', 'bash', 'shell',
      'sql', 'yaml', 'json', 'markdown', 'powershell', 'vbnet',
      'ruby', 'go', 'rust', 'cpp', 'c', 'php', 'kotlin', 'swift',
      'dart', 'r', 'matlab', 'scala', 'haskell', 'lua', 'perl',
      'graphql', 'toml', 'dockerfile', 'nginx', 'xml'
    ];
    
    // Get the correct language name
    const normalizedLang = languageMap[language.toLowerCase()] || language.toLowerCase();
    
    // Only try to load supported languages
    if (supportedLanguages.includes(normalizedLang)) {
      // Check if language is already loaded
      if (!Prism.languages[normalizedLang]) {
        import(`prismjs/components/prism-${normalizedLang}`).catch((error) => {
          console.warn(`Failed to load language: ${normalizedLang}`, error);
        });
      }
    }
  } catch (error) {
    console.warn(`Error loading language: ${language}`, error);
  }
}; 