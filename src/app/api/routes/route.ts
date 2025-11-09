import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

// --- Tunables ---
const DEFAULT_RES_M = 8; // grid cell ~8 m
const DIAG_COST = Math.SQRT2;
const HAZARD = {
  debris:   { radius: 10, weight: 4 },
  blocked:  { radius: 25, weight: 20 }, // Note: database uses 'blocked', not 'blockage'
  blockage: { radius: 25, weight: 20 }, // Alias for compatibility
  branch:   { radius: 8,  weight: 3 },  // Branches are lighter debris
  water:    { radius: 30, weight: 30 },
  other:    { radius: 8,  weight: 2 },
} as const;

// crude meters-per-degree at given latitude
function metersPerDegLat() { return 111_320; }
function metersPerDegLng(latDeg: number) { return 111_320 * Math.cos(latDeg * Math.PI / 180); }

type LL = { lat: number; lng: number };
type BBox = [minLng: number, minLat: number, maxLng: number, maxLat: number];

type HazardDoc = {
  type: 'debris'|'blocked'|'water'|'branch'|'other';
  position: { lat: number; lng: number };
  confidence: number;
};

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

// simple falloff: 1 / (1 + d) so closer hazards cost more
function falloff(meters: number) { return 1 / (1 + meters); }

// Simplify path using Douglas-Peucker-like algorithm to remove redundant waypoints
function simplifyPath(path: LL[], minDistanceM: number): LL[] {
  if (path.length <= 2) return path;
  
  const simplified: LL[] = [path[0]];
  const latMid = path.reduce((sum, p) => sum + p.lat, 0) / path.length;
  const mPerLat = metersPerDegLat();
  const mPerLng = metersPerDegLng(latMid);
  
  // Distance calculation helper
  const dist = (p1: LL, p2: LL): number => {
    const dLat = (p2.lat - p1.lat) * mPerLat;
    const dLng = (p2.lng - p1.lng) * mPerLng;
    return Math.hypot(dLat, dLng);
  };
  
  for (let i = 1; i < path.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const curr = path[i];
    const next = path[i + 1];
    
    const distToPrev = dist(prev, curr);
    const distToNext = dist(curr, next);
    
    // Keep point if it's far enough from previous point
    if (distToPrev > minDistanceM) {
      simplified.push(curr);
    } else if (distToNext > minDistanceM) {
      // If next point is far, check if current point creates significant turn
      const angle1 = Math.atan2(curr.lat - prev.lat, curr.lng - prev.lng);
      const angle2 = Math.atan2(next.lat - curr.lat, next.lng - curr.lng);
      let angleDiff = Math.abs(angle1 - angle2);
      // Normalize angle difference to [0, PI]
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      
      // Keep if significant turn (more than 15 degrees)
      if (angleDiff > Math.PI / 12) {
        simplified.push(curr);
      }
    }
  }
  
  simplified.push(path[path.length - 1]); // Always keep last point
  return simplified;
}

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
    // Map 'blocked' to 'blockage' for hazard spec lookup, or use directly
    const hazardType = h.type === 'blocked' ? 'blockage' : h.type;
    const spec = HAZARD[hazardType as keyof typeof HAZARD] ?? HAZARD.other;
    const rCells = Math.ceil(spec.radius / resM);
    const { i, j } = toIJ(h.position);

    for (let di = -rCells; di <= rCells; di++) {
      for (let dj = -rCells; dj <= rCells; dj++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || ii >= rows || jj < 0 || jj >= cols) continue;
        const dm = Math.hypot(di, dj) * resM;
        if (dm > spec.radius) continue;
        const idx = ii * cols + jj;
        // Scale penalty by confidence if available (higher confidence = higher penalty)
        const confidenceMultiplier = h.confidence !== undefined ? h.confidence : 1.0;
        cost[idx] += spec.weight * falloff(dm) * confidenceMultiplier; // additive penalty
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

// A* on 8-connected grid with improved priority queue handling
function astar(grid: ReturnType<typeof buildCostGrid>, start: LL, goal: LL) {
  const { rows, cols, cost } = grid;
  const s = llToIJ(start, grid);
  const g = llToIJ(goal, grid);

  const idx = (i: number, j: number) => i * cols + j;
  const gScore = new Float32Array(rows * cols).fill(Number.POSITIVE_INFINITY);
  const fScore = new Float32Array(rows * cols).fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array(rows * cols).fill(-1);
  const closed = new Set<number>();
  const open = new Set<number>();

  // Heuristic: Euclidean distance in grid cells
  const h = (i: number, j: number) => Math.hypot(i - g.i, j - g.j);
  
  // Initialize start node
  const startIdx = idx(s.i, s.j);
  gScore[startIdx] = 0;
  fScore[startIdx] = h(s.i, s.j);
  open.add(startIdx);

  // Simple priority extraction (for small grids, this is acceptable)
  const getBestNode = (): number | null => {
    let bestIdx: number | null = null;
    let bestF = Infinity;
    for (const k of open) {
      if (fScore[k] < bestF) {
        bestF = fScore[k];
        bestIdx = k;
      }
    }
    return bestIdx;
  };

  let iterations = 0;
  const MAX_ITERATIONS = rows * cols * 10; // Safety limit

  while (open.size > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    const cur = getBestNode();
    if (cur === null) break;
    
    open.delete(cur);
    closed.add(cur);
    
    const ci = Math.floor(cur / cols);
    const cj = cur % cols;

    // Check if we reached the goal
    if (ci === g.i && cj === g.j) {
      // Reconstruct path
      const path: number[] = [cur];
      let current = cur;
      while (cameFrom[current] !== -1) {
        current = cameFrom[current];
        path.unshift(current);
      }
      return path.map(k => {
        const i = Math.floor(k / cols);
        const j = k % cols;
        return ijToLatLng(i, j, grid);
      });
    }

    // Explore 8-connected neighbors
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (di === 0 && dj === 0) continue;
        
        const ni = ci + di;
        const nj = cj + dj;
        
        // Bounds check
        if (ni < 0 || ni >= rows || nj < 0 || nj >= cols) continue;
        
        const neighborIdx = idx(ni, nj);
        
        // Skip if already processed
        if (closed.has(neighborIdx)) continue;
        
        // Calculate movement cost (diagonal vs straight)
        const moveCost = (di !== 0 && dj !== 0) ? DIAG_COST : 1.0;
        const cellCost = cost[neighborIdx];
        const tentativeG = gScore[cur] + moveCost * cellCost;
        
        // If this path to neighbor is better, update it
        if (tentativeG < gScore[neighborIdx]) {
          cameFrom[neighborIdx] = cur;
          gScore[neighborIdx] = tentativeG;
          fScore[neighborIdx] = tentativeG + h(ni, nj);
          
          // Add to open set if not already there
          if (!open.has(neighborIdx)) {
            open.add(neighborIdx);
          }
        }
      }
    }
  }

  // No path found
  console.warn(`A* failed: open=${open.size}, closed=${closed.size}, iterations=${iterations}`);
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { bbox, start, end, resolutionMeters }: {
      bbox: BBox, start: LL, end: LL, resolutionMeters?: number
    } = await req.json();

    if (!bbox || !start || !end) {
      return NextResponse.json({ error: 'bbox, start, end required' }, { status: 400 });
    }

    // Validate bbox
    if (bbox.length !== 4 || bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) {
      return NextResponse.json({ error: 'Invalid bbox format: [minLng, minLat, maxLng, maxLat]' }, { status: 400 });
    }

    // Validate start/end coordinates
    if (typeof start.lat !== 'number' || typeof start.lng !== 'number' ||
        typeof end.lat !== 'number' || typeof end.lng !== 'number') {
      return NextResponse.json({ error: 'Invalid start or end coordinates' }, { status: 400 });
    }

    const resM = Math.max(3, Math.min(50, resolutionMeters ?? DEFAULT_RES_M));

    // Load hazards in bbox from MongoDB using correct field names
    // Use a slightly expanded bbox to include nearby hazards that might affect routing
    const expansionFactor = 0.1; // 10% expansion
    const bboxWidth = bbox[2] - bbox[0];
    const bboxHeight = bbox[3] - bbox[1];
    const expandedBbox = {
      minLng: bbox[0] - bboxWidth * expansionFactor,
      maxLng: bbox[2] + bboxWidth * expansionFactor,
      minLat: bbox[1] - bboxHeight * expansionFactor,
      maxLat: bbox[3] + bboxHeight * expansionFactor,
    };

    const { db } = await connectToDatabase();
    const hazards = await db.collection('hazards')
      .find({
        longitude: { $gte: expandedBbox.minLng, $lte: expandedBbox.maxLng },
        latitude: { $gte: expandedBbox.minLat, $lte: expandedBbox.maxLat },
        type: { $in: ['debris', 'water', 'blocked', 'branch', 'other'] }
      })
      .limit(5000)
      .toArray();

    console.log(`Found ${hazards.length} hazards in expanded bbox for routing`);

    // Transform database hazards to routing format
    const routingHazards: HazardDoc[] = hazards.map((h: any) => ({
      type: h.type === 'blocked' ? 'blocked' : h.type,
      position: { lat: h.latitude, lng: h.longitude },
      confidence: h.confidence ?? 1.0
    }));

    // Build cost grid and route
    const grid = buildCostGrid(bbox, resM, routingHazards);
    console.log(`Built cost grid: ${grid.rows}x${grid.cols} cells, resolution=${resM}m`);
    
    const path = astar(grid, start, end);
    
    if (!path || path.length === 0) {
      console.warn(`No path found from (${start.lat}, ${start.lng}) to (${end.lat}, ${end.lng})`);
      return NextResponse.json({ 
        error: 'no-route', 
        message: 'Could not find a path between the selected points. Try selecting different start/end points.',
        bbox,
        hazardsCount: routingHazards.length
      }, { status: 422 });
    }

    console.log(`Found path with ${path.length} waypoints`);

    // Smooth the path by removing redundant waypoints
    const smoothedPath = simplifyPath(path, resM * 2); // Remove points within 2 cell distances
    
    // Return as GeoJSON LineString
    const coordinates = smoothedPath.map(p => [p.lng, p.lat]);
    return NextResponse.json({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates },
      properties: { 
        resM, 
        nodes: coordinates.length,
        hazardsCount: routingHazards.length,
        gridSize: `${grid.rows}x${grid.cols}`
      }
    });
  } catch (e: any) {
    console.error('Routing error:', e);
    return NextResponse.json({ 
      error: e?.message ?? 'server error',
      stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined
    }, { status: 500 });
  }
}