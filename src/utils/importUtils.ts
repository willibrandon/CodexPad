import { Snippet } from '../App';

// Parse Markdown files
export const parseMarkdownFile = (content: string): Partial<Snippet> => {
  // Extract title from first heading
  const titleMatch = content.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1] : 'Untitled';

  // Extract tags if they exist
  const tagsMatch = content.match(/^Tags: (.+)$/m);
  const tags = tagsMatch 
    ? tagsMatch[1].split(',').map(tag => tag.trim()) 
    : [];

  // Remove title and tags from content if they were extracted
  let snippetContent = content;
  if (titleMatch) {
    snippetContent = snippetContent.replace(titleMatch[0], '');
  }
  if (tagsMatch) {
    snippetContent = snippetContent.replace(tagsMatch[0], '');
  }

  return {
    title,
    content: snippetContent.trim(),
    tags
  };
};

// Parse Evernote ENEX files
export const parseEvernoteENEX = (xmlContent: string): Partial<Snippet>[] => {
  const snippets: Partial<Snippet>[] = [];
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
  
  const notes = xmlDoc.getElementsByTagName('note');
  
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const titleElement = note.getElementsByTagName('title')[0];
    const contentElement = note.getElementsByTagName('content')[0];
    const tagElements = note.getElementsByTagName('tag');
    
    if (titleElement && contentElement) {
      const title = titleElement.textContent || 'Untitled';
      
      // Parse content (HTML to Markdown)
      let content = '';
      if (contentElement.textContent) {
        // First we need to parse the CDATA content
        const tempDoc = parser.parseFromString(contentElement.textContent, 'text/html');
        content = tempDoc.body.textContent || '';
      }
      
      // Extract tags
      const tags: string[] = [];
      for (let j = 0; j < tagElements.length; j++) {
        const tag = tagElements[j].textContent;
        if (tag) tags.push(tag);
      }
      
      snippets.push({
        title,
        content: content.trim(),
        tags
      });
    }
  }
  
  return snippets;
};

// Parse Notion export (markdown or HTML)
export const parseNotionExport = (content: string, isHtml: boolean): Partial<Snippet> => {
  if (isHtml) {
    // Parse HTML
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(content, 'text/html');
    
    // Extract title from h1
    const titleElement = htmlDoc.querySelector('h1');
    const title = titleElement?.textContent || 'Untitled';
    
    // Convert HTML to markdown
    // For a real implementation, you would use a HTML-to-Markdown converter library
    // This is a simplified version
    const bodyContent = htmlDoc.body.textContent || '';
    
    return {
      title,
      content: bodyContent.replace(title, '').trim(),
      tags: []
    };
  } else {
    // Treat as markdown
    return parseMarkdownFile(content);
  }
};

// Process text file with auto-detection
export const processTextFile = async (file: File): Promise<Partial<Snippet> | Partial<Snippet>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      if (!content) {
        reject(new Error('Could not read file'));
        return;
      }
      
      // Determine file type based on extension and content
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.md') || fileName.endsWith('.markdown')) {
        // Markdown file
        resolve(parseMarkdownFile(content));
      } else if (fileName.endsWith('.enex')) {
        // Evernote export
        resolve(parseEvernoteENEX(content));
      } else if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
        // HTML file (could be from Notion or other)
        resolve(parseNotionExport(content, true));
      } else if (fileName.endsWith('.txt')) {
        // Plain text - treat as simple snippet
        resolve({
          title: file.name.replace('.txt', ''),
          content
        });
      } else {
        // Try to detect format based on content
        if (content.startsWith('<?xml') && content.includes('<note>')) {
          resolve(parseEvernoteENEX(content));
        } else if (content.startsWith('<!DOCTYPE html>') || content.includes('<html')) {
          resolve(parseNotionExport(content, true));
        } else {
          // Default to treating as markdown
          resolve(parseMarkdownFile(content));
        }
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    reader.readAsText(file);
  });
};

// Main import function that handles multiple files
export const importFiles = async (files: FileList): Promise<Partial<Snippet>[]> => {
  const snippets: Partial<Snippet>[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await processTextFile(file);
      
      if (Array.isArray(result)) {
        snippets.push(...result);
      } else {
        snippets.push(result);
      }
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
    }
  }
  
  return snippets;
}; 