import { Snippet } from '../../App';

class ModelInitializer {
  private worker: Worker | null = null;
  private isInitialized = false;

  constructor() {
    this.initWorker();
  }

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

  public dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isInitialized = false;
  }
}

export const modelInitializer = new ModelInitializer(); 