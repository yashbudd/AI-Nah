'use client'

import { useEffect, useState } from 'react'
import { HazardResponse } from '@/types/hazard-db'

export default function AdminPage() {
  const [hazards, setHazards] = useState<HazardResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  const fetchHazards = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/hazards')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setHazards(data.hazards || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const seedTestData = async () => {
    setSeeding(true)
    try {
      const response = await fetch('/api/hazards/seed', { method: 'POST' })
      if (!response.ok) throw new Error('Failed to seed')
      const data = await response.json()
      console.log('Seeded:', data)
      await fetchHazards() // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed data')
    } finally {
      setSeeding(false)
    }
  }

  useEffect(() => {
    fetchHazards()
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getHazardEmoji = (type: string) => {
    switch (type) {
      case 'debris': return '🪨'
      case 'water': return '💧' 
      case 'blocked': return '🚫'
      default: return '⚠️'
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 20, color: '#2b5e2b' }}>
          TrailMix Admin - MongoDB Hazards
        </h1>

        <div style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={fetchHazards}
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Loading...' : '🔄 Refresh'}
          </button>

          <button
            onClick={seedTestData}
            disabled={seeding}
            style={{
              padding: '10px 20px',
              background: '#D97706',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: seeding ? 'not-allowed' : 'pointer'
            }}
          >
            {seeding ? 'Seeding...' : '🌱 Seed Test Data'}
          </button>

          <span style={{ color: '#666', fontSize: 14 }}>
            Total: {hazards.length} hazards
          </span>
        </div>

        {error && (
          <div style={{ 
            background: '#fee2e2', 
            color: '#dc2626', 
            padding: 15, 
            borderRadius: 6, 
            marginBottom: 20 
          }}>
            Error: {error}
          </div>
        )}

        <div style={{ 
          background: 'white', 
          border: '1px solid #e5e7eb', 
          borderRadius: 8,
          overflow: 'hidden'
        }}>
          <div style={{ 
            background: '#f9fafb', 
            padding: 15, 
            borderBottom: '1px solid #e5e7eb',
            fontWeight: 'bold'
          }}>
            MongoDB Hazards Data
          </div>
          
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>
              Loading hazards...
            </div>
          ) : hazards.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>
              No hazards found. Click "Seed Test Data" to add some!
            </div>
          ) : (
            <div>
              {hazards.map((hazard, index) => (
                <div
                  key={hazard.id}
                  style={{
                    padding: 15,
                    borderBottom: index < hazards.length - 1 ? '1px solid #f3f4f6' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 20 }}>{getHazardEmoji(hazard.type)}</span>
                        <strong style={{ textTransform: 'capitalize' }}>{hazard.type}</strong>
                        <span style={{ 
                          background: hazard.confidence >= 0.8 ? '#dcfce7' : '#fef3c7',
                          color: hazard.confidence >= 0.8 ? '#166534' : '#92400e',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 'bold'
                        }}>
                          {Math.round(hazard.confidence * 100)}%
                        </span>
                      </div>
                      
                      <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>
                        <strong>Location:</strong> {hazard.latitude.toFixed(6)}, {hazard.longitude.toFixed(6)}
                      </div>
                      
                      <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>
                        <strong>Source:</strong> {hazard.source} • <strong>Reported:</strong> {formatDate(hazard.timestamp)}
                      </div>
                      
                      {hazard.description && (
                        <div style={{ fontSize: 14, color: '#374151', marginTop: 8 }}>
                          "{hazard.description}"
                        </div>
                      )}
                    </div>
                    
                    <div style={{ fontSize: 12, color: '#9ca3af', marginLeft: 20 }}>
                      ID: {hazard.id.slice(-8)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ 
          marginTop: 20, 
          padding: 15, 
          background: '#f0fdf4', 
          borderRadius: 6,
          fontSize: 14,
          color: '#166534'
        }}>
          💡 <strong>Tip:</strong> This admin page shows all hazards stored in your MongoDB database. 
          Use "Seed Test Data" to populate with sample hazards around Chattahoochee Forest.
        </div>
      </div>
    </div>
  )
}