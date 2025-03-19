import { useCallback } from 'react';
import { Snippet } from '../App';

// Types of formats available for export
export type ExportFormat = 'markdown' | 'html' | 'pdf';

// Result of an export operation
export interface ExportResult {
  success: boolean;
  message?: string;
  error?: string;
  filePath?: string;
}

export function useExport() {
  // Export a snippet to the specified format
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