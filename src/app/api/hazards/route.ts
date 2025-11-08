import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

type HazardIn = {
  type: 'debris' | 'blockage' | 'water' | 'branch' | 'other';
  confidence: number;
  source?: 'tfjs' | 'gemini' | 'manual';
  bbox?: [number, number, number, number];
  frameSize?: [number, number];
  position?: { lat: number; lng: number };
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as HazardIn | HazardIn[];
    const items = Array.isArray(body) ? body : [body];

    const cleaned = items
      .map(h => ({
        type: h.type ?? 'other',
        confidence: Math.max(0, Math.min(1, Number(h.confidence) || 0)),
        source: h.source ?? 'tfjs',
        bbox: h.bbox,
        frameSize: h.frameSize,
        position: h.position,
        ts: new Date().toISOString(),
      }))
      .filter(h => h.confidence >= 0.5);

    if (!cleaned.length) return Response.json({ ok: true, inserted: 0 });

    const db = await getDb();
    const col = db.collection('hazards');

    // insert all (basic)
    const res = await col.insertMany(cleaned as any[]);
    return Response.json({ ok: true, inserted: res.insertedCount });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? 'unknown' }), { status: 500 });
  }
}

export async function GET() {
  const db = await getDb();
  const col = db.collection('hazards');
  const list = await col.find({}).sort({ ts: -1 }).limit(50).toArray();
  return Response.json({ ok: true, hazards: list });
}