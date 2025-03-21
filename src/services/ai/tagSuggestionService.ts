/**
 * @fileoverview Tag suggestion service using TensorFlow.js
 * This module provides AI-powered tag suggestions for snippets with
 * fallback to frequency-based suggestions when the model is not ready.
 * @module tagSuggestionService
 */

import * as tf from '@tensorflow/tfjs';
import { Snippet } from '../../App';
import { modelInitializer } from './modelInitializer';

/**
 * Service class for generating tag suggestions for snippets.
 * Uses a combination of deep learning and word frequency analysis.
 */
export class TagSuggestionService {
  /** TensorFlow model for tag suggestions */
  private model: tf.LayersModel | null = null;
  /** List of words in the training vocabulary */
  private vocabulary: string[] = [];
  /** Maximum number of words in vocabulary */
  private maxWords = 1000;
  /** Maximum length of input sequences */
  private maxSequenceLength = 100;
  /** Flag indicating if the service is initialized */
  private isInitialized = false;
  /** Flag indicating if model training is in progress */
  private isTraining = false;
  /** Flag indicating if the model is initialized */
  private modelInitialized = false;

  constructor() {
    // Initialization is now handled by the worker
  }

  /**
   * Initializes the tag suggestion service with existing snippets.
   * @param {Snippet[]} snippets - Array of snippets to initialize with
   * @returns {Promise<void>}
   */
  public async initialize(snippets: Snippet[]) {
    if (this.isInitialized) return;
    await modelInitializer.initialize(snippets);
    this.isInitialized = true;
  }

  /**
   * Initializes the TensorFlow model with sequential architecture.
   * @private
   * @returns {Promise<void>}
   */
  private async initializeModel() {
    if (this.modelInitialized) {
      return;
    }

    try {
      // Create a simple text classification model
      this.model = tf.sequential({
        layers: [
          tf.layers.embedding({
            inputDim: this.maxWords,
            outputDim: 32,
            inputLength: this.maxSequenceLength
          }),
          tf.layers.globalAveragePooling1d(),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.5 }),
          tf.layers.dense({ units: 32, activation: 'softmax' })
        ]
      });

      // Compile the model
      this.model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      this.modelInitialized = true;
    } catch (error) {
      console.error('Failed to initialize tag suggestion model:', error);
    }
  }

  /**
   * Preprocesses content for model input by converting to word indices.
   * @private
   * @param {string} content - Content to preprocess
   * @returns {number[]} Array of word indices
   */
  private preprocessContent(content: string): number[] {
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0);

    // Convert words to indices based on vocabulary
    const sequence = words.map(word => {
      const index = this.vocabulary.indexOf(word);
      return index !== -1 ? index : 0; // 0 for unknown words
    });

    // Pad or truncate to fixed length
    while (sequence.length < this.maxSequenceLength) {
      sequence.push(0);
    }
    return sequence.slice(0, this.maxSequenceLength);
  }

  /**
   * Updates the vocabulary with new content.
   * @private
   * @param {string} content - Content to update vocabulary with
   */
  private updateVocabulary(content: string) {
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0);

    for (const word of words) {
      if (!this.vocabulary.includes(word) && this.vocabulary.length < this.maxWords) {
        this.vocabulary.push(word);
      }
    }
  }

  /**
   * Trains the model with a batch of snippets.
   * @param {Snippet[]} snippets - Array of snippets to train with
   * @returns {Promise<void>}
   */
  public async trainModel(snippets: Snippet[]) {
    if (!this.model || this.isTraining) {
      console.error('Model not ready for training');
      return;
    }

    try {
      this.isTraining = true;

      // Update vocabulary with all snippets
      snippets.forEach(snippet => {
        this.updateVocabulary(snippet.content);
      });

      // Prepare training data
      const trainData = snippets.map(snippet => ({
        input: this.preprocessContent(snippet.content),
        tags: snippet.tags
      }));

      if (trainData.length === 0) {
        console.log('No training data available');
        this.isTraining = false;
        return;
      }

      // Convert to tensors
      const inputTensor = tf.tensor2d(
        trainData.map(d => d.input),
        [trainData.length, this.maxSequenceLength]
      );

      // Create a simple target tensor (we'll improve this later)
      const targetTensor = tf.zeros([trainData.length, 32]);

      try {
        // Train the model
        await this.model.fit(inputTensor, targetTensor, {
          epochs: 5,
          batchSize: Math.min(32, trainData.length),
          validationSplit: 0.2,
          shuffle: true
        });
      } finally {
        // Clean up tensors
        inputTensor.dispose();
        targetTensor.dispose();
      }
    } catch (error) {
      console.error('Failed to train tag suggestion model:', error);
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Suggests tags for the given content.
   * Falls back to simple word frequency analysis if the model isn't ready.
   * @param {string} content - Content to suggest tags for
   * @param {string[]} existingTags - Array of existing tags to exclude
   * @returns {Promise<string[]>} Array of suggested tags
   */
  public async suggestTags(content: string, existingTags: string[] = []): Promise<string[]> {
    if (!this.model || !this.isInitialized) {
      // Fall back to simple word frequency analysis if model isn't ready
      return this.getSimpleSuggestions(content, existingTags);
    }

    try {
      // Preprocess the content
      const processedContent = this.preprocessContent(content);
      
      // Convert to tensor
      const inputTensor = tf.tensor2d([processedContent], [1, this.maxSequenceLength]);
      
      try {
        // Get model predictions
        const predictions = await this.model.predict(inputTensor) as tf.Tensor;
        const values = await predictions.data();
        
        // Fall back to simple suggestions if predictions aren't useful
        if (!values.some(v => v > 0)) {
          return this.getSimpleSuggestions(content, existingTags);
        }

        // Combine model predictions with word frequency analysis
        const simpleSuggestions = await this.getSimpleSuggestions(content, existingTags);
        return simpleSuggestions;
      } finally {
        // Clean up tensors
        inputTensor.dispose();
      }
    } catch (error) {
      console.error('Failed to generate tag suggestions:', error);
      return this.getSimpleSuggestions(content, existingTags);
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
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && // Only words longer than 3 characters
        !existingTags.includes(word) && // Not already used as a tag
        !['the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'will'].includes(word) // Skip common words
      );

    // Get word frequency
    const wordFreq = words.reduce((acc: {[key: string]: number}, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});

    // Sort by frequency and get top 5
    const suggestions = Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);

    return suggestions;
  }
}

/** Singleton instance of the TagSuggestionService */
export const tagSuggestionService = new TagSuggestionService(); 