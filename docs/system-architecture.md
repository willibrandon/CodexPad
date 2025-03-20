# CodexPad System Architecture

CodexPad is a modern code snippet management application built with Electron, React, and TypeScript. It features a rich UI for code editing, a reliable storage system, and synchronization capabilities.

## Table of Contents

- [Overview](#overview)
- [User Interface](#user-interface)
- [Data Storage](#data-storage)
- [Synchronization Server](#synchronization-server)
- [Backup System](#backup-system)
- [Theming System](#theming-system)

## Overview

CodexPad is designed to help developers store, organize, and quickly access code snippets. The application consists of:

- An Electron-based desktop application (Windows, macOS, Linux)
- A Go-based synchronization server
- SQLite for persistent storage

## User Interface

### Components

The UI is built with React and TypeScript, with the following key components:

- **App** - The main application container
- **AppMenu** - Custom application menu with File, Edit, and View options
- **SnippetList** - Displays available snippets with search and filter capabilities
- **SnippetEditor** - Monaco-based code editor with syntax highlighting
- **TabsBar** - Manages open snippets in a tabbed interface
- **WindowControls** - Custom window controls (minimize, maximize, close)
- **ThemeToggle** - Switches between light and dark modes
- **ThemeSettings** - More detailed theme configuration

### UI Features

- Custom titlebar with integrated menus
- Responsive layout with resizable panels
- Tabs for multiple open snippets
- Code editor with syntax highlighting
- Tag-based organization
- Search functionality
- Keyboard shortcuts
- Command palette

## Data Storage

### Local Storage

CodexPad uses a multi-tiered approach to data storage:

1. **Primary Storage**: Electron Store (`electron-store`)
   - JSON-based document store
   - Located in the user's application data folder
   - Automatically handles saving and loading

2. **Data Structure**:
   ```typescript
   interface Snippet {
     id: number;
     title: string;
     content: string;
     createdAt: string; // ISO date string
     updatedAt: string; // ISO date string
     tags: string[];
     favorite: boolean;
   }
   ```

3. **CRUD Operations**:
   - `getAllSnippets()`: Retrieves all snippets sorted by update date
   - `createSnippet()`: Adds a new snippet with a unique ID
   - `updateSnippet()`: Modifies an existing snippet
   - `deleteSnippet()`: Removes a snippet
   - `searchSnippets()`: Filters snippets by search term

### Snippets Service

The snippets service in `src/services/snippetService.js` provides the interface between the UI and storage:

- Manages snippet creation, updates, and deletion
- Handles sorting and filtering
- Maintains data consistency
- Implements business logic like favorite toggling

## Synchronization Server

### Architecture

The synchronization server is written in Go and provides real-time synchronization between different instances of CodexPad:

1. **WebSocket Communication**:
   - Maintains persistent connections with clients
   - Enables real-time updates across devices
   - Handles message passing and state synchronization

2. **Server Endpoints**:
   - `/sync` - WebSocket endpoint for real-time synchronization
   - `/health` - Health check endpoint
   - `/backup` - Manual backup trigger endpoint
   - `/stats` - Server statistics endpoint

3. **Key Components**:
   - **SyncManager**: Handles client connections and message routing
   - **DBManager**: Manages database operations
   - **BackupService**: Handles database backups

### Database

The server uses SQLite for data persistence:

1. **Location**:
   - Main database: `~/.codexpad/codexpad.db`
   - Backups: `~/.codexpad/backups/codexpad_YYYY-MM-DD_HH-MM-SS.db`

2. **Schema**:
   - `snippets` - Stores code snippets
   - `tags` - Stores tag definitions
   - `snippet_tags` - Junction table for snippet-tag relationships
   - `sync_states` - Tracks synchronization state per client
   - `change_log` - Records modifications for conflict resolution

3. **Synchronization Protocol**:
   - `push`: Send local changes to the server
   - `pull`: Request the latest version of a snippet
   - `confirm`: Acknowledgment of received changes
   - `update`: Notify about changes to snippets

## Backup System

### Automatic Backups

The backup system ensures data safety through:

1. **Regular Backups**:
   - Automatic backups every 6 hours
   - Manual backup option via the UI

2. **Retention Policy**:
   - Keeps the last 30 backups
   - Retains backups for up to 30 days
   - Automatically prunes older backups

3. **Backup Location**:
   - Backups stored in `~/.codexpad/backups/`
   - Filenames include timestamps: `codexpad_YYYY-MM-DD_HH-MM-SS.db`

### Conflict Resolution

The system includes mechanisms to handle synchronization conflicts:

- Version tracking for each snippet
- Change logs to record modification history
- Client identification for change attribution
- Last-write-wins conflict resolution strategy with history preservation

## Theming System

### Theme Management

CodexPad supports a flexible theming system:

1. **Theme Options**:
   - Light and dark modes
   - Custom color schemes
   - Editor theme customization

2. **Implementation**:
   - CSS variables for consistent theming
   - Context-based theme switching
   - Persistence of user preferences

3. **Key Files**:
   - `src/contexts/ThemeContext.tsx` - Theme state management
   - `src/light-mode.css` and `src/dark-mode.css` - Theme definitions
   - `src/components/ThemeSettings.tsx` - UI for theme configuration

## AI Features

CodexPad includes local AI capabilities to enhance the user experience:

1. **Tag Suggestions**:
   - Analyzes snippet content to suggest relevant tags
   - Improves organization and discoverability
   - Implemented in `src/services/ai/tagSuggestionService.ts`

2. **Content Summarization**:
   - Generates concise previews of snippet content
   - Improves browsing experience in the snippet list
   - Implemented in `src/services/ai/summarizationService.ts`

3. **Local Processing**:
   - Uses TensorFlow.js for client-side machine learning
   - Ensures privacy by keeping all data on the user's device
   - Adaptive models that improve with usage

More details can be found in [AI Features](ai-features.md) documentation.

## Export and Import

### Export Formats

CodexPad can export snippets in multiple formats:

- Markdown (.md)
- HTML (.html)
- PDF (.pdf)

### Import Sources

The application supports importing snippets from:

- Other snippet applications
- Markdown files
- Plain text

## Development

### Technology Stack

- **Frontend**: React, TypeScript, CSS
- **Backend**: Electron, Node.js
- **Sync Server**: Go, WebSockets
- **Database**: SQLite, Electron Store
- **Build Tools**: Webpack, Electron Builder

### Project Structure

- `/public` - Static assets and Electron main process
- `/src` - React application and renderer process
- `/server` - Go synchronization server
- `/docs` - Documentation 