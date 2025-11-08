// src/ml/detector.worker.ts
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSsd from '@tensorflow-models/coco-ssd'; // ← namespace import

let model: cocoSsd.ObjectDetection | null = null;

self.onmessage = async (event: MessageEvent) => {
  const msg = event.data;

  if (msg?.type === 'init') {
    try {
      await tf.setBackend('webgl');
      await tf.ready();

      // Make sure the module actually loaded
      if (!cocoSsd || typeof cocoSsd.load !== 'function') {
        throw new Error('coco-ssd not available in worker');
      }

      model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });

      self.postMessage({ type: 'init-ok' });
    } catch (err: any) {
      self.postMessage({ type: 'init-error', message: err?.message ?? String(err) });
    }
    return;
  }

  if (msg?.type === 'run') {
    try {
      if (!model) throw new Error('Model not initialized');
      const { frame, maxDetections = 10, scoreThreshold = 0.5 } = msg;

      const preds = await model.detect(frame, maxDetections);
      const results = preds
        .filter((p) => p.score >= scoreThreshold)
        .map((p) => ({
          label: p.class,
          score: p.score,
          bbox: p.bbox as [number, number, number, number],
        }));

      self.postMessage({ type: 'results', results });
      if (frame && typeof frame.close === 'function') frame.close();
    } catch (err: any) {
      self.postMessage({ type: 'results', results: [] });
    }
  }
};