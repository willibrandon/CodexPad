// Lazy load Prism languages
export const loadPrismLanguage = (language: string) => {
  try {
    // Define a list of supported languages to avoid unnecessary imports
    const supportedLanguages = [
      'javascript', 'typescript', 'jsx', 'tsx', 'css', 'html', 
      'csharp', 'fsharp', 'python', 'java', 'bash', 'shell',
      'sql', 'yaml', 'json', 'markdown', 'powershell', 'vbnet'
    ];
    
    // Only try to load supported languages
    if (supportedLanguages.includes(language)) {
      import(`prismjs/components/prism-${language}`).catch(() => {
        console.warn(`Failed to load language: ${language}`);
      });
    }
  } catch (error) {
    console.warn(`Error loading language: ${language}`, error);
  }
}; 