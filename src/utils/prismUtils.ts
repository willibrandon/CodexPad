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
      
      // Fix for languages with different module names
      'dockerfile': 'docker',
      'nginx': 'nginx',
    };

    // Define a list of supported languages that we know exist in prismjs
    const supportedLanguages = [
      'javascript', 'typescript', 'jsx', 'tsx', 'css', 'html', 
      'csharp', 'fsharp', 'python', 'java', 'bash', 'shell',
      'sql', 'yaml', 'json', 'markdown', 'powershell', 'vbnet',
      'ruby', 'go', 'rust', 'cpp', 'c', 'php', 'kotlin', 'swift',
      'dart', 'r', 'matlab', 'scala', 'haskell', 'lua', 'perl',
      'graphql', 'toml', 'docker', 'xml'
    ];
    
    // Get the correct language name
    const normalizedLang = languageMap[language.toLowerCase()] || language.toLowerCase();
    
    // Only try to load supported languages
    if (supportedLanguages.includes(normalizedLang)) {
      // Check if language is already loaded
      if (!Prism.languages[normalizedLang]) {
        try {
          // Dynamic import with error handling
          import(`prismjs/components/prism-${normalizedLang}`)
            .catch((error) => {
              console.warn(`Failed to load language: ${normalizedLang}`, error);
              
              // For unsupported languages, fallback to text
              if (!Prism.languages[normalizedLang]) {
                // Use plain text highlighting as fallback
                Prism.languages[normalizedLang] = Prism.languages.plaintext;
              }
            });
        } catch (importError) {
          console.warn(`Import error for language: ${normalizedLang}`, importError);
          
          // For unsupported languages, fallback to text
          if (!Prism.languages[normalizedLang]) {
            // Use plain text highlighting as fallback
            Prism.languages[normalizedLang] = Prism.languages.plaintext;
          }
        }
      }
    } else {
      // For unsupported languages, use plaintext
      if (!Prism.languages[normalizedLang]) {
        Prism.languages[normalizedLang] = Prism.languages.plaintext;
      }
    }
  } catch (error) {
    console.warn(`Error loading language: ${language}`, error);
  }
}; 