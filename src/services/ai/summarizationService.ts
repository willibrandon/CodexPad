import * as tf from '@tensorflow/tfjs';
import { Snippet } from '../../App';

export class SummarizationService {
  private model: tf.LayersModel | null = null;
  private vocabulary: Set<string> = new Set();
  private maxWords = 2000;
  private maxSequenceLength = 200;
  private outputDim = 16;  // Changed from 32 to match model architecture
  private isInitialized = false;
  private isTraining = false;
  private modelInitialized = false;

  constructor() {
    this.initializeModel();
  }

  private async initializeModel() {
    if (this.modelInitialized) {
      return;
    }

    try {
      const input = tf.input({ shape: [this.maxSequenceLength] });
      
      // Embedding layer with reduced dimensions
      const embedding = tf.layers.embedding({
        inputDim: this.maxWords,
        outputDim: 16,  // Reduced from 32
        inputLength: this.maxSequenceLength,
        embeddingsInitializer: 'glorotNormal'  // Use glorotNormal instead of orthogonal
      }).apply(input) as tf.SymbolicTensor;

      // Simpler LSTM layer
      const lstm = tf.layers.lstm({
        units: 16,  // Reduced from 32
        returnSequences: false,
        kernelInitializer: 'glorotNormal',
        recurrentInitializer: 'glorotNormal',
        implementation: 2  // Use more efficient implementation
      }).apply(embedding) as tf.SymbolicTensor;

      // Dense layers with consistent dimensions
      const dense1 = tf.layers.dense({
        units: 16,
        activation: 'relu',
        kernelInitializer: 'glorotNormal'
      }).apply(lstm) as tf.SymbolicTensor;

      const dropout = tf.layers.dropout({ rate: 0.2 }).apply(dense1) as tf.SymbolicTensor;

      const output = tf.layers.dense({
        units: 16,  // Match output dimension with other layers
        activation: 'sigmoid',
        kernelInitializer: 'glorotNormal'
      }).apply(dropout) as tf.SymbolicTensor;

      // Create model
      this.model = tf.model({ inputs: input, outputs: output });

      // Compile model with memory-efficient settings
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['accuracy']
      });

      this.modelInitialized = true;
      console.log('Summarization model initialized with optimized architecture');
    } catch (error) {
      console.error('Failed to initialize summarization model:', error);
    }
  }

  public async initialize(snippets: Snippet[]) {
    if (this.isInitialized || this.isTraining) {
      return;
    }

    try {
      // Wait for model to be ready
      let attempts = 0;
      while (!this.modelInitialized && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!this.modelInitialized) {
        throw new Error('Model initialization timeout');
      }

      // Train the model with existing snippets
      await this.trainModel(snippets);
      this.isInitialized = true;
      console.log('Summarization model trained');
    } catch (error) {
      console.error('Failed to initialize summarization service:', error);
      this.isInitialized = false;
      this.isTraining = false;
    }
  }

  private preprocessText(text: string): number[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);

    // Add words to vocabulary
    words.forEach(word => this.vocabulary.add(word));

    // Convert words to indices
    const sequence = words.map(word => 
      Array.from(this.vocabulary).indexOf(word) + 1
    );

    // Pad or truncate sequence
    while (sequence.length < this.maxSequenceLength) {
      sequence.push(0);
    }
    return sequence.slice(0, this.maxSequenceLength);
  }

  private async trainModel(snippets: Snippet[]) {
    if (!this.model || this.isTraining) {
      console.error('Model not ready for training');
      return;
    }

    try {
      this.isTraining = true;

      // Prepare training data
      const trainData = snippets
        .filter(snippet => {
          const wordCount = snippet.content.split(/\s+/).length;
          return wordCount >= 10 && wordCount <= 1000;
        })
        .map(snippet => ({
          input: this.preprocessText(snippet.content),
          target: new Array(this.outputDim).fill(0)  // Create target vector
            .map((_, i) => i < this.extractFirstSentence(snippet.content).length ? 1 : 0)
        }));

      if (trainData.length === 0) {
        console.log('No suitable training data available');
        this.isTraining = false;
        return;
      }

      // Convert to tensors with memory management
      const inputTensor = tf.tidy(() => tf.tensor2d(
        trainData.map(d => d.input),
        [trainData.length, this.maxSequenceLength]
      ));

      const targetTensor = tf.tidy(() => tf.tensor2d(
        trainData.map(d => d.target),
        [trainData.length, this.outputDim]
      ));

      try {
        await this.model.fit(inputTensor, targetTensor, {
          epochs: 3,
          batchSize: 16,
          validationSplit: 0.1,
          shuffle: true,
          callbacks: {
            onBatchEnd: async () => {
              await tf.nextFrame();
            }
          }
        });
      } finally {
        inputTensor.dispose();
        targetTensor.dispose();
      }
    } catch (error) {
      console.error('Failed to train summarization model:', error);
    } finally {
      this.isTraining = false;
    }
  }

  public async summarize(content: string, maxLength: number = 100): Promise<string> {
    if (!content) {
      return '';
    }

    // For very short content, just return as is
    if (content.length <= maxLength) {
      return content;
    }

    try {
      // If model isn't ready, fall back to extractive summarization
      if (!this.model || !this.isInitialized) {
        return this.extractiveSummarize(content, maxLength);
      }

      // Preprocess the content
      const processedContent = this.preprocessText(content);
      const inputTensor = tf.tensor2d([processedContent], [1, this.maxSequenceLength]);

      try {
        // Get model predictions
        const predictions = await this.model.predict(inputTensor) as tf.Tensor;
        const values = await predictions.data();

        // If predictions aren't useful, fall back to extractive summarization
        if (!values.some(v => v > 0)) {
          return this.extractiveSummarize(content, maxLength);
        }

        // For now, still use extractive summarization as the model needs more training
        return this.extractiveSummarize(content, maxLength);
      } finally {
        // Clean up tensors
        inputTensor.dispose();
      }
    } catch (error) {
      console.error('Failed to generate summary:', error);
      return this.extractiveSummarize(content, maxLength);
    }
  }

  private extractiveSummarize(content: string, maxLength: number): string {
    // Split into sentences
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    
    if (sentences.length === 0) {
      return content.substring(0, maxLength) + '...';
    }

    // Score sentences based on various factors
    const sentenceScores = sentences.map((sentence, index) => {
      const score = this.scoreSentence(sentence, index, sentences.length);
      return { sentence, score };
    });

    // Sort by score and select top sentences
    const topSentences = sentenceScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .sort((a, b) => sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence))
      .map(item => item.sentence);

    // Join sentences and trim to maxLength
    let summary = topSentences.join(' ').trim();
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength - 3) + '...';
    }

    return summary;
  }

  private scoreSentence(sentence: string, position: number, totalSentences: number): number {
    let score = 0;

    // Position score - favor early sentences
    score += (totalSentences - position) / totalSentences;

    // Length score - penalize very short or very long sentences
    const words = sentence.split(/\s+/).length;
    if (words > 5 && words < 30) {
      score += 0.3;
    }

    // Key phrase score
    const keyPhrases = ['important', 'significant', 'key', 'main', 'crucial', 'essential'];
    if (keyPhrases.some(phrase => sentence.toLowerCase().includes(phrase))) {
      score += 0.3;
    }

    // Code block score - favor sentences with code references
    if (sentence.includes('`') || sentence.includes('```')) {
      score += 0.4;
    }

    return score;
  }

  private extractFirstSentence(text: string): string {
    const match = text.match(/^[^.!?]+[.!?]+/);
    return match ? match[0] : text;
  }
}

export const summarizationService = new SummarizationService(); 