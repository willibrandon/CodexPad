const Store = require('electron-store');

// Create schema for the store
const schema = {
  snippets: {
    type: 'array',
    default: []
  }
};

// Initialize the store
const db = new Store({ schema });

// If no snippets exist, initialize with empty array
if (!db.has('snippets')) {
  db.set('snippets', []);
}

module.exports = db;
