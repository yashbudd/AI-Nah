// src/app/api/hazards/route.ts
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

// Minimal input contract
type HazardIn = {
  type: 'debris' | 'blockage' | 'water' | 'branch' | 'other';
  confidence: number;                   // 0..1
  source?: 'tfjs' | 'gemini' | 'manual';
  bbox?: [number, number, number, number]; // [x,y,w,h] in px (optional)
  frameSize?: [number, number];            // [w,h] (optional)
  position?: { lat: number; lng: number }; // phone GPS if available
};

// Basic response
type HazardOut = HazardIn & {
  _id: string;
  ts: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as HazardIn | HazardIn[];

    // accept single or batch
    const items = Array.isArray(body) ? body : [body];

    // validate minimally
    const cleaned = items
      .map((h) => ({
        type: h.type ?? 'other',
        confidence: Math.max(0, Math.min(1, Number(h.confidence) || 0)),
        source: h.source ?? 'tfjs',
        bbox: h.bbox,
        frameSize: h.frameSize,
        position: h.position,
        ts: new Date().toISOString(),
      }))
      .filter((h) => h.confidence >= 0.5); // drop low-confidence noise

    if (!cleaned.length) {
      return new Response(JSON.stringify({ ok: true, inserted: 0 }), { status: 200 });
    }

    const db = await getDb();
    const col = db.collection('hazards');

    // simple de-dup: collapse same type within ~25m/2min
    const results: HazardOut[] = [];
    for (const h of cleaned) {
      const near = h.position
        ? await col.findOne({
            type: h.type,
            'position.lat': { $exists: true, $gt: h.position.lat - 0.00025, $lt: h.position.lat + 0.00025 },
            'position.lng': { $exists: true, $gt: h.position.lng - 0.00025, $lt: h.position.lng + 0.00025 },
            ts: { $gte: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
          })
        : null;

      if (near) {
        // optional: raise confidence slightly
        await col.updateOne({ _id: near._id }, { $max: { confidence: h.confidence }, $set: { ts: h.ts } });
        results.push({ ...(near as any), confidence: Math.max(near.confidence, h.confidence) });
      } else {
        const r = await col.insertOne(h);
        results.push({ ...(h as any), _id: String(r.insertedId) });
      }
    }

    return Response.json({ ok: true, inserted: results.length, hazards: results });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? 'unknown' }), { status: 500 });
  }
}

export async function GET() {
  const db = await getDb();
  const col = db.collection('hazards');
  const last = await col.find({}).sort({ ts: -1 }).limit(50).toArray();
  return Response.json({ ok: true, hazards: last });
}