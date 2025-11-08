export type HazardIn = {
  type: 'debris' | 'blockage' | 'water' | 'branch' | 'other';
  confidence: number;                       // 0..1
  source?: 'tfjs' | 'gemini' | 'manual';
  bbox?: [number, number, number, number];  // [x,y,w,h] in px
  frameSize?: [number, number];             // [w,h]
  position?: { lat: number; lng: number };  // GPS fix
};

export async function postHazards(hazards: HazardIn[] | HazardIn) {
  try {
    await fetch('/api/hazards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hazards),
      keepalive: true,
    });
  } catch {
    // ignore network errors in demo
  }
}

// COCO → hazard category mapping
export function mapToHazard(label: string): HazardIn['type'] {
  const l = label.toLowerCase();

  // debris/litter
  if (
    [
      'bottle', 'cup', 'wine glass', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
      'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'sandwich',
      'cell phone', 'book', 'sports ball', 'frisbee', 'skateboard', 'baseball glove',
      'baseball bat', 'remote', 'toothbrush', 'hair drier', 'handbag', 'tie', 'mouse', 'keyboard',
      'backpack', 'umbrella'
    ].includes(l)
  ) return 'debris';

  // blockage/obstruction
  if (
    [
      'chair', 'bench', 'couch', 'bed', 'dining table', 'tv', 'refrigerator',
      'suitcase', 'stop sign', 'traffic light', 'parking meter', 'potted plant'
    ].includes(l)
  ) return 'blockage';

  // water/wet indicator
  if (['sink', 'toilet', 'fire hydrant'].includes(l)) return 'water';

  return 'other';
}