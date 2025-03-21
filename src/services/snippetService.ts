import Database from 'better-sqlite3';
import { initializeDatabase, prepareStatements, DBSnippet, DBTag, PreparedStatements } from './db/dbSchema';

/**
 * Interface representing a snippet in the application
 * @interface
 */
export interface AppSnippet {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  favorite: boolean;
  tags: string[];
}

/**
 * Service responsible for managing snippets in the application.
 * Handles CRUD operations and data transformation between database and application formats.
 */
class SnippetService {
    private db: Database.Database;
    private statements: PreparedStatements;

    constructor() {
        this.db = initializeDatabase();
        this.statements = prepareStatements(this.db);
    }

    /**
     * Converts a database snippet to an application snippet format.
     * @param {DBSnippet} dbSnippet - The snippet from the database
     * @returns {AppSnippet} The snippet in application format
     * @private
     */
    private toAppSnippet(dbSnippet: DBSnippet): AppSnippet {
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

    /**
     * Creates a new snippet in the database.
     * @param {string} title - The title of the snippet
     * @param {string} content - The content of the snippet
     * @param {string[]} [tags=[]] - Array of tags associated with the snippet
     * @returns {AppSnippet} The created snippet in application format
     */
    createSnippet(title: string, content: string, tags: string[] = []): AppSnippet {
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

    /**
     * Updates an existing snippet in the database.
     * @param {number} id - The ID of the snippet to update
     * @param {string} title - The new title
     * @param {string} content - The new content
     * @param {string[]} [tags=[]] - Array of updated tags
     * @param {boolean} [favorite=false] - Whether the snippet is marked as favorite
     */
    updateSnippet(id: number, title: string, content: string, tags: string[] = [], favorite: boolean = false): void {
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

    /**
     * Deletes a snippet from the database.
     * @param {number} id - The ID of the snippet to delete
     */
    deleteSnippet(id: number): void {
        this.statements.deleteSnippet.run(id);
    }

    /**
     * Retrieves a single snippet by its ID.
     * @param {number} id - The ID of the snippet to retrieve
     * @returns {AppSnippet|null} The snippet in application format, or null if not found
     */
    getSnippet(id: number): AppSnippet | null {
        const result = this.statements.getSnippet.get(id) as DBSnippet | undefined;
        return result ? this.toAppSnippet(result) : null;
    }

    /**
     * Retrieves all snippets from the database.
     * @returns {AppSnippet[]} Array of all snippets in application format
     */
    getAllSnippets(): AppSnippet[] {
        const results = this.statements.getAllSnippets.all() as DBSnippet[];
        return results.map(result => this.toAppSnippet(result));
    }

    /**
     * Searches for snippets matching the given query.
     * Searches in both title and content fields.
     * @param {string} query - The search query
     * @returns {AppSnippet[]} Array of matching snippets in application format
     */
    searchSnippets(query: string): AppSnippet[] {
        const searchPattern = `%${query}%`;
        const results = this.statements.searchSnippets.all(searchPattern, searchPattern) as DBSnippet[];
        return results.map(result => this.toAppSnippet(result));
    }

    /**
     * Retrieves all unique tags used across all snippets.
     * @returns {string[]} Array of unique tag names
     */
    getAllTags(): string[] {
        const results = this.statements.getAllTags.all() as DBTag[];
        return results.map(tag => tag.name);
    }

    /**
     * Closes the database connection.
     * Should be called when the application is shutting down.
     */
    close(): void {
        this.db.close();
    }
}

// Create and export a singleton instance
const snippetService = new SnippetService();
module.exports = snippetService; 