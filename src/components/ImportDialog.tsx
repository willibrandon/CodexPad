import React, { useState, useRef, useEffect } from 'react';
import { importFiles } from '../utils/importUtils';
import { Snippet } from '../App';
import './ImportDialog.css';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (snippets: Partial<Snippet>[]) => void;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, onImport }) => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFiles(null);
      setError(null);
      setImportedCount(0);
      setLoading(false);
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(e.dataTransfer.files);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(e.target.files);
    }
  };
  
  const handleSelectFiles = () => {
    fileInputRef.current?.click();
  };
  
  const handleSubmit = async () => {
    if (!files || files.length === 0) {
      setError('Please select at least one file to import');
      return;
    }
    
    setError(null);
    setLoading(true);
    
    try {
      const snippets = await importFiles(files);
      
      if (snippets.length === 0) {
        setError('No valid notes found in the selected files');
        setLoading(false);
        return;
      }
      
      setImportedCount(snippets.length);
      onImport(snippets);
      
      // Automatically close after successful import
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError('An error occurred while importing files');
      console.error('Import error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="import-dialog-overlay" onClick={onClose}>
      <div className="import-dialog" onClick={e => e.stopPropagation()}>
        <div className="import-dialog-header">
          <h3>Import Notes</h3>
          <button className="import-dialog-close" onClick={onClose}>×</button>
        </div>
        
        <div className="import-dialog-content">
          <p className="import-description">
            Import notes from other applications. Supported formats:
          </p>
          
          <ul className="import-formats">
            <li>Markdown (.md)</li>
            <li>Evernote Export (.enex)</li>
            <li>Notion Export (.html, .md)</li>
            <li>Plain Text (.txt)</li>
          </ul>
          
          <div 
            className={`import-dropzone ${dragActive ? 'active' : ''} ${files ? 'has-files' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".md,.markdown,.txt,.html,.htm,.enex"
              multiple
              className="file-input"
            />
            
            {files ? (
              <div className="files-selected">
                <div className="files-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <div className="files-info">
                  <span className="files-name">
                    {files.length === 1 
                      ? files[0].name 
                      : `${files.length} files selected`}
                  </span>
                  <button 
                    className="change-files-btn"
                    onClick={handleSelectFiles}
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="dropzone-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </div>
                <p className="dropzone-text">
                  Drag & drop files here or <span className="browse-link" onClick={handleSelectFiles}>browse</span>
                </p>
              </>
            )}
          </div>
          
          {error && (
            <div className="import-error">
              {error}
            </div>
          )}
          
          {importedCount > 0 && (
            <div className="import-success">
              Successfully imported {importedCount} {importedCount === 1 ? 'note' : 'notes'}
            </div>
          )}
        </div>
        
        <div className="import-dialog-footer">
          <button 
            className="import-cancel-btn" 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className={`import-submit-btn ${!files ? 'disabled' : ''}`}
            onClick={handleSubmit}
            disabled={!files || loading}
          >
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportDialog; 