/**
 * @fileoverview Service for managing code snippets in the application.
 * Provides CRUD operations and search functionality for snippets.
 * @module snippetService
 */

const db = require('./db');

/**
 * @typedef {Object} Snippet
 * @property {number} id - Unique identifier for the snippet
 * @property {string} title - Title of the snippet
 * @property {string} content - Content/body of the snippet
 * @property {string} createdAt - ISO timestamp of when the snippet was created
 * @property {string} updatedAt - ISO timestamp of when the snippet was last updated
 * @property {string[]} tags - Array of tags associated with the snippet
 * @property {boolean} favorite - Whether the snippet is marked as favorite
 */

/**
 * Retrieves all snippets, sorted by last update time (newest first).
 * @returns {Snippet[]} Array of all snippets
 */
function getAllSnippets() {
  const snippets = db.get('snippets') || [];
  return snippets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/**
 * Retrieves a specific snippet by its ID.
 * @param {number} id - The ID of the snippet to retrieve
 * @returns {Snippet|undefined} The found snippet or undefined if not found
 */
function getSnippetById(id) {
  const snippets = db.get('snippets') || [];
  return snippets.find(snippet => snippet.id === id);
}

/**
 * Creates a new snippet with the given properties.
 * @param {string} title - The title of the snippet
 * @param {string} content - The content of the snippet
 * @param {string[]} [tags=[]] - Array of tags to associate with the snippet
 * @param {boolean} [favorite=false] - Whether to mark the snippet as favorite
 * @returns {number} The ID of the newly created snippet
 */
function createSnippet(title, content, tags = [], favorite = false) {
  const snippets = db.get('snippets') || [];
  const now = new Date().toISOString();
  
  // Generate a new ID based on timestamp if no snippets exist, or increment the highest existing ID
  const id = snippets.length > 0 
    ? Math.max(...snippets.map(s => s.id)) + 1 
    : 1;
  
  const newSnippet = {
    id,
    title,
    content,
    createdAt: now,
    updatedAt: now,
    tags,
    favorite
  };
  
  db.set('snippets', [newSnippet, ...snippets]);
  return id;
}

/**
 * Updates an existing snippet with new data.
 * @param {number} id - The ID of the snippet to update
 * @param {string} title - The new title
 * @param {string} content - The new content
 * @param {string[]} [tags=[]] - Array of updated tags
 * @param {boolean} [favorite=false] - Whether to mark the snippet as favorite
 * @returns {boolean} True if the update was successful
 */
function updateSnippet(id, title, content, tags = [], favorite = false) {
  const snippets = db.get('snippets') || [];
  const now = new Date().toISOString();
  
  const updatedSnippets = snippets.map(snippet => {
    if (snippet.id === id) {
      return {
        ...snippet,
        title,
        content,
        updatedAt: now,
        tags,
        favorite
      };
    }
    return snippet;
  });
  
  db.set('snippets', updatedSnippets);
  return true;
}

/**
 * Deletes a snippet by its ID.
 * @param {number} id - The ID of the snippet to delete
 * @returns {boolean} True if the deletion was successful
 */
function deleteSnippet(id) {
  const snippets = db.get('snippets') || [];
  const updatedSnippets = snippets.filter(snippet => snippet.id !== id);
  
  db.set('snippets', updatedSnippets);
  return true;
}

/**
 * Searches for snippets matching the given search term.
 * Searches in both title and content fields.
 * If no term is provided, returns all snippets.
 * Results are sorted by last update time (newest first).
 * @param {string} term - The search term
 * @returns {Snippet[]} Array of matching snippets
 */
function searchSnippets(term) {
  if (!term) {
    return getAllSnippets();
  }
  
  const snippets = db.get('snippets') || [];
  const searchTerm = term.toLowerCase();
  
  return snippets
    .filter(snippet => 
      snippet.title.toLowerCase().includes(searchTerm) || 
      snippet.content.toLowerCase().includes(searchTerm)
    )
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/**
 * Toggles the favorite status of a snippet.
 * @param {number} id - The ID of the snippet to toggle
 * @returns {boolean} True if the operation was successful
 */
function toggleFavorite(id) {
  const snippets = db.get('snippets') || [];
  const now = new Date().toISOString();
  
  const updatedSnippets = snippets.map(snippet => {
    if (snippet.id === id) {
      return {
        ...snippet,
        favorite: !snippet.favorite,
        updatedAt: now
      };
    }
    return snippet;
  });
  
  db.set('snippets', updatedSnippets);
  return true;
}

/**
 * Retrieves all unique tags used across all snippets.
 * @returns {string[]} Array of unique tag names, sorted alphabetically
 */
function getAllTags() {
  const snippets = db.get('snippets') || [];
  const tagSet = new Set();
  
  snippets.forEach(snippet => {
    snippet.tags.forEach(tag => tagSet.add(tag));
  });
  
  return Array.from(tagSet).sort();
}

module.exports = {
  getAllSnippets,
  getSnippetById,
  createSnippet,
  updateSnippet,
  deleteSnippet,
  searchSnippets,
  toggleFavorite,
  getAllTags
};
