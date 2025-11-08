const API = import.meta.env.VITE_API_URL as string;

export async function createHazard(body: any) {
  const res = await fetch(`${API}/hazards`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function getHazardsBBox(b: {minLng:number;minLat:number;maxLng:number;maxLat:number}) {
  const q = new URLSearchParams({
    minLng: String(b.minLng), minLat: String(b.minLat), maxLng: String(b.maxLng), maxLat: String(b.maxLat)
  });
  const res = await fetch(`${API}/hazards?`+q.toString());
  return res.json();
}

export async function classifyGemini(imageBase64: string) {
  const res = await fetch(`${API}/classify`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ imageBase64 })
  });
  return res.json();
}

export async function route(origin: string, dest: string) {
  const res = await fetch(`${API}/route?origin=${origin}&dest=${dest}`);
  return res.json();
}