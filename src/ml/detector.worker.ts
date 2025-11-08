import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import cocoSsd, { DetectedObject } from '@tensorflow-models/coco-ssd';

type InitMsg = { type: 'init' };
type RunMsg = { type: 'run'; frame: ImageBitmap; scoreThreshold?: number; maxDetections?: number };
type Msg = InitMsg | RunMsg;

// Infer the type of the model using ReturnType
type CocoSsdModel = Awaited<ReturnType<typeof cocoSsd.load>>;

let model: CocoSsdModel | null = null;
let ready = false;

async function ensureReady() {
  if (ready) return;
  await tf.setBackend('webgl');
  await tf.ready();
  model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
  ready = true;
}

self.onmessage = async (e: MessageEvent<Msg>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    await ensureReady();
    // @ts-ignore
    self.postMessage({ type: 'init-ok' });
    return;
  }

  if (msg.type === 'run') {
    await ensureReady();
    const { frame, scoreThreshold = 0.5, maxDetections = 10 } = msg;

    // Convert ImageBitmap to HTMLCanvasElement
    const canvas = new OffscreenCanvas(frame.width, frame.height); // Use OffscreenCanvas for workers
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas rendering context');
    }
    ctx.drawImage(frame, 0, 0);

    // Convert OffscreenCanvas to ImageData
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Use ImageData as input for the model
    const preds: DetectedObject[] = await model!.detect(imageData, maxDetections);
    const results = preds
      .filter(p => p.score >= scoreThreshold)
      .map(p => ({
        label: p.class,
        score: p.score,
        bbox: p.bbox as [number, number, number, number] // [x,y,w,h]
      }));

    // @ts-ignore
    self.postMessage({ type: 'results', results });
    frame.close(); // free memory
  }
};