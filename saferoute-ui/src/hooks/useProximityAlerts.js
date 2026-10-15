/**
 * useProximityAlerts — Haversine-based proximity detection
 * Returns hazards within `radiusMeters` of the user's position.
 */

import { useMemo } from 'react'

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000 // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * @param {{ lat: number, lon: number } | null} userPosition
 * @param {Array<{ id: number, latitude: number, longitude: number, hazardType: string, status: string }>} hazards
 * @param {number} radiusMeters
 * @returns {Array<{ hazard, distanceMeters }>}
 */
export function useProximityAlerts(userPosition, hazards, radiusMeters = 500) {
  return useMemo(() => {
    if (!userPosition || !hazards?.length) return []
    const seen = new Set()
    return hazards
      .filter((h) => h?.status === 'ACTIVE' && Number.isFinite(Number(h.latitude)) && Number.isFinite(Number(h.longitude)))
      .filter((h) => {
        if (seen.has(h.id)) return false
        seen.add(h.id)
        return true
      })
      .map((h) => ({
        // This is a database-backed report, not a calculated blackspot severity.
        hazard: { ...h, risk: h.severity || 'MEDIUM', label: String(h.hazardType || 'HAZARD').replaceAll('_', ' ') },
        distanceMeters: Math.round(haversineDistance(userPosition.lat, userPosition.lon, h.latitude, h.longitude)),
      }))
      .filter((x) => x.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
  }, [userPosition, hazards, radiusMeters])
}
