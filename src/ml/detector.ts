// src/ml/detector.ts
import type { DetResult } from '@/types/hazard';

// Optional detection options you can tweak when calling .run()
export type DetectorOpts = {
  scoreThreshold?: number;
  maxDetections?: number;
};

/**
 * Detector
 * - Spawns a dedicated Web Worker for COCO-SSD model inference
 * - Handles initialization, run, and cleanup
 */
export class Detector {
  private worker: Worker;
  private inited = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Create a new worker using the same folder as this file
    this.worker = new Worker(new URL('./detector.worker.ts', import.meta.url), {
      type: 'module',
    });
  }

  /**
   * Initialize the model in the worker.
   * You MUST await this before calling run().
   */
  async init(): Promise<void> {
    if (this.inited) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type === 'init-ok') {
          this.inited = true;
          this.worker.removeEventListener('message', onMessage);
          resolve();
        } else if (e.data?.type === 'init-error') {
          this.worker.removeEventListener('message', onMessage);
          reject(new Error(e.data.message || 'Failed to init detector'));
        }
      };

      this.worker.addEventListener('message', onMessage);
      this.worker.postMessage({ type: 'init' });
    });

    return this.initPromise;
  }

  /**
   * Run detection on a given ImageBitmap.
   * Returns an array of DetResult: { label, score, bbox }.
   */
  run(frame: ImageBitmap, opts: DetectorOpts = {}): Promise<DetResult[]> {
    return new Promise((resolve) => {
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type === 'results') {
          this.worker.removeEventListener('message', onMessage);
          resolve(e.data.results as DetResult[]);
        }
      };

      this.worker.addEventListener('message', onMessage);
      this.worker.postMessage(
        {
          type: 'run',
          frame,
          scoreThreshold: opts.scoreThreshold ?? 0.5,
          maxDetections: opts.maxDetections ?? 10,
        },
        [frame]
      );
    });
  }

  /** Destroy the worker when done to free memory. */
  destroy() {
    this.worker.terminate();
  }
}