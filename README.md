# CodexPad

A lightweight, tabbed scratch pad application for quick note-taking and code snippet storage built with React and Electron.

## Features

- 📝 Create and edit notes or code snippets
- 🔍 Search through your snippets
- 💾 Auto-saving functionality
- 🖥️ System tray integration
- ⌨️ Global hotkey (Ctrl+Shift+Space) to show/hide the app

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm

### Installation

1. Clone this repository
```
git clone https://github.com/yourusername/codexpad.git
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

- **Frontend:** React
- **Desktop Application:** Electron
- **Storage:** electron-store (JSON-based local storage)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
