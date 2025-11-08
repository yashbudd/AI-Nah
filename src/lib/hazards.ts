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
      keepalive: true, // survives page unloads
    });
  } catch { /* ignore for demo */ }
}

// Map COCO classes -> your hazard taxonomy
export function mapToHazard(label: string): HazardIn['type'] {
  const l = label.toLowerCase();
  if (['bottle','cup','wine glass','fork','knife','spoon','bowl','can'].includes(l)) return 'debris';
  if (['chair','bench','couch','bed','dining table'].includes(l)) return 'blockage';
  if (['sink','toilet'].includes(l)) return 'water';
  return 'other';
}
