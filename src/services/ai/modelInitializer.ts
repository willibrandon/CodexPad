/**
 * @fileoverview Manages the initialization and lifecycle of AI models in a Web Worker
 * This module handles the creation, initialization, and training of AI models
 * in a separate thread to prevent blocking the main UI thread.
 * @module modelInitializer
 */

import { Snippet } from '../../App';

/**
 * Manages the lifecycle of AI models running in a Web Worker.
 * Handles model initialization, training, and cleanup operations.
 */
class ModelInitializer {
  /** Reference to the Web Worker instance */
  private worker: Worker | null = null;
  /** Flag indicating if models have been initialized */
  private isInitialized = false;

  constructor() {
    this.initWorker();
  }

  /**
   * Initializes the Web Worker and sets up message handlers.
   * Creates a new worker instance if one doesn't exist.
   * @private
   */
  private initWorker() {
    if (this.worker) return;
    
    // Create worker
    this.worker = new Worker(new URL('./modelWorker.ts', import.meta.url));

    // Set up message handlers
    this.worker.onmessage = (e: MessageEvent) => {
      const { type } = e.data;
      switch (type) {
        case 'summarizationReady':
          console.log('Summarization model initialized with optimized architecture');
          break;
        case 'tagSuggestionReady':
          console.log('Tag suggestion model initialized with optimized architecture');
          break;
        case 'summarizationTrained':
          console.log('Summarization model trained');
          break;
        case 'tagSuggestionTrained':
          console.log('Tag suggestion model initialized and trained');
          break;
      }
    };
  }

  /**
   * Initializes and trains the AI models with existing snippets.
   * This method is idempotent - calling it multiple times will only initialize once.
   * @param {Snippet[]} snippets - Array of existing snippets to train the models with
   * @returns {Promise<void>}
   */
  public async initialize(snippets: Snippet[]) {
    if (this.isInitialized || !this.worker) return;

    // Initialize models in background
    this.worker.postMessage({ type: 'initSummarization' });
    this.worker.postMessage({ type: 'initTagSuggestion' });

    // Train models with existing snippets
    this.worker.postMessage({ type: 'trainSummarization', data: { snippets } });
    this.worker.postMessage({ type: 'trainTagSuggestion', data: { snippets } });

    this.isInitialized = true;
  }

  /**
   * Cleans up resources by terminating the Web Worker.
   * Should be called when the application is shutting down.
   */
  public dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isInitialized = false;
  }
}

/** Singleton instance of the ModelInitializer */
export const modelInitializer = new ModelInitializer(); 