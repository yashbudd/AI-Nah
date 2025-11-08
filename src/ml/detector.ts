'use client';

import type { DetResult } from '@/types/hazard';

export type DetectorOpts = { scoreThreshold?: number; maxDetections?: number };

export class Detector {
  private worker!: Worker;
  private inited = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Only construct a Worker in the browser
    if (typeof window === 'undefined') {
      // @ts-expect-error SSR no-op
      this.worker = null;
      return;
    }

    // Turbopack/Next-safe construction
    this.worker = new Worker(
      new URL('./detector.worker.ts', import.meta.url),
      { type: 'module' }
    );
  }

  async init(): Promise<void> {
    if (this.inited) return;
    if (this.initPromise) return this.initPromise;

    if (typeof window === 'undefined' || !this.worker) {
      // Nothing to do on the server
      this.inited = true;
      return;
    }

    this.initPromise = new Promise<void>((resolve, reject) => {
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type === 'init-ok') {
          this.worker.removeEventListener('message', onMessage);
          this.worker.removeEventListener('error', onError);
          this.inited = true;
          resolve();
        } else if (e.data?.type === 'init-error') {
          this.worker.removeEventListener('message', onMessage);
          this.worker.removeEventListener('error', onError);
          reject(new Error(e.data?.message ?? 'Worker init error'));
        }
      };
      const onError = (err: unknown) => {
        this.worker.removeEventListener('message', onMessage);
  
        this.worker.removeEventListener('error', onError);
        reject(err instanceof Error ? err : new Error('Worker error'));
      };

      this.worker.addEventListener('message', onMessage);
     
      this.worker.addEventListener('error', onError);

      this.worker.postMessage({ type: 'init' });
    });

    return this.initPromise;
  }

  run(frame: ImageBitmap, opts: DetectorOpts = {}): Promise<DetResult[]> {
    if (!this.worker) return Promise.resolve([]);
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

  destroy() {
    if (this.worker) this.worker.terminate();
  }
}