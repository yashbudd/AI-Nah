import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

type HazardInput = {
  id?: string;
  latitude: number;
  longitude: number;
  confidence?: number;
  type?: string;
};

type AzureRiskResponse = {
  risks: Array<{
    id?: string;
    latitude: number;
    longitude: number;
    riskScore: number;
  }>;
};

const DEFAULT_RADIUS_METERS = 250; // neighbors within 250 m
const MAX_NEIGHBOR_BONUS = 5;

function metersPerDegLat() {
  return 111_320;
}

function metersPerDegLng(latDeg: number) {
  return 111_320 * Math.cos((latDeg * Math.PI) / 180);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distanceMeters(a: HazardInput, b: HazardInput, mPerLat: number, mPerLng: number) {
  const dLat = (a.latitude - b.latitude) * mPerLat;
  const dLng = (a.longitude - b.longitude) * mPerLng;
  return Math.hypot(dLat, dLng);
}

function computeLocalRisk(hazards: HazardInput[], radiusMeters = DEFAULT_RADIUS_METERS) {
  if (!hazards.length) return [] as AzureRiskResponse['risks'];

  const latMid = hazards.reduce((sum, h) => sum + h.latitude, 0) / hazards.length;
  const mPerLat = metersPerDegLat();
  const mPerLng = metersPerDegLng(latMid);

  return hazards.map((hazard) => {
    const confidence = typeof hazard.confidence === 'number' ? clamp(hazard.confidence, 0, 1) : 0.5;
    const baseScore = confidence * 6; // up to 6 points from confidence

    let neighborContribution = 0;
    for (const other of hazards) {
      if (other === hazard) continue;
      const distance = distanceMeters(hazard, other, mPerLat, mPerLng);
      if (distance <= radiusMeters) {
        const weight = (radiusMeters - distance) / radiusMeters; // 0..1
        neighborContribution += weight;
      }
    }

    neighborContribution = clamp(neighborContribution, 0, MAX_NEIGHBOR_BONUS);
    const riskScore = clamp(baseScore + neighborContribution, 0, 10);

    return {
      id: hazard.id,
      latitude: hazard.latitude,
      longitude: hazard.longitude,
      riskScore,
    };
  });
}

async function fetchHazardsFromDb() {
  const { db } = await connectToDatabase();
  const hazards = await db
    .collection('hazards')
    .find({})
    .limit(5000)
    .project({
      latitude: 1,
      longitude: 1,
      confidence: 1,
      type: 1,
    })
    .toArray();

  return hazards.map((h) => ({
    id: h._id?.toString(),
    latitude: h.latitude,
    longitude: h.longitude,
    confidence: h.confidence,
    type: h.type,
  })) as HazardInput[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const radiusMeters = typeof body.radiusMeters === 'number' ? body.radiusMeters : DEFAULT_RADIUS_METERS;

    let hazards: HazardInput[] = Array.isArray(body.hazards)
      ? (body.hazards as HazardInput[])
      : await fetchHazardsFromDb();

    hazards = hazards.filter(
      (h) =>
        typeof h.latitude === 'number' &&
        typeof h.longitude === 'number' &&
        !Number.isNaN(h.latitude) &&
        !Number.isNaN(h.longitude)
    );

    if (!hazards.length) {
      return NextResponse.json({ risks: [] });
    }

    const azureEndpoint = process.env.AZURE_RISK_ENDPOINT;
    const azureKey = process.env.AZURE_RISK_KEY;

    if (azureEndpoint && azureKey) {
      try {
        const azureResponse = await fetch(azureEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': azureKey,
          },
          body: JSON.stringify({ hazards, radiusMeters }),
        });

        if (azureResponse.ok) {
          const azureJson = (await azureResponse.json()) as AzureRiskResponse;
          if (Array.isArray(azureJson?.risks)) {
            return NextResponse.json(azureJson);
          }
        } else {
          const errorText = await azureResponse.text();
          console.warn('Azure risk endpoint returned error', azureResponse.status, errorText);
        }
      } catch (error) {
        console.warn('Azure risk endpoint call failed, falling back to local scoring', error);
      }
    }

    const risks = computeLocalRisk(hazards, radiusMeters);
    return NextResponse.json({ risks });
  } catch (error: any) {
    console.error('hazard-risk API error', error);
    return NextResponse.json({ error: error?.message ?? 'Failed to compute hazard risk' }, { status: 500 });
  }
}
