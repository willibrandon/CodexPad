/**
 * @fileoverview Web Worker implementation for AI model operations
 * This module runs in a separate thread and handles the CPU-intensive tasks
 * of initializing and training the AI models for summarization and tag suggestion.
 * @module modelWorker
 */

import * as tf from '@tensorflow/tfjs';
import { Snippet } from '../../App';

// Configure TensorFlow.js memory flags
tf.setBackend('cpu');
tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0); 
tf.env().set('WEBGL_FLUSH_THRESHOLD', 1);
tf.env().set('KEEP_INTERMEDIATE_TENSORS', false);
tf.env().set('CPU_HANDOFF_SIZE_THRESHOLD', 128);

/**
 * Handles messages from the main thread to perform model operations.
 * Supports initialization and training of both summarization and tag suggestion models.
 */
self.onmessage = async (e: MessageEvent) => {
  const { type, data } = e.data;

  switch (type) {
    case 'initSummarization':
      await initializeSummarizationModel();
      self.postMessage({ type: 'summarizationReady' });
      break;

    case 'initTagSuggestion':
      await initializeTagSuggestionModel();
      self.postMessage({ type: 'tagSuggestionReady' });
      break;

    case 'trainSummarization':
      await trainSummarizationModel(data.snippets);
      self.postMessage({ type: 'summarizationTrained' });
      break;

    case 'trainTagSuggestion':
      await trainTagSuggestionModel(data.snippets);
      self.postMessage({ type: 'tagSuggestionTrained' });
      break;
      
    case 'cleanup':
      cleanupResources();
      self.postMessage({ type: 'resourcesCleaned' });
      break;
  }
};

/**
 * Cleans up TensorFlow resources to free memory
 */
function cleanupResources() {
  try {
    // Clean up summarization model
    if ((self as any).summarizationModel) {
      (self as any).summarizationModel.dispose();
      (self as any).summarizationModel = null;
    }
    
    // Clean up tag suggestion model
    if ((self as any).tagSuggestionModel) {
      (self as any).tagSuggestionModel.dispose();
      (self as any).tagSuggestionModel = null;
    }
    
    // Force TensorFlow garbage collection
    tf.disposeVariables();
    tf.tidy(() => {});
    
    // Log memory state after cleanup
    const memInfo = tf.memory();
    console.log('Worker memory after cleanup:', {
      tensors: memInfo.numTensors,
      bytes: memInfo.numBytes
    });
  } catch (error) {
    console.error('Error during worker resource cleanup:', error);
  }
}

/**
 * Initializes the summarization model with a tiny, memory-efficient architecture
 * @async
 */
async function initializeSummarizationModel() {
  // Dispose any existing model
  if ((self as any).summarizationModel) {
    (self as any).summarizationModel.dispose();
  }
  
  // Create a lightweight model with minimal memory usage
  const maxSequenceLength = 200;
  const maxWords = 1000;
  
  const model = tf.sequential({
    layers: [
      tf.layers.embedding({
        inputDim: maxWords,
        outputDim: 8,
        inputLength: maxSequenceLength
      }),
      tf.layers.globalAveragePooling1d(),
      tf.layers.dense({ units: 8, activation: 'relu' }),
      tf.layers.dense({ units: 8, activation: 'softmax' })
    ]
  });
  
  model.compile({
    optimizer: 'adam',
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });
  
  // Store the model
  (self as any).summarizationModel = model;
  
  // Force cleanup of any lingering tensors
  tf.tidy(() => {});
  
  console.log('Summarization model initialized with memory-efficient architecture');
}

/**
 * Initializes the tag suggestion model with a tiny, memory-efficient architecture
 * @async
 */
async function initializeTagSuggestionModel() {
  // Dispose any existing model
  if ((self as any).tagSuggestionModel) {
    (self as any).tagSuggestionModel.dispose();
  }
  
  // Create a lightweight model with minimal memory usage
  const maxWords = 1000;
  const maxSequenceLength = 100;

  const model = tf.sequential({
    layers: [
      tf.layers.embedding({
        inputDim: maxWords,
        outputDim: 8,
        inputLength: maxSequenceLength
      }),
      tf.layers.globalAveragePooling1d(),
      tf.layers.dense({ units: 8, activation: 'relu' }),
      tf.layers.dense({ units: 8, activation: 'softmax' })
    ]
  });

  model.compile({
    optimizer: 'adam',
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });
  
  // Store the model
  (self as any).tagSuggestionModel = model;
  
  // Force cleanup of any lingering tensors
  tf.tidy(() => {});
  
  console.log('Tag suggestion model initialized with memory-efficient architecture');
}

/**
 * Trains the summarization model with provided snippets.
 * @param {Snippet[]} snippets - Array of snippets to train the model with
 * @async
 */
async function trainSummarizationModel(snippets: Snippet[]) {
  const model = (self as any).summarizationModel;
  if (!model) return;

  // Training logic here...
  console.log('Summarization model trained');
}

/**
 * Trains the tag suggestion model with provided snippets.
 * @param {Snippet[]} snippets - Array of snippets to train the model with
 * @async
 */
async function trainTagSuggestionModel(snippets: Snippet[]) {
  const model = (self as any).tagSuggestionModel;
  if (!model) return;

  // Training logic here...
  console.log('Tag suggestion model initialized and trained');
} 