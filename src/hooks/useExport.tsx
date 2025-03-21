/**
 * @fileoverview Custom hook for exporting snippets to various formats
 * This module provides functionality to export snippets to Markdown, HTML, and PDF formats
 * through Electron's IPC communication.
 * @module useExport
 */

import { useCallback } from 'react';
import { Snippet } from '../App';

/** Available formats for snippet export */
export type ExportFormat = 'markdown' | 'html' | 'pdf';

/**
 * Interface representing the result of an export operation
 * @interface ExportResult
 */
export interface ExportResult {
  /** Whether the export was successful */
  success: boolean;
  /** Optional success message */
  message?: string;
  /** Optional error message if export failed */
  error?: string;
  /** Path where the file was saved */
  filePath?: string;
}

/**
 * Custom hook for exporting snippets to different formats.
 * Provides a function to export snippets through Electron's IPC.
 * @returns {{ exportSnippet: (snippet: Snippet, format: ExportFormat) => Promise<ExportResult> }}
 */
export function useExport() {
  /**
   * Exports a snippet to the specified format using Electron's IPC.
   * @param {Snippet} snippet - The snippet to export
   * @param {ExportFormat} format - The format to export to (markdown, html, or pdf)
   * @returns {Promise<ExportResult>} Result of the export operation
   */
  const exportSnippet = useCallback(async (
    snippet: Snippet, 
    format: ExportFormat
  ): Promise<ExportResult> => {
    if (!window.electron) {
      return { 
        success: false, 
        error: 'Electron API not available' 
      };
    }

    try {
      let result;
      
      switch (format) {
        case 'markdown':
          result = await window.electron.invoke('export:markdown', snippet);
          break;
        case 'html':
          result = await window.electron.invoke('export:html', snippet);
          break;
        case 'pdf':
          result = await window.electron.invoke('export:pdf', snippet);
          break;
        default:
          return { 
            success: false, 
            error: `Unsupported export format: ${format}` 
          };
      }
      
      return result;
    } catch (error: any) {
      console.error(`Export to ${format} failed:`, error);
      return { 
        success: false, 
        error: error.message || `Failed to export as ${format}` 
      };
    }
  }, []);

  return { exportSnippet };
} 