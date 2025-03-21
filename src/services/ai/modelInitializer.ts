/**
 * @fileoverview Manages the initialization and lifecycle of AI models in a Web Worker
 * This module handles the creation, initialization, and training of AI models
 * in a separate thread to prevent blocking the main UI thread.
 * @module modelInitializer
 */

import { Snippet } from '../../App';
import * as tf from '@tensorflow/tfjs';

/**
 * Manages the lifecycle of AI models running in a Web Worker.
 * Handles model initialization, training, and cleanup operations.
 */
class ModelInitializer {
  /** Reference to the Web Worker instance */
  private worker: Worker | null = null;
  /** Flag indicating if models have been initialized */
  private isInitialized = false;
  /** Flag indicating if app is in background */
  private isInBackground = false;

  constructor() {
    this.initWorker();
    this.setupVisibilityListeners();
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
        case 'resourcesCleaned':
          console.log('AI resources cleaned up');
          break;
      }
    };
  }
  
  /**
   * Sets up visibility change listeners to manage worker resources
   * when app is minimized or in background
   * @private
   */
  private setupVisibilityListeners() {
    // Handle visibility changes (app in background)
    document.addEventListener('visibilitychange', () => {
      const isVisible = document.visibilityState === 'visible';
      
      if (!isVisible && !this.isInBackground) {
        // App going to background - clean up resources
        this.isInBackground = true;
        this.cleanupUnusedResources();
      } else if (isVisible && this.isInBackground) {
        // App coming back to foreground
        this.isInBackground = false;
      }
    });
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
      this.dispose();
    });
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
   * Cleans up unused resources without terminating the worker
   * Used when app is in background to free memory
   */
  public cleanupUnusedResources() {
    if (this.worker) {
      this.worker.postMessage({ type: 'cleanup' });
      
      // Clean up local TensorFlow resources too
      try {
        // Safely check if TensorFlow engine and its methods exist
        if (tf && tf.engine && typeof tf.engine().startScope === 'function' 
            && typeof tf.engine().endScope === 'function') {
          try {
            // Create a new scope first to ensure we have something to end
            tf.engine().startScope();
            tf.engine().endScope();
          } catch (innerError) {
            console.warn('Could not manage TensorFlow scopes:', innerError);
          }
        }
        
        // Use tidy as a safer alternative to force cleanup
        if (tf && typeof tf.tidy === 'function') {
          tf.tidy(() => {});
        }
        
        // Force dispose of variables if available
        if (tf && typeof tf.disposeVariables === 'function') {
          tf.disposeVariables();
        }
      } catch (e) {
        console.error('Error cleaning up local TensorFlow resources', e);
      }
    }
  }

  /**
   * Cleans up resources by terminating the Web Worker.
   * Should be called when the application is shutting down.
   */
  public dispose() {
    if (this.worker) {
      // Send cleanup message first
      try {
        this.worker.postMessage({ type: 'cleanup' });
      } catch (e) {
        // Ignore errors if worker is already closing
      }
      
      // Terminate after a short delay to allow cleanup
      setTimeout(() => {
        if (this.worker) {
          this.worker.terminate();
          this.worker = null;
          this.isInitialized = false;
        }
      }, 100);
    }
  }
}

/** Singleton instance of the ModelInitializer */
export const modelInitializer = new ModelInitializer(); 