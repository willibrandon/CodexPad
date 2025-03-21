import { Snippet } from '../../App';
import * as tf from '@tensorflow/tfjs';

/**
 * Represents a search operator used to filter snippets.
 * Operators can be used in search queries to filter by specific attributes.
 */
interface SearchOperator {
  /** Type of the search operator (e.g., 'tag:', 'is:', etc.) */
  type: 'tag' | 'favorite' | 'language' | 'created' | 'updated' | 'text';
  /** Value associated with the operator */
  value: string;
  /** Whether to negate/exclude the condition */
  negate?: boolean;
}

/**
 * Configuration options for search operations.
 */
interface SearchOptions {
  /** Whether to perform case-sensitive search */
  caseSensitive?: boolean;
  /** Whether to use fuzzy matching for text search */
  fuzzyMatch?: boolean;
}

/**
 * Service class for searching and filtering snippets.
 * Provides advanced search capabilities with operator support.
 * 
 * Supported operators:
 * - tag: Filter by tag (e.g., "tag:javascript")
 * - language: Filter by code language (e.g., "language:python")
 * - created: Filter by creation date (e.g., "created:>2023-01-01")
 * - updated: Filter by update date (e.g., "updated:<2024-01-01")
 * - is: Filter by status (e.g., "is:favorite")
 * - -term: Exclude snippets containing term
 */
export class SearchService {
  /** Regular expression for matching search operators in query string */
  private readonly operatorRegex = /(-?\b\w+:|-)(\S+)/g;
  
  /**
   * Searches snippets based on a query string with operator support.
   * 
   * Example queries:
   * - "tag:javascript language:typescript" - Find TypeScript snippets tagged with 'javascript'
   * - "is:favorite created:>2023-01-01" - Find favorite snippets created after Jan 1, 2023
   * - "-deprecated function" - Find snippets containing 'function' but not 'deprecated'
   * 
   * @param query - The search query string with optional operators
   * @param snippets - Array of snippets to search through
   * @returns Promise resolving to filtered array of snippets matching the query
   */
  async searchSnippets(query: string, snippets: Snippet[]): Promise<Snippet[]> {
    if (!query.trim()) {
      return snippets;
    }

    // Extract operators and their values
    const operators: { [key: string]: string[] } = {
      tag: [],
      language: [],
      created: [],
      updated: [],
      is: [],
      exclude: []
    };
    
    // Extract the plain text (without operators)
    let plainText = query;
    
    // Find all operators in the query
    let match;
    while ((match = this.operatorRegex.exec(query)) !== null) {
      const [fullMatch, operator, value] = match;
      plainText = plainText.replace(fullMatch, '').trim();
      
      if (operator.startsWith('-') && !operator.includes(':')) {
        // Handle exclusion terms
        operators.exclude.push(value.toLowerCase());
      } else {
        // Handle other operators
        const op = operator.replace(':', '').toLowerCase();
        if (op in operators) {
          operators[op].push(value.toLowerCase());
        }
      }
    }

    return snippets.filter(snippet => {
      // Check exclusions first
      if (operators.exclude.some(term => 
        snippet.title.toLowerCase().includes(term) || 
        snippet.content.toLowerCase().includes(term)
      )) {
        return false;
      }

      // Check tag filters
      if (operators.tag.length > 0 && 
          !operators.tag.some(tag => 
            snippet.tags.some(t => t.toLowerCase() === tag)
          )) {
        return false;
      }

      // Check language filters (look for ```language blocks in content)
      if (operators.language.length > 0) {
        const languageMatches = snippet.content.match(/```(\w+)/g);
        const languages = languageMatches 
          ? languageMatches.map(m => m.replace('```', '').toLowerCase())
          : [];
        if (!operators.language.some(lang => languages.includes(lang))) {
          return false;
        }
      }

      // Check favorite status
      if (operators.is.includes('favorite') && !snippet.favorite) {
        return false;
      }

      // Check date filters
      for (const dateOp of operators.created) {
        if (!this.checkDateFilter(dateOp, new Date(snippet.createdAt))) {
          return false;
        }
      }
      
      for (const dateOp of operators.updated) {
        if (!this.checkDateFilter(dateOp, new Date(snippet.updatedAt))) {
          return false;
        }
      }

      // If there's plain text, check for matches in title and content
      if (plainText) {
        const searchTerm = plainText.toLowerCase();
        return snippet.title.toLowerCase().includes(searchTerm) ||
               snippet.content.toLowerCase().includes(searchTerm);
      }

      return true;
    });
  }

  /**
   * Checks if a date matches a filter condition.
   * Supports operators: >, <, >=, <=, = (default)
   * 
   * @param filter - Filter string in format "[operator]date" (e.g., ">2023-01-01")
   * @param date - Date to check against the filter
   * @returns True if the date matches the filter condition
   * @private
   */
  private checkDateFilter(filter: string, date: Date): boolean {
    const operators = {
      '>': (a: Date, b: Date) => a > b,
      '<': (a: Date, b: Date) => a < b,
      '>=': (a: Date, b: Date) => a >= b,
      '<=': (a: Date, b: Date) => a <= b,
    };

    // Extract operator and date value
    const match = filter.match(/^([<>]=?)?(.+)$/);
    if (!match) return true;

    const [, op = '=', dateStr] = match;
    const filterDate = new Date(dateStr);

    if (isNaN(filterDate.getTime())) {
      return true; // Invalid date format, ignore filter
    }

    switch (op) {
      case '>':
      case '<':
      case '>=':
      case '<=':
        return operators[op](date, filterDate);
      default:
        return date.toDateString() === filterDate.toDateString();
    }
  }
}

/** Singleton instance of the SearchService */
export const searchService = new SearchService(); 