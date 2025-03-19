// Function to load fonts from the Electron app's user data directory
export async function loadLocalFonts() {
  try {
    // Get the fonts path from the Electron API
    const fontsPath = await window.electron.getFontsPath();
    
    // Create a style element
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: 'Fira Code';
        src: local('Fira Code'),
             url('${fontsPath}/FiraCode-Regular.woff2') format('woff2');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }

      @font-face {
        font-family: 'JetBrains Mono';
        src: local('JetBrains Mono'),
             url('${fontsPath}/JetBrainsMono-Regular.woff2') format('woff2');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }

      @font-face {
        font-family: 'Cascadia Code';
        src: local('Cascadia Code'),
             url('${fontsPath}/CascadiaCode-Regular.woff2') format('woff2');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
    `;
    
    // Add the style element to the document head
    document.head.appendChild(style);
    
    console.log('Local fonts loaded successfully');
  } catch (error) {
    console.error('Error loading local fonts:', error);
  }
} 