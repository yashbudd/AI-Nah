import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Hazard, CreateHazardRequest, HazardResponse } from '@/types/hazard-db'
import { ObjectId } from 'mongodb'

// Get all hazards
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const collection = db.collection<Hazard>('hazards') // Use 'hazard' collection
    
    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const radius = searchParams.get('radius') // in kilometers
    const type = searchParams.get('type')
    
    let query: any = {}
    
    // Filter by type if provided
    if (type && ['debris', 'water', 'blocked'].includes(type)) {
      query.type = type
    }
    
    // Filter by location if lat/lng provided
    if (lat && lng) {
      const latitude = parseFloat(lat)
      const longitude = parseFloat(lng)
      const radiusKm = radius ? parseFloat(radius) : 10 // default 10km radius
      
      // Convert km to degrees (rough approximation)
      const radiusDegrees = radiusKm / 111.32 // 1 degree ≈ 111.32 km
      
      query.latitude = {
        $gte: latitude - radiusDegrees,
        $lte: latitude + radiusDegrees
      }
      query.longitude = {
        $gte: longitude - radiusDegrees,
        $lte: longitude + radiusDegrees
      }
    }
    
    const hazards = await collection
      .find(query)
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray()
    
    const response: HazardResponse[] = hazards.map(hazard => ({
      id: hazard._id!.toString(),
      longitude: hazard.longitude,
      latitude: hazard.latitude,
      type: hazard.type,
      confidence: hazard.confidence,
      timestamp: hazard.timestamp.toISOString(),
      source: hazard.source,
      description: hazard.description,
      verified: hazard.verified
    }))
    
    return NextResponse.json({ hazards: response, count: response.length })
  } catch (error) {
    console.error('Error fetching hazards:', error)
    return NextResponse.json(
      { error: 'Failed to fetch hazards' },
      { status: 500 }
    )
  }
}

// Create new hazard
export async function POST(request: NextRequest) {
  try {
    const body: CreateHazardRequest = await request.json()
    
    // Validate required fields
    if (!body.longitude || !body.latitude || !body.type || body.confidence === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: longitude, latitude, type, confidence' },
        { status: 400 }
      )
    }
    
    // Validate type
    if (!['debris', 'water', 'blocked'].includes(body.type)) {
      return NextResponse.json(
        { error: 'Invalid hazard type. Must be: debris, water, or blocked' },
        { status: 400 }
      )
    }
    
    // Validate confidence (0-1)
    if (body.confidence < 0 || body.confidence > 1) {
      return NextResponse.json(
        { error: 'Confidence must be between 0 and 1' },
        { status: 400 }
      )
    }
    
    const { db } = await connectToDatabase()
    const collection = db.collection<Hazard>('hazards')
    
    const newHazard: Hazard = {
      longitude: body.longitude,
      latitude: body.latitude,
      type: body.type,
      confidence: body.confidence,
      timestamp: new Date(),
      source: body.source || 'manual',
      description: body.description,
      verified: false
    }
    
    const result = await collection.insertOne(newHazard)
    
    const response: HazardResponse = {
      id: result.insertedId.toString(),
      longitude: newHazard.longitude,
      latitude: newHazard.latitude,
      type: newHazard.type,
      confidence: newHazard.confidence,
      timestamp: newHazard.timestamp.toISOString(),
      source: newHazard.source,
      description: newHazard.description,
      verified: newHazard.verified
    }
    
    return NextResponse.json({ hazard: response }, { status: 201 })
  } catch (error) {
    console.error('Error creating hazard:', error)
    return NextResponse.json(
      { error: 'Failed to create hazard' },
      { status: 500 }
    )
  }
}
