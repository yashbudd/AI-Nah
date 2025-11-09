import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Hazard } from '@/types/hazard-db'

// Get existing hazards from database and optionally add AI test hazards
export async function POST() {
  try {
    const { db } = await connectToDatabase()
    const collection = db.collection<Hazard>('hazards')
    
    // Check if we have any AI hazards already
    const aiHazards = await collection.find({ source: 'ai' }).toArray()
    
    // If no AI hazards exist, create some test ones around the trail coordinates
    if (aiHazards.length === 0) {
      const trailLat = 33.9869289
      const trailLng = -85.047884
      
      const testAiHazards: Omit<Hazard, '_id'>[] = [
        {
          longitude: trailLng + 0.001, // ~110m east
          latitude: trailLat + 0.0005, // ~55m north
          type: 'branch',
          confidence: 0.78,
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          source: 'ai',
          description: 'AI detected branch with 78% confidence',
          verified: false
        },
        {
          longitude: trailLng - 0.0008, // ~90m west
          latitude: trailLat - 0.0003, // ~35m south
          type: 'debris',
          confidence: 0.85,
          timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
          source: 'ai',
          description: 'AI detected debris with 85% confidence',
          verified: false
        },
        {
          longitude: trailLng + 0.0012, // ~135m east
          latitude: trailLat - 0.0007, // ~78m south
          type: 'blocked',
          confidence: 0.92,
          timestamp: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
          source: 'ai',
          description: 'AI detected blockage with 92% confidence',
          verified: false
        },
        {
          longitude: trailLng - 0.0006, // ~67m west
          latitude: trailLat + 0.0009, // ~100m north
          type: 'other',
          confidence: 0.65,
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
          source: 'ai',
          description: 'AI detected other with 65% confidence',
          verified: false
        },
        {
          longitude: trailLng + 0.0015, // ~167m east
          latitude: trailLat + 0.0002, // ~22m north
          type: 'water',
          confidence: 0.73,
          timestamp: new Date(Date.now() - 90 * 60 * 1000), // 1.5 hours ago
          source: 'ai',
          description: 'AI detected water with 73% confidence',
          verified: false
        }
      ]
      
      await collection.insertMany(testAiHazards)
      console.log(`Created ${testAiHazards.length} test AI hazards around trail coordinates`)
    }
    
    // Fetch all existing hazards
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