import * as tf from "@tensorflow/tfjs";
import * as coco from "@tensorflow-models/coco-ssd";

let model: coco.ObjectDetection | null = null;

export async function loadModel() {
  if (!model) {
    await tf.ready();
    model = await coco.load();
  }
  return model!;
}

/** returns { type: "debris"|"water"|"blocked", confidence } or null */
export async function detectHazardOnCanvas(canvas: HTMLCanvasElement) {
  if (!model) await loadModel();
  const predictions = await model!.detect(canvas);

  // VERY NAIVE mapping for demo. Works for staged props:
  // - "debris": if "bench" or "potted plant" or "stop sign" shaped junk appears in path (use size check)
  // - "water": look for large low-texture regions (we approximate by checking a big "cup" or "sink" or nothing → fallback Gemini)
  // - "blocked": if we see "chair" across a hallway

  const foundChair = predictions.find(p => p.class === "chair" && p.score! > 0.6);
  if (foundChair) return { type: "blocked" as const, confidence: foundChair.score! };

  const foundPlant = predictions.find(p => (p.class === "potted plant" || p.class === "bench") && p.score! > 0.6);
  if (foundPlant) return { type: "debris" as const, confidence: foundPlant.score! };

  // If nothing obvious, return null; the UI can call Gemini for confirmation
  return null;
}
