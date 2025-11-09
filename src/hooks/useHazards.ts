import { useState, useEffect } from 'react'
import { HazardResponse, CreateHazardRequest } from '@/types/hazard-db'

interface UseHazardsOptions {
  lat?: number
  lng?: number
  radius?: number
  type?: 'debris' | 'water' | 'blocked' | 'branch' | 'other'
  autoFetch?: boolean
}

interface UseHazardsReturn {
  hazards: HazardResponse[]
  loading: boolean
  error: string | null
  createHazard: (hazard: CreateHazardRequest) => Promise<HazardResponse | null>
  fetchHazards: () => Promise<void>
}

export function useHazards(options: UseHazardsOptions = {}): UseHazardsReturn {
  const { lat, lng, radius = 10, type, autoFetch = true } = options
  
  const [hazards, setHazards] = useState<HazardResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const fetchHazards = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams()
      if (lat !== undefined) params.append('lat', lat.toString())
      if (lng !== undefined) params.append('lng', lng.toString())
      if (radius) params.append('radius', radius.toString())
      if (type) params.append('type', type)
      
      const url = `/api/hazards?${params}`
      console.log('Fetching hazards from:', url)
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch hazards')
      }
      
      const data = await response.json()
      console.log('Received hazards data:', data)
      setHazards(data.hazards || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Error fetching hazards:', err)
    } finally {
      setLoading(false)
    }
  }
  
  const createHazard = async (hazard: CreateHazardRequest): Promise<HazardResponse | null> => {
    setError(null)
    
    try {
      const response = await fetch('/api/hazards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(hazard),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create hazard')
      }
      
      const data = await response.json()
      const newHazard = data.hazard
      
      // Add to local state
      setHazards(prev => [newHazard, ...prev])
      
      return newHazard
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Error creating hazard:', err)
      return null
    }
  }
  
  useEffect(() => {
    if (autoFetch) {
      fetchHazards()
    }
  }, [lat, lng, radius, type, autoFetch])
  
  return {
    hazards,
    loading,
    error,
    createHazard,
    fetchHazards
  }
}