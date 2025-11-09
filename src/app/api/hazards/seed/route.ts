import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Hazard } from '@/types/hazard-db'

// Get existing hazards from database (no longer creates test data)
export async function POST() {
  try {
    const { db } = await connectToDatabase()
    const collection = db.collection<Hazard>('hazards')
    
    // Just fetch existing hazards
    const existingHazards = await collection.find({}).toArray()
    
    return NextResponse.json({
      message: 'Retrieved existing hazards from database',
      count: existingHazards.length,
      hazards: existingHazards.map(hazard => ({
        id: hazard._id?.toString(),
        longitude: hazard.longitude,
        latitude: hazard.latitude,
        type: hazard.type,
        confidence: hazard.confidence,
        timestamp: hazard.timestamp,
        source: hazard.source,
        description: hazard.description,
        verified: hazard.verified
      }))
    }, { status: 200 })
  } catch (error) {
    console.error('Error retrieving hazards:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve hazards' },
      { status: 500 }
    )
  }
}