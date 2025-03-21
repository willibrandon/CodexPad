/**
 * @fileoverview Database service using electron-store for persistent storage.
 * Provides a simple key-value store with schema validation for snippets.
 * @module db
 */

const Store = require('electron-store');

/**
 * @typedef {Object} DBSchema
 * @property {Object} snippets - Schema for snippets array
 * @property {string} snippets.type - Type of the snippets property (array)
 * @property {Array} snippets.default - Default value for snippets (empty array)
 */

/**
 * Schema definition for the electron-store database.
 * Defines the structure and default values for stored data.
 * @type {DBSchema}
 */
const schema = {
  snippets: {
    type: 'array',
    default: []
  }
};

/**
 * Initialized electron-store instance with schema validation.
 * Provides persistent storage with automatic loading and saving.
 * @type {Store}
 */
const db = new Store({ schema });

// Initialize snippets array if it doesn't exist
if (!db.has('snippets')) {
  db.set('snippets', []);
}

module.exports = db;
