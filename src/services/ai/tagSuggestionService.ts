/**
 * @fileoverview Tag suggestion service using TensorFlow.js
 * This module provides AI-powered tag suggestions for snippets with
 * fallback to frequency-based suggestions when the model is not ready.
 * @module tagSuggestionService
 */

import * as tf from '@tensorflow/tfjs';
import { Snippet } from '../../App';
import { modelInitializer } from './modelInitializer';

// Configure TensorFlow memory management for minimal memory footprint
tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
tf.env().set('WEBGL_FLUSH_THRESHOLD', 1);
tf.env().set('KEEP_INTERMEDIATE_TENSORS', false);
tf.env().set('CPU_HANDOFF_SIZE_THRESHOLD', 128);
tf.setBackend('cpu'); // Force CPU backend for lower memory usage

// Cache for suggestion results to avoid redundant processing
interface SuggestionCacheEntry {
  suggestions: string[];
  timestamp: number;
}

/**
 * Service class for generating tag suggestions for snippets.
 * Uses word frequency analysis for memory efficiency.
 */
export class TagSuggestionService {
  /** TensorFlow model for tag suggestions - kept as null to save memory */
  private model: tf.LayersModel | null = null;
  /** List of words in the training vocabulary */
  private vocabulary: string[] = [];
  /** Maximum number of words in vocabulary */
  private maxWords = 500; // Reduced from 1000
  /** Maximum length of input sequences */
  private maxSequenceLength = 50; // Reduced from 100
  /** Flag indicating if the service is initialized */
  private isInitialized = false;
  /** Flag indicating if model training is in progress */
  private isTraining = false;
  /** Flag indicating if the model is initialized */
  private modelInitialized = false;
  /** Cache for suggestions to reduce redundant processing */
  private suggestionCache: Map<string, SuggestionCacheEntry> = new Map();
  /** Time in milliseconds that cached suggestions are considered valid */
  private cacheTTL = 300000; // 5 minutes - increased from 1 minute
  /** Counter to trigger memory cleanup */
  private processCount = 0;
  /** Set of stopwords to exclude from tag suggestions */
  private stopWords = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'will', 'not',
    'are', 'was', 'were', 'been', 'has', 'had', 'would', 'could', 'should',
    'what', 'when', 'where', 'which', 'who', 'whom', 'why', 'how', 'any',
    'all', 'some', 'many', 'few', 'most', 'other', 'such', 'only', 'then',
    'than', 'can', 'may', 'might', 'must', 'shall', 'should', 'will', 'would'
  ]);

  constructor() {
    // Memory optimization - prune cache at intervals
    setInterval(() => this.cleanupCache(), 60000); // Clean cache every minute
  }

  /**
   * Initializes the tag suggestion service with existing snippets.
   * @param {Snippet[]} snippets - Array of snippets to initialize with
   * @returns {Promise<void>}
   */
  public async initialize(snippets: Snippet[]) {
    if (this.isInitialized) return;
    
    // Just mark as initialized without loading model to save memory
    this.isInitialized = true;
    
    // Update vocabulary from snippets (limited to most common words)
    this.updateVocabularyFromSnippets(snippets);
    
    // Let worker know we're ready, but avoid loading the actual model
    await modelInitializer.initialize([]);
    
    console.log('Tag suggestion service initialized with vocabulary-only approach');
  }

  /**
   * Update vocabulary from a collection of snippets
   * @private
   * @param {Snippet[]} snippets - Array of snippets
   */
  private updateVocabularyFromSnippets(snippets: Snippet[]) {
    // Count word frequency across all snippets
    const wordCount: {[key: string]: number} = {};
    
    // Process each snippet
    for (const snippet of snippets) {
      if (!snippet.content) continue;
      
      // Only process the first 1000 chars of each snippet
      const trimmedContent = snippet.content.substring(0, 1000);
      const words = trimmedContent.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => 
          word.length > 3 && 
          !this.stopWords.has(word)
        );
      
      // Count occurrences
      for (const word of words) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    }
    
    // Convert to array of [word, count] pairs and sort by frequency
    const wordPairs = Object.entries(wordCount);
    wordPairs.sort((a, b) => b[1] - a[1]);
    
    // Take the most frequent words up to maxWords
    this.vocabulary = wordPairs
      .slice(0, this.maxWords)
      .map(pair => pair[0]);
    
    console.log(`Vocabulary updated with ${this.vocabulary.length} words`);
  }

  /**
   * Generates a unique key for caching suggestions
   * @private
   * @param {string} content - The content being analyzed
   * @param {string[]} existingTags - The current tags
   * @returns {string} A cache key
   */
  private getCacheKey(content: string, existingTags: string[]): string {
    // Use a hash of content to save memory in the cache key
    const contentHash = this.hashString(content.substring(0, 100));
    return `${contentHash}_${existingTags.sort().join(',')}`;
  }
  
  /**
   * Creates a simple hash of a string
   * @private
   * @param {string} str - String to hash
   * @returns {number} Hash value
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  /**
   * Suggests tags for the given content.
   * Uses word frequency analysis for memory efficiency.
   * @param {string} content - Content to suggest tags for
   * @param {string[]} existingTags - Array of existing tags to exclude
   * @returns {Promise<string[]>} Array of suggested tags
   */
  public async suggestTags(content: string, existingTags: string[] = []): Promise<string[]> {
    // Skip if content is too short
    if (!content || content.length < 20) {
      return [];
    }
    
    // Limit content to reduce memory usage (only take first 1500 characters)
    const trimmedContent = content.substring(0, 1500);
    
    // Check cache first
    const cacheKey = this.getCacheKey(trimmedContent, existingTags);
    const cachedResult = this.suggestionCache.get(cacheKey);
    if (cachedResult && (Date.now() - cachedResult.timestamp) < this.cacheTTL) {
      return cachedResult.suggestions;
    }
    
    // Get suggestions using simple word frequency
    const suggestions = this.getSimpleSuggestions(trimmedContent, existingTags);
    
    // Cache the result
    this.suggestionCache.set(cacheKey, {
      suggestions,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    this.processCount++;
    if (this.processCount % 10 === 0) {
      this.cleanupCache();
      
      // Force tensor cleanup
      try {
        tf.disposeVariables();
        tf.tidy(() => {});
      } catch (e) {
        console.error('Error during tag suggestion memory cleanup', e);
      }
    }
    
    return suggestions;
  }

  /**
   * Cleans up old entries from the suggestion cache
   * @private
   */
  private cleanupCache() {
    // Keep cache size reasonable
    if (this.suggestionCache.size > 20) {
      const now = Date.now();
      
      // Convert to array first to avoid iterator issues
      const entriesToRemove: string[] = [];
      this.suggestionCache.forEach((entry, key) => {
        if (now - entry.timestamp > this.cacheTTL) {
          entriesToRemove.push(key);
        }
      });
      
      // Delete old entries
      entriesToRemove.forEach(key => {
        this.suggestionCache.delete(key);
      });
      
      // If we still have too many entries, remove the oldest ones
      if (this.suggestionCache.size > 20) {
        const entries = Array.from(this.suggestionCache.entries());
        // Sort by timestamp (oldest first)
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        // Remove oldest entries to keep only 20
        const toRemove = entries.slice(0, entries.length - 20);
        toRemove.forEach(([key]) => {
          this.suggestionCache.delete(key);
        });
      }
    }
  }

  /**
   * Generates tag suggestions based on word frequency analysis.
   * @private
   * @param {string} content - Content to analyze
   * @param {string[]} existingTags - Array of existing tags to exclude
   * @returns {string[]} Array of suggested tags
   */
  private getSimpleSuggestions(content: string, existingTags: string[]): string[] {
    // Extract keywords from content as potential tags
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
      .replace(/\s+/g, ' ')      // Replace multiple spaces with single space
      .split(/\s+/)              // Split on whitespace
      .filter(word => 
        word.length > 3 &&                   // Only words longer than 3 characters
        !existingTags.includes(word) &&      // Not already used as a tag
        !this.stopWords.has(word)            // Not a stop word
      );

    // Use object instead of Map for better performance with string keys
    const wordFreq: {[key: string]: number} = {};
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }

    // Convert to array of [word, frequency] pairs
    const pairs: [string, number][] = [];
    for (const word in wordFreq) {
      // Only consider words in our vocabulary or with high frequency
      if (this.vocabulary.includes(word) || wordFreq[word] > 2) {
        pairs.push([word, wordFreq[word]]);
      }
    }

    // Sort by frequency and get top 5
    pairs.sort((a, b) => b[1] - a[1]);
    const suggestions = pairs.slice(0, 5).map(pair => pair[0]);

    return suggestions;
  }
}

/** Singleton instance of the TagSuggestionService */
export const tagSuggestionService = new TagSuggestionService(); 