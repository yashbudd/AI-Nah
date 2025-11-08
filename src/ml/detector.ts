import type { DetResult } from '@/types/hazard';

export type DetectorOpts = { scoreThreshold?: number; maxDetections?: number };

export class Detector {
  private worker: Worker;
  private inited = false;

  constructor() {
    this.worker = new Worker(new URL('./detector.worker.ts', import.meta.url), { type: 'module' });
  }

  init(): Promise<void> {
    if (this.inited) return Promise.resolve();
    return new Promise((resolve) => {
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type === 'init-ok') {
          this.inited = true;
          this.worker.removeEventListener('message', onMessage);
          resolve();
        }
      };
      this.worker.addEventListener('message', onMessage);
      this.worker.postMessage({ type: 'init' });
    });
  }

  run(frame: ImageBitmap, opts: DetectorOpts): Promise<DetResult[]> {
    return new Promise((resolve) => {
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type === 'results') {
          this.worker.removeEventListener('message', onMessage);
          resolve(e.data.results as DetResult[]);
        }
      };
      this.worker.addEventListener('message', onMessage);
      this.worker.postMessage({ type: 'run', frame, ...opts }, [frame]);
    });
  }

  destroy() { this.worker.terminate(); }
}