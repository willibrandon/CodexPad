import Database from 'better-sqlite3';
import { initializeDatabase, prepareStatements, DBSnippet, DBTag, PreparedStatements } from './db/dbSchema';

class SnippetService {
    private db: Database.Database;
    private statements: PreparedStatements;

    constructor() {
        this.db = initializeDatabase();
        this.statements = prepareStatements(this.db);
    }

    // Convert database snippet to app snippet
    private toAppSnippet(dbSnippet: DBSnippet) {
        return {
            id: dbSnippet.id,
            title: dbSnippet.title,
            content: dbSnippet.content,
            createdAt: dbSnippet.created_at,
            updatedAt: dbSnippet.updated_at,
            favorite: Boolean(dbSnippet.favorite),
            tags: dbSnippet.tags ? dbSnippet.tags.split(',').filter(Boolean) : []
        };
    }

    // Create a new snippet
    createSnippet(title: string, content: string, tags: string[] = []) {
        const now = new Date().toISOString();
        
        const result = this.db.transaction(() => {
            // Insert snippet
            const info = this.statements.insertSnippet.run(
                title,
                content,
                now,
                now,
                0 // not favorite by default
            );
            
            const snippetId = Number(info.lastInsertRowid);
            
            // Insert and link tags
            for (const tagName of tags) {
                const tagResult = this.statements.insertTag.get(tagName) as DBTag | undefined;
                const existingTag = this.statements.getTagByName.get(tagName) as DBTag;
                const tagId = tagResult?.id || existingTag.id;
                this.statements.linkSnippetTag.run(snippetId, tagId);
            }
            
            // Get the created snippet
            const newSnippet = this.statements.getSnippet.get(snippetId) as DBSnippet;
            return newSnippet;
        })();
        
        return this.toAppSnippet(result);
    }

    // Update an existing snippet
    updateSnippet(id: number, title: string, content: string, tags: string[] = [], favorite: boolean = false) {
        const now = new Date().toISOString();
        
        this.db.transaction(() => {
            // Update snippet
            this.statements.updateSnippet.run(
                title,
                content,
                now,
                favorite ? 1 : 0,
                id
            );
            
            // Update tags
            this.statements.clearSnippetTags.run(id);
            
            for (const tagName of tags) {
                const tagResult = this.statements.insertTag.get(tagName) as DBTag | undefined;
                const existingTag = this.statements.getTagByName.get(tagName) as DBTag;
                const tagId = tagResult?.id || existingTag.id;
                this.statements.linkSnippetTag.run(id, tagId);
            }
        })();
    }

    // Delete a snippet
    deleteSnippet(id: number) {
        this.statements.deleteSnippet.run(id);
    }

    // Get a single snippet by ID
    getSnippet(id: number) {
        const result = this.statements.getSnippet.get(id) as DBSnippet | undefined;
        return result ? this.toAppSnippet(result) : null;
    }

    // Get all snippets
    getAllSnippets() {
        const results = this.statements.getAllSnippets.all() as DBSnippet[];
        return results.map(result => this.toAppSnippet(result));
    }

    // Search snippets
    searchSnippets(query: string) {
        const searchPattern = `%${query}%`;
        const results = this.statements.searchSnippets.all(searchPattern, searchPattern) as DBSnippet[];
        return results.map(result => this.toAppSnippet(result));
    }

    // Get all unique tags
    getAllTags() {
        const results = this.statements.getAllTags.all() as DBTag[];
        return results.map(tag => tag.name);
    }

    // Close the database connection
    close() {
        this.db.close();
    }
}

// Create and export a singleton instance
const snippetService = new SnippetService();
module.exports = snippetService; 