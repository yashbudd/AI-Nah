import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI!;
const dbName = process.env.MONGODB_DB || 'trailmix';

let client: MongoClient | null = null;
async function db() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
    const d = client.db(dbName);
    // Ensure geospatial index once
    await d.collection('hazards').createIndex({ loc: '2dsphere' }).catch(() => {});
  }
  return client.db(dbName);
}

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

    const docs = items
      .map((h) => {
        const loc = h.position
          ? { type: 'Point', coordinates: [h.position.lng, h.position.lat] as [number, number] }
          : undefined;
        return {
          type: h.type ?? 'other',
          confidence: Math.max(0, Math.min(1, Number(h.confidence) || 0)),
          source: h.source ?? 'tfjs',
          bbox: h.bbox,
          frameSize: h.frameSize,
          position: h.position,
          loc,
          ts: new Date(),
        };
      })
      .filter((d) => d.confidence >= 0.5);

    if (!docs.length) return NextResponse.json({ ok: true, inserted: 0 });

    const d = await db();
    const res = await d.collection('hazards').insertMany(docs as any[]);
    return NextResponse.json({ ok: true, inserted: res.insertedCount });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown' }, { status: 500 });
  }
}

/**
 * GET /api/hazards
 *   - all recent: /api/hazards
 *   - near a point: /api/hazards?near=lat,lng&km=1
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const near = searchParams.get('near');
  const km = Number(searchParams.get('km') ?? 1);

  const d = await db();
  const col = d.collection('hazards');

  if (near) {
    const [latS, lngS] = near.split(',');
    const lat = Number(latS), lng = Number(lngS);
    const q = {
      loc: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: Math.max(50, km * 1000), // meters
        },
      },
    };
    const list = await col.find(q).sort({ ts: -1 }).limit(200).toArray();
    return NextResponse.json({ ok: true, hazards: list });
  }

  const list = await col.find({}).sort({ ts: -1 }).limit(100).toArray();
  return NextResponse.json({ ok: true, hazards: list });
}