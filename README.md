# CodexPad

A modern, feature-rich code snippet manager and note-taking application built with React and Electron.

## Features

### Core Functionality
- 📝 Create, edit, and organize code snippets and notes
- 🔍 Advanced search with filters and operators (tag:, language:, created:, etc.)
- 📂 Tag-based organization system with AI-powered tag suggestions
- 💾 Automatic saving functionality
- 📱 Responsive design that works across different screen sizes

### Modern UI/UX
- 🌙 Dark and light mode with multiple color schemes
- 🔤 Customizable fonts and sizing options
- ⌨️ Multi-tab interface for working with multiple snippets

### Productivity Features
- ⚡ Command palette (Ctrl+P) for quick access to commands
- 🔑 Extensive keyboard shortcuts for efficient navigation
- 👨‍💻 Syntax highlighting for various programming languages
- 🔄 Sync functionality to keep snippets updated across devices

### System Integration
- 🖥️ System tray integration
- 🔔 Global hotkey (Ctrl+Shift+Space) to show/hide the app
- 🚀 Quick startup and responsive performance

## Keyboard Shortcuts

### Navigation
- `Ctrl+Tab` - Navigate to next tab
- `Ctrl+Shift+Tab` - Navigate to previous tab
- `Ctrl+1-9` - Go to specific tab by number
- `Ctrl+W` - Close current tab

### Editing
- `Ctrl+N` - Create new snippet
- `Ctrl+S` - Save current snippet

### Search
- `Ctrl+F` - Focus the search bar
- `?` (in search) - Show search help popup

### Other
- `Ctrl+P` - Open command palette
- `F1` - Show keyboard shortcuts help

## Search Operators

CodexPad supports advanced search with the following operators:

- `tag:react` - Find snippets with specific tag
- `language:typescript` - Find snippets with specific language
- `created:>2024-01-01` - Created after date
- `updated:<2024-02-01` - Updated before date
- `is:favorite` - Show only favorites
- `-term` - Exclude results with term

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm

### Installation

1. Clone this repository
```
git clone https://github.com/willibrandon/codexpad.git
cd codexpad
```

2. Install dependencies
```
npm install
```

3. Start the application
```
npm start
```

This will start both the React development server and Electron application.

### Building for Production

To build the application for production:

```
npm run build
npm run build:electron
```

The packaged application will be available in the `dist` directory.

## Development

- `npm start` - Start both React and Electron in development mode
- `npm run start:react` - Start only the React development server
- `npm run start:electron` - Start only the Electron application
- `npm run build` - Build the React application
- `npm run build:electron` - Package the application for distribution

## Technology Stack

- **Frontend:** React, TypeScript
- **UI Framework:** Custom CSS with CSS variables for theming
- **Desktop Application:** Electron
- **Storage:** SQLite database via better-sqlite3
- **Code Editing:** Custom editor implementation

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
