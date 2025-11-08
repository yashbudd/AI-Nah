type HazardIn = {
    type: 'debris' | 'blockage' | 'water' | 'branch' | 'other';
    confidence: number;
    source?: 'tfjs' | 'gemini' | 'manual';
    bbox?: [number, number, number, number];
    frameSize?: [number, number];
    position?: { lat: number; lng: number };
  };
  
  export async function postHazards(hazards: HazardIn[] | HazardIn) {
    await fetch('/api/hazards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hazards),
    });
  }
  
  export function mapToHazard(label: string): HazardIn['type'] {
    const l = label.toLowerCase();
    if (['bottle', 'cup', 'fork', 'knife', 'spoon'].includes(l)) return 'debris';
    if (['chair', 'bench'].includes(l)) return 'blockage';
    if (['sink', 'toilet'].includes(l)) return 'water'; 
    return 'other';
  }