import { ObjectId } from 'mongodb'

export interface Hazard {
  _id?: ObjectId
  longitude: number
  latitude: number
  type: 'debris' | 'water' | 'blocked'
  confidence: number
  timestamp: Date
  source: 'manual' | 'ai' | 'user_report'
  description?: string
  verified?: boolean
}

export interface CreateHazardRequest {
  longitude: number
  latitude: number
  type: 'debris' | 'water' | 'blocked'
  confidence: number
  source?: 'manual' | 'ai' | 'user_report'
  description?: string
}

export interface HazardResponse {
  id: string
  longitude: number
  latitude: number
  type: 'debris' | 'water' | 'blocked'
  confidence: number
  timestamp: string
  source: 'manual' | 'ai' | 'user_report'
  description?: string
  verified?: boolean
}