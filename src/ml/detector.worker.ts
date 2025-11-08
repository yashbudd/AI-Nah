import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import cocoSsd from '@tensorflow-models/coco-ssd';

let model: cocoSsd.ObjectDetection | null = null;

self.onmessage = async (event) => {
  const msg = event.data;

  if (msg.type === 'init') {
    try {
      await tf.setBackend('webgl');
      await tf.ready();
      model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      // @ts-ignore
      self.postMessage({ type: 'init-ok' });
    } catch (err: any) {
      // @ts-ignore
      self.postMessage({ type: 'init-error', message: err?.message ?? 'init failed' });
    }
  }

  if (msg.type === 'run') {
    if (!model) return;
    const { frame, scoreThreshold = 0.5, maxDetections = 10 } = msg;
    const preds = await model.detect(frame, maxDetections);
    const results = preds
      .filter(p => p.score >= scoreThreshold)
      .map(p => ({
        label: p.class,
        score: p.score,
        bbox: p.bbox as [number, number, number, number],
      }));
    // @ts-ignore
    self.postMessage({ type: 'results', results });
    frame.close();
  }
};