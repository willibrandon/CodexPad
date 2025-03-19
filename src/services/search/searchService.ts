import { Snippet } from '../../App';
import * as tf from '@tensorflow/tfjs';

interface SearchOperator {
  type: 'tag' | 'favorite' | 'language' | 'created' | 'updated' | 'text';
  value: string;
  negate?: boolean;
}

interface SearchOptions {
  caseSensitive?: boolean;
  fuzzyMatch?: boolean;
}

export class SearchService {
  private readonly operatorRegex = /(-?\b\w+:|-)(\S+)/g;
  
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

export const searchService = new SearchService(); 