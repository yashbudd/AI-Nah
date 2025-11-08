import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Hazard } from '@/types/hazard-db'

// Create test hazards in Chattahoochee National Forest area
export async function POST() {
  try {
    const { db } = await connectToDatabase()
    const collection = db.collection<Hazard>('hazards')
    
    // Clear existing test data (optional)
    await collection.deleteMany({})
    
    const testHazards: Omit<Hazard, '_id'>[] = [
      // Close to your location (34.648460, -83.802681)
      {
        longitude: -83.802681,
        latitude: 34.648460,
        type: 'debris',
        confidence: 0.85,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        source: 'ai',
        description: 'Fallen tree blocking main trail',
        verified: true
      },
      {
        longitude: -83.802234, // Very close to center
        latitude: 34.648123,
        type: 'water',
        confidence: 0.92,
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        source: 'manual',
        description: 'Stream crossing after heavy rain',
        verified: true
      },
      {
        longitude: -83.803456, // Southwest of center
        latitude: 34.647789,
        type: 'blocked',
        confidence: 0.78,
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        source: 'user_report',
        description: 'Trail maintenance in progress',
        verified: false
      },
      {
        longitude: -83.801987, // Northeast of center
        latitude: 34.649234,
        type: 'debris',
        confidence: 0.65,
        timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        source: 'ai',
        description: 'Rock slide debris on path',
        verified: false
      },
      {
        longitude: -83.803321, // West of center
        latitude: 34.648567,
        type: 'water',
        confidence: 0.89,
        timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
        source: 'manual',
        description: 'Muddy section from recent storms',
        verified: true
      },
      {
        longitude: -83.801876, // East of center
        latitude: 34.648945,
        type: 'blocked',
        confidence: 0.95,
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        source: 'user_report',
        description: 'Bridge under repair',
        verified: false
      }
    ]
    
    const result = await collection.insertMany(testHazards)
    
    return NextResponse.json({
      message: 'Test hazards created successfully',
      count: result.insertedCount,
      insertedIds: Object.values(result.insertedIds).map(id => id.toString())
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating test hazards:', error)
    return NextResponse.json(
      { error: 'Failed to create test hazards' },
      { status: 500 }
    )
  }
}