import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// --- Tunables ---
const DEFAULT_RES_M = 8; // grid cell ~8 m
const DIAG_COST = Math.SQRT2;
const HAZARD = {
  debris:   { radius: 10, weight: 4 },
  blockage: { radius: 25, weight: 20 },
  water:    { radius: 30, weight: 30 },
  other:    { radius: 8,  weight: 2 },
} as const;

// crude meters-per-degree at given latitude
function metersPerDegLat() { return 111_320; }
function metersPerDegLng(latDeg: number) { return 111_320 * Math.cos(latDeg * Math.PI / 180); }

type LL = { lat: number; lng: number };
type BBox = [minLng: number, minLat: number, maxLng: number, maxLat: number];

type HazardDoc = {
  type: 'debris'|'blockage'|'water'|'other';
  position: LL;
  // optional extras you already store:
  confidence?: number;
};

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

// simple falloff: 1 / (1 + d) so closer hazards cost more
function falloff(meters: number) { return 1 / (1 + meters); }

// Build a cost grid; hazards add penalty to nearby cells
function buildCostGrid(bbox: BBox, resM: number, hazards: HazardDoc[]) {
  const latMid = (bbox[1] + bbox[3]) / 2;
  const mPerLat = metersPerDegLat();
  const mPerLng = metersPerDegLng(latMid);

  const widthM  = (bbox[2] - bbox[0]) * mPerLng;
  const heightM = (bbox[3] - bbox[1]) * mPerLat;

  const cols = Math.max(2, Math.ceil(widthM / resM));
  const rows = Math.max(2, Math.ceil(heightM / resM));

  const cost = new Float32Array(rows * cols).fill(1); // base traversal cost = 1

  // helper: lat/lng -> grid indices
  const toIJ = (p: LL) => {
    const j = Math.round(((p.lng - bbox[0]) * mPerLng) / resM);
    const i = Math.round(((p.lat - bbox[1]) * mPerLat) / resM);
    return { i: clamp(i, 0, rows - 1), j: clamp(j, 0, cols - 1) };
  };

  // smear hazard penalty into a radius around each hazard
  for (const h of hazards) {
    const spec = HAZARD[h.type] ?? HAZARD.other;
    const rCells = Math.ceil(spec.radius / resM);
    const { i, j } = toIJ(h.position);

    for (let di = -rCells; di <= rCells; di++) {
      for (let dj = -rCells; dj <= rCells; dj++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || ii >= rows || jj < 0 || jj >= cols) continue;
        const dm = Math.hypot(di, dj) * resM;
        if (dm > spec.radius) continue;
        const idx = ii * cols + jj;
        cost[idx] += spec.weight * falloff(dm); // additive penalty
      }
    }
  }

  return { cost, rows, cols, resM, bbox, latMid, mPerLng, mPerLat };
}

function ijToLatLng(i: number, j: number, grid: ReturnType<typeof buildCostGrid>): LL {
  const { bbox, resM, mPerLng, mPerLat } = grid;
  const lat = bbox[1] + (i * resM) / mPerLat;
  const lng = bbox[0] + (j * resM) / mPerLng;
  return { lat, lng };
}

function llToIJ(p: LL, grid: ReturnType<typeof buildCostGrid>) {
  const { bbox, mPerLng, mPerLat, resM, rows, cols } = grid;
  const j = Math.round(((p.lng - bbox[0]) * mPerLng) / resM);
  const i = Math.round(((p.lat - bbox[1]) * mPerLat) / resM);
  return { i: clamp(i, 0, rows - 1), j: clamp(j, 0, cols - 1) };
}

// A* on 8-connected grid
function astar(grid: ReturnType<typeof buildCostGrid>, start: LL, goal: LL) {
  const { rows, cols, cost } = grid;
  const s = llToIJ(start, grid);
  const g = llToIJ(goal, grid);

  const idx = (i: number, j: number) => i * cols + j;
  const gScore = new Float32Array(rows * cols).fill(Number.POSITIVE_INFINITY);
  const fScore = new Float32Array(rows * cols).fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array(rows * cols).fill(-1);

  const h = (i: number, j: number) => Math.hypot(i - g.i, j - g.j); // heuristic in cells
  const open = new Set<number>();
  const push = (i: number, j: number, gs: number) => {
    const k = idx(i, j);
    gScore[k] = gs;
    fScore[k] = gs + h(i, j);
    open.add(k);
  };

  push(s.i, s.j, 0);

  while (open.size) {
    // extract min fScore (small set; OK for now)
    let cur = -1, best = Infinity;
    for (const k of open) { if (fScore[k] < best) { best = fScore[k]; cur = k; } }
    if (cur === -1) break;
    open.delete(cur);
    const ci = Math.floor(cur / cols), cj = cur % cols;

    if (ci === g.i && cj === g.j) {
      // reconstruct
      const path: number[] = [cur];
      while (cameFrom[path[0]] !== -1) path.unshift(cameFrom[path[0]]);
      return path.map(k => {
        const i = Math.floor(k / cols), j = k % cols;
        return ijToLatLng(i, j, grid);
      });
    }

    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || ni >= rows || nj < 0 || nj >= cols) continue;
      const k = idx(ni, nj);
      const step = (di && dj) ? DIAG_COST : 1;
      const tentative = gScore[cur] + step * cost[k];
      if (tentative < gScore[k]) {
        cameFrom[k] = cur;
        gScore[k] = tentative;
        fScore[k] = tentative + h(ni, nj);
        open.add(k);
      }
    }
  }
  return null;
}

async function getDb() {
  const uri = process.env.MONGODB_URI!;
  const dbName = process.env.MONGODB_DB || 'trailmix';
  const client = new MongoClient(uri);
  await client.connect();
  return client.db(dbName);
}

export async function POST(req: NextRequest) {
  try {
    const { bbox, start, end, resolutionMeters }: {
      bbox: BBox, start: LL, end: LL, resolutionMeters?: number
    } = await req.json();

    if (!bbox || !start || !end) {
      return NextResponse.json({ error: 'bbox, start, end required' }, { status: 400 });
    }

    const resM = Math.max(3, Math.min(50, resolutionMeters ?? DEFAULT_RES_M));

    // load hazards in bbox from Mongo
    const db = await getDb();
    const hazards = await db.collection<{
      type: HazardDoc['type'],
      position: LL
    }>('hazards')
      .find({
        'position.lng': { $gte: bbox[0], $lte: bbox[2] },
        'position.lat': { $gte: bbox[1], $lte: bbox[3] },
      })
      .limit(5000)
      .toArray();

    // build cost grid and route
    const grid = buildCostGrid(bbox, resM, hazards as HazardDoc[]);
    const path = astar(grid, start, end);
    if (!path) return NextResponse.json({ error: 'no-route' }, { status: 422 });

    // return as GeoJSON LineString
    const coordinates = path.map(p => [p.lng, p.lat]);
    return NextResponse.json({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates },
      properties: { resM, nodes: coordinates.length }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'server error' }, { status: 500 });
  }
}