export type HazardType = "debris" | "water" | "blocked";

export interface Hazard {
  id: string;
  type: HazardType;
  lat: number;
  lng: number;
  timestamp: number;
  confidence?: number;
}

export interface HazardReport {
  type: HazardType;
  lat: number;
  lng: number;
  confidence?: number;
  description?: string;
}