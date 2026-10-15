import { useEffect, useMemo, useRef, useState } from 'react'

const EARTH_RADIUS_METERS = 6371000

const isValidCoordinate = (lat, lng) => Number.isFinite(Number(lat))
  && Number.isFinite(Number(lng))
  && Number(lat) >= -90 && Number(lat) <= 90
  && Number(lng) >= -180 && Number(lng) <= 180

const toRadians = (value) => Number(value) * Math.PI / 180

function distanceMeters(a, b) {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

// Finds the nearest point on the polyline and its accumulated route distance.
// A local equirectangular projection is accurate at the short segment lengths in route geometry.
function projectOntoRoute(point, route) {
  if (!Array.isArray(route) || route.length < 2) return null
  let closest = null
  let routeDistanceBeforeSegment = 0

  for (let i = 0; i < route.length - 1; i += 1) {
    const start = route[i]
    const end = route[i + 1]
    if (!isValidCoordinate(start?.lat, start?.lng) || !isValidCoordinate(end?.lat, end?.lng)) continue

    const referenceLat = toRadians((start.lat + end.lat + point.lat) / 3)
    const metersPerLng = EARTH_RADIUS_METERS * Math.cos(referenceLat) * Math.PI / 180
    const metersPerLat = EARTH_RADIUS_METERS * Math.PI / 180
    const dx = (end.lng - start.lng) * metersPerLng
    const dy = (end.lat - start.lat) * metersPerLat
    const px = (point.lng - start.lng) * metersPerLng
    const py = (point.lat - start.lat) * metersPerLat
    const segmentLengthSquared = dx * dx + dy * dy
    const fraction = segmentLengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / segmentLengthSquared))
    const snapped = { lat: start.lat + (end.lat - start.lat) * fraction, lng: start.lng + (end.lng - start.lng) * fraction }
    const perpendicularDistance = distanceMeters(point, snapped)
    const segmentLength = distanceMeters(start, end)
    const candidate = {
      distanceFromRoute: perpendicularDistance,
      distanceAlongRoute: routeDistanceBeforeSegment + segmentLength * fraction,
    }
    if (!closest || candidate.distanceFromRoute < closest.distanceFromRoute) closest = candidate
    routeDistanceBeforeSegment += segmentLength
  }
  return closest
}

export function useRouteBlackspotAlert({
  route,
  position,
  blackspots,
  navigating,
  warningDistanceMeters = 500,
  routeProximityMeters = 75,
  maxGpsAccuracyMeters = 100,
}) {
  const alertedIdsRef = useRef(new Set())
  const [dismissedIds, setDismissedIds] = useState([])
  const [activeAlertId, setActiveAlertId] = useState(null)

  // A new navigation session can alert for the same blackspot again.
  useEffect(() => {
    if (!navigating) {
      alertedIdsRef.current = new Set()
      setDismissedIds([])
      setActiveAlertId(null)
    }
  }, [navigating])

  const reliablePosition = navigating
    && isValidCoordinate(position?.lat, position?.lon ?? position?.lng)
    && (!Number.isFinite(Number(position?.accuracy)) || Number(position.accuracy) <= maxGpsAccuracyMeters)

  const candidates = useMemo(() => {
    if (!reliablePosition || !Array.isArray(blackspots) || !Array.isArray(route)) return []
    const driverProjection = projectOntoRoute({ lat: Number(position.lat), lng: Number(position.lon ?? position.lng) }, route)
    if (!driverProjection || driverProjection.distanceFromRoute > routeProximityMeters) return []

    return blackspots
      .map((blackspot, index) => {
        const lat = Number(blackspot?.lat ?? blackspot?.latitude)
        const lng = Number(blackspot?.lng ?? blackspot?.lon ?? blackspot?.longitude)
        if (!isValidCoordinate(lat, lng)) return null
        const projection = projectOntoRoute({ lat, lng }, route)
        if (!projection || projection.distanceFromRoute > routeProximityMeters) return null
        const distanceAheadMeters = projection.distanceAlongRoute - driverProjection.distanceAlongRoute
        if (distanceAheadMeters < 0 || distanceAheadMeters > warningDistanceMeters) return null
        return { blackspot, id: String(blackspot.id ?? `${lat},${lng},${index}`), distanceAheadMeters: Math.round(distanceAheadMeters) }
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceAheadMeters - b.distanceAheadMeters)
  }, [blackspots, position, reliablePosition, route, routeProximityMeters, warningDistanceMeters])

  const activeCandidate = candidates.find((candidate) => candidate.id === activeAlertId)
  const newCandidate = candidates.find((candidate) => !dismissedIds.includes(candidate.id) && !alertedIdsRef.current.has(candidate.id))
  const alert = activeCandidate || newCandidate || null

  useEffect(() => {
    if (alert && alert.id !== activeAlertId) {
      alertedIdsRef.current.add(alert.id)
      setActiveAlertId(alert.id)
    }
    if (!alert && activeAlertId) setActiveAlertId(null)
  }, [alert, activeAlertId])

  const dismiss = (id) => {
    setDismissedIds((ids) => ids.includes(id) ? ids : [...ids, id])
    if (activeAlertId === id) setActiveAlertId(null)
  }

  return {
    alert,
    dismiss,
    locationReliable: reliablePosition,
    awaitingReliableLocation: navigating && !reliablePosition,
  }
}

export { isValidCoordinate, projectOntoRoute }
