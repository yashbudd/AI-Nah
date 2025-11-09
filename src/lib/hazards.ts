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
    const hazardArray = Array.isArray(hazards) ? hazards : [hazards];
    
    // Hardcoded trail coordinates for demo purposes
    const baseLat = 33.9869289;
    const baseLng = -85.047884;
    
    // Convert each hazard for database storage
    for (const hazard of hazardArray) {
      // Generate random coordinates very close to the hardcoded trail location
      // Spread them out in a ~30m radius (much tighter clustering)
      const randomOffsetLat = (Math.random() - 0.5) * 0.0003; // ~16m range
      const randomOffsetLng = (Math.random() - 0.5) * 0.0003; // ~16m range
      
      const demoLat = baseLat + randomOffsetLat;
      const demoLng = baseLng + randomOffsetLng;

      // Map 'blockage' AI detection type to 'blocked' database type
      const dbType = hazard.type === 'blockage' ? 'blocked' : hazard.type;

      const dbHazard = {
        longitude: demoLng,
        latitude: demoLat,
        type: dbType,
        confidence: hazard.confidence,
        source: 'ai' as const,
        description: `AI detected ${hazard.type} with ${Math.round(hazard.confidence * 100)}% confidence`
      };

      await fetch('/api/hazards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbHazard),
        keepalive: true,
      });
    }
  } catch (error) {
    console.error('Error posting hazards:', error);
    // ignore network errors in demo but log for debugging
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