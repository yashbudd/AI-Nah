import type { DetResult } from '@/types/hazard';

export type DetectorOpts = { scoreThreshold?: number; maxDetections?: number };

export class Detector {
  private worker: Worker;
  private inited = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.worker = new Worker(new URL('./detector.worker.ts', import.meta.url), { type: 'module' });
  }

  async init(): Promise<void> {
    if (this.inited) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type === 'init-ok') {
          this.worker.removeEventListener('message', onMessage);
          this.inited = true;
          resolve();
        }
        if (e.data?.type === 'init-error') {
          this.worker.removeEventListener('message', onMessage);
          reject(new Error(e.data?.message || 'Detector init failed'));
        }
      };
      this.worker.addEventListener('message', onMessage);
      this.worker.postMessage({ type: 'init' });
    });

    return this.initPromise;
  }

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

  destroy() {
    this.worker.terminate();
  }
}
