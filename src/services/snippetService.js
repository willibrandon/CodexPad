const db = require('./db');

function getAllSnippets() {
  const snippets = db.get('snippets') || [];
  return snippets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function getSnippetById(id) {
  const snippets = db.get('snippets') || [];
  return snippets.find(snippet => snippet.id === id);
}

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

function deleteSnippet(id) {
  const snippets = db.get('snippets') || [];
  const updatedSnippets = snippets.filter(snippet => snippet.id !== id);
  
  db.set('snippets', updatedSnippets);
  return true;
}

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
