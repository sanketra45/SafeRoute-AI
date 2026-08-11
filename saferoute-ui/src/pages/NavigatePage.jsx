import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Navigation, MapPin, Clock, Shield, AlertTriangle,
  ChevronRight, CheckCircle, RefreshCw, Loader, Locate
} from 'lucide-react'
import { useProximityAlerts } from '../hooks/useProximityAlerts'
import ProximityAlertBanner from '../components/ProximityAlertBanner'
import { geocode, getSafeRoute } from '../services/api'
import { useHazardSocket } from '../hooks/useHazardSocket'

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const createPinIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 0 10px ${color}88;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

const createUserIcon = () => L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#4db8ff;border:3px solid white;box-shadow:0 0 16px #4db8ff99;animation:userPulse 2s infinite;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

const NAGPUR_HOTSPOTS = [
  { id: 1, lat: 21.1458, lng: 79.0882, type: 'red', label: 'Sitabuldi Interchange', risk: 'CRITICAL', detail: '12 incidents/month' },
  { id: 2, lat: 21.1320, lng: 79.1070, type: 'red', label: 'Wardha Road Signal', risk: 'CRITICAL', detail: '8 incidents/month' },
  { id: 3, lat: 21.1520, lng: 79.0650, type: 'orange', label: 'Dharampeth Square', risk: 'HIGH', detail: '5 incidents/month' },
  { id: 4, lat: 21.1640, lng: 79.1120, type: 'orange', label: 'Manish Nagar Flyover', risk: 'HIGH', detail: '3 incidents/month' },
  { id: 5, lat: 21.1150, lng: 79.0720, type: 'green', label: 'Hingna Road', risk: 'LOW', detail: '1 incident/month' },
  { id: 6, lat: 21.1580, lng: 79.0510, type: 'green', label: 'Civil Lines Bypass', risk: 'LOW', detail: '0 incidents' },
  { id: 7, lat: 21.1250, lng: 79.1350, type: 'orange', label: 'Besa Road', risk: 'MEDIUM', detail: '2 incidents/month' },
]

function getStoredHazards() {
  try { return JSON.parse(localStorage.getItem('saferoute_hazards') || '[]') } catch { return [] }
}

const DEMO_ROUTES = [
  {
    id: 1, name: 'Safest Route', via: 'Civil Lines → Wardha Road Bypass → Airport',
    time: '22 min', distance: '14.2 km', riskScore: 92, incidents: 0, type: 'safe', recommended: true,
    turns: ['Head North on Civil Lines Rd', 'Turn right on Wardha Road', 'Take Bypass at KP signal', 'Merge onto Airport Road'],
    color: '#00e5a0',
    coords: [[21.1580, 79.0510], [21.1458, 79.0700], [21.1380, 79.0900], [21.1310, 79.1020], [21.1250, 79.1200]],
  },
  {
    id: 2, name: 'Fastest Route', via: 'Sitabuldi → Zero Mile → Airport',
    time: '14 min', distance: '11.8 km', riskScore: 55, incidents: 3, type: 'fast', recommended: false,
    turns: ['Head South on Sitabuldi Rd', 'Pass Zero Mile', 'Enter high-risk zone', 'Airport terminal'],
    color: '#ff4d4d',
    coords: [[21.1580, 79.0510], [21.1458, 79.0882], [21.1350, 79.1000], [21.1250, 79.1200]],
  },
  {
    id: 3, name: 'Balanced Route', via: 'Dharampeth → Manish Nagar → Airport',
    time: '18 min', distance: '12.9 km', riskScore: 74, incidents: 1, type: 'balanced', recommended: false,
    turns: ['Head West on Dharampeth Rd', 'Turn at Manish Nagar', 'Merge at Ring Road', 'Airport exit'],
    color: '#ff9500',
    coords: [[21.1580, 79.0510], [21.1520, 79.0650], [21.1640, 79.1120], [21.1480, 79.1250], [21.1250, 79.1200]],
  },
]

async function geocodeAddress(query) {
  const data = await geocode(query, 1)
  if (!data.length) throw new Error(`Could not find: ${query}`)
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name }
}

function MapController({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView(center, zoom || 13)
  }, [center, zoom, map])
  return null
}

function MapLocationPicker({ onPick }) {
  useMapEvents({ click: (event) => onPick(event.latlng) })
  return null
}

function nearestRouteIndex(position, coordinates) {
  if (!position || !coordinates?.length) return 0
  let closestIndex = 0
  let closestDistance = Infinity
  coordinates.forEach(([lat, lon], index) => {
    const distance = (lat - position.lat) ** 2 + (lon - position.lon) ** 2
    if (distance < closestDistance) { closestDistance = distance; closestIndex = index }
  })
  return closestIndex
}

export default function NavigatePage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selectedRoute, setSelectedRoute] = useState(1)
  const [navigating, setNavigating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [routeOptions, setRouteOptions] = useState(DEMO_ROUTES)
  const [userPos, setUserPos] = useState(null)
  const [fromCoords, setFromCoords] = useState(null)
  const [toCoords, setToCoords] = useState(null)
  const [mapCenter, setMapCenter] = useState([21.1458, 79.0882])
  const [locating, setLocating] = useState(false)
  const [routeInfo, setRouteInfo] = useState(null)
  const [liveHazards, setLiveHazards] = useState([])
  const [routeProgressIndex, setRouteProgressIndex] = useState(0)
  const [fromSuggestions, setFromSuggestions] = useState([])
  const [toSuggestions, setToSuggestions] = useState([])
  const watchRef = useRef(null)
  const allHazards = [...NAGPUR_HOTSPOTS, ...getStoredHazards(), ...liveHazards]
  const nearbyHazards = useProximityAlerts(userPos, allHazards, 500)
  const handleLiveHazard = useCallback((hazard) => {
    const normalized = {
      id: `live-${hazard.id}`, lat: hazard.latitude, lng: hazard.longitude,
      label: hazard.hazardType || 'Reported hazard', risk: 'HIGH', type: 'orange',
      detail: hazard.description || 'New hazard reported. Proceed with caution.', userReported: true,
    }
    setLiveHazards((previous) => previous.some((h) => h.id === normalized.id) ? previous : [...previous, normalized])
  }, [])
  const socketConnected = useHazardSocket(handleLiveHazard)

  const active = routeOptions.find((r) => r.id === selectedRoute)

  useEffect(() => {
    if (!navigating || !userPos || !active?.coords?.length) return
    const nearest = nearestRouteIndex(userPos, active.coords)
    // GPS may jitter backwards; completed sections never reappear.
    setRouteProgressIndex((previous) => Math.max(previous, nearest))
  }, [userPos, active, navigating])

  const handleGetCurrentLocation = () => {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFrom(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`)
        setUserPos({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setMapCenter([pos.coords.latitude, pos.coords.longitude])
        setLocating(false)
      },
      () => { setError('Location permission denied. Please type your starting location.'); setLocating(false) }
    )
  }

  const lookupLocations = async (value, setSuggestions) => {
    if (value.trim().length < 2) { setSuggestions([]); return }
    try { setSuggestions(await geocode(value, 5)) } catch { setSuggestions([]) }
  }

  const chooseLocation = (place, kind) => {
    const coordinates = { lat: Number(place.lat), lng: Number(place.lon) }
    const label = place.display_name || `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`
    if (kind === 'from') { setFrom(label); setFromCoords(coordinates); setFromSuggestions([]) }
    else { setTo(label); setToCoords(coordinates); setToSuggestions([]) }
    setMapCenter([coordinates.lat, coordinates.lng])
  }

  const chooseMapLocation = ({ lat, lng }) => {
    const place = { lat, lon: lng, display_name: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }
    chooseLocation(place, fromCoords ? 'to' : 'from')
  }

  const handleFindRoutes = async () => {
    if (!from.trim() || !to.trim()) { setError('Please enter both source and destination.'); return }
    setLoading(true)
    setError(null)
    try {
      const [fromResult, toResult] = await Promise.all([
        fromCoords || geocodeAddress(from),
        toCoords || geocodeAddress(to),
      ])
      setFromCoords(fromResult)
      setToCoords(toResult)
      setMapCenter([(fromResult.lat + toResult.lat) / 2, (fromResult.lng + toResult.lng) / 2])

      const result = await getSafeRoute({
        originLat: fromResult.lat, originLon: fromResult.lng,
        destLat: toResult.lat, destLon: toResult.lng,
      })
      if (!result.safeRoute?.length || !result.fastRoute?.length) {
        throw new Error(result.message || 'SafeRoute could not calculate a route.')
      }
      const toRoute = (id, name, type, color, points, distance, risk, recommended) => ({
        id, name, type, color, recommended, incidents: 0,
        via: result.message || 'Live Nagpur road network',
        distance: `${(distance / 1000).toFixed(1)} km`,
        time: 'Live estimate', riskScore: Math.round((1 - (risk || 0)) * 100),
        coords: points.map((p) => [p.lat, p.lon]),
        turns: ['Start navigation', 'Follow the highlighted route', 'Arrive at destination'],
      })
      const routes = [
        toRoute('safe', 'Safest Route', 'safe', '#00e5a0', result.safeRoute, result.safeDistance, result.safeRiskScore, true),
        toRoute('fast', 'Fastest Route', 'fast', '#ff4d4d', result.fastRoute, result.fastDistance, result.fastRiskScore, false),
      ]
      setRouteOptions(routes)
      setSelectedRoute('safe')
      setRouteProgressIndex(0)
      setRouteInfo({ distance: (result.safeDistance / 1000).toFixed(1), duration: 'Live', conditions: result.liveConditions })
    } catch (err) {
      setError(err.message || 'Could not find route. Showing demo routes.')
      setRouteOptions(DEMO_ROUTES)
      setSelectedRoute(1)
      setRouteProgressIndex(0)
    } finally {
      setLoading(false)
    }
  }

  const startNavigation = () => {
    setNavigating(true)
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        setUserPos(newPos)
        setMapCenter([pos.coords.latitude, pos.coords.longitude])
      },
      () => {
        // Fallback: simulate movement near Nagpur for demo
        const simulated = { lat: 21.1458 + (Math.random() - 0.5) * 0.01, lon: 79.0882 + (Math.random() - 0.5) * 0.01 }
        setUserPos(simulated)
        setMapCenter([simulated.lat, simulated.lon])
      },
      { enableHighAccuracy: true, maximumAge: 3000 }
    )
  }

  const stopNavigation = () => {
    setNavigating(false)
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = null
    setUserPos(null)
  }

  const displayCoords = active?.coords
  const remainingRouteCoords = displayCoords?.slice(routeProgressIndex)
  const displayColor = active?.color

  return (
    <div className="page">
      <style>{`
        @keyframes userPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(77,184,255,0.5); }
          50% { box-shadow: 0 0 0 8px rgba(77,184,255,0); }
        }
      `}</style>

      {/* Proximity Alert Banner */}
      {navigating && <ProximityAlertBanner nearbyHazards={nearbyHazards} />}

      <div className="section-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="section-title">Route Navigator</div>
          <div className="section-sub">AI-powered safe path planning for Nagpur</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="pulse-dot" />
          <span style={{ fontSize: 11, color: socketConnected ? 'var(--accent)' : 'var(--text-muted)' }}>
            {socketConnected ? 'Live traffic & hazard data' : 'Connecting live alerts…'}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }} className="nav-grid">
        {/* LEFT: Input + Route Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Route Input */}
          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* FROM */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  width: 10, height: 10, borderRadius: '50%',
                  background: 'var(--accent)', border: '2px solid var(--bg-base)', zIndex: 1,
                }} />
                <input
                  className="input"
                  value={from}
                  onChange={(e) => { setFrom(e.target.value); lookupLocations(e.target.value, setFromSuggestions) }}
                  style={{ paddingLeft: 32, paddingRight: 42 }}
                  placeholder="From — type or use GPS"
                />
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={locating}
                  title="Use current location"
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--accent)', padding: 4,
                  }}
                >
                  {locating ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Locate size={13} />}
                </button>
                {fromSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 1200, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    {fromSuggestions.map((place, index) => <button key={`${place.lat}-${place.lon}-${index}`} onClick={() => chooseLocation(place, 'from')} style={{ width: '100%', textAlign: 'left', border: 0, padding: '9px 12px', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 11 }}>{place.display_name}</button>)}
                  </div>
                )}
              </div>

              {/* SWAP */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  className="icon-btn"
                  onClick={() => { const t = from; setFrom(to); setTo(t) }}
                  title="Swap source and destination"
                >
                  <RefreshCw size={13} />
                </button>
              </div>

              {/* TO */}
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}>
                  <MapPin size={14} color="var(--red)" />
                </div>
                <input
                  className="input"
                  value={to}
                  onChange={(e) => { setTo(e.target.value); lookupLocations(e.target.value, setToSuggestions) }}
                  style={{ paddingLeft: 32 }}
                  placeholder="To — destination"
                />
                {toSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 1200, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    {toSuggestions.map((place, index) => <button key={`${place.lat}-${place.lon}-${index}`} onClick={() => chooseLocation(place, 'to')} style={{ width: '100%', textAlign: 'left', border: 0, padding: '9px 12px', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 11 }}>{place.display_name}</button>)}
                  </div>
                )}
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleFindRoutes}
                disabled={loading}
              >
                {loading
                  ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Finding Routes...</>
                  : <><Navigation size={14} /> Find Safe Routes</>
                }
              </button>

              {error && (
                <div style={{ fontSize: 11, color: 'var(--orange)', padding: '4px 0' }}>⚠ {error}</div>
              )}
              {routeInfo && (
                <div style={{ fontSize: 11, color: 'var(--accent)', padding: '4px 0' }}>
                  ✓ Route found! {routeInfo.distance}km • ~{routeInfo.duration} min
                </div>
              )}
            </div>
          </div>

          {/* Route Options */}
          {routeOptions.map((route) => (
            <div
              key={route.id}
              className="card"
              style={{
                cursor: 'pointer',
                border: selectedRoute === route.id ? `1px solid ${route.color}` : '1px solid var(--border)',
                background: selectedRoute === route.id ? `${route.color}0a` : 'var(--bg-card)',
                transition: 'all 0.2s',
              }}
              onClick={() => { setSelectedRoute(route.id); setRouteProgressIndex(0) }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700 }}>{route.name}</span>
                    {route.recommended && <span className="badge badge-low" style={{ fontSize: 9 }}>RECOMMENDED</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{route.via}</div>
                </div>
                {selectedRoute === route.id && <CheckCircle size={16} color={route.color} />}
              </div>

              <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <Clock size={12} /> {route.time}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <MapPin size={12} /> {route.distance}
                </div>
                {route.incidents > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--orange)' }}>
                    <AlertTriangle size={12} /> {route.incidents} incident{route.incidents > 1 ? 's' : ''}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2 }}>
                  <div style={{
                    width: `${route.riskScore}%`, height: '100%', borderRadius: 2,
                    background: route.color,
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: route.color, minWidth: 32, textAlign: 'right' }}>
                  {route.riskScore}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Safety</span>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT: Map + Turn-by-turn */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* REAL LEAFLET MAP */}
          <div className="map-container" style={{ height: 320, borderRadius: 12 }}>
            <MapContainer
              center={mapCenter}
              zoom={13}
              style={{ width: '100%', height: '100%', borderRadius: 12 }}
            >
              <MapController center={mapCenter} />
              <MapLocationPicker onPick={chooseMapLocation} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Route polyline */}
              {remainingRouteCoords?.length > 1 && (
                <Polyline
                  positions={remainingRouteCoords}
                  color={displayColor}
                  weight={5}
                  opacity={0.85}
                  dashArray={routeOptions === DEMO_ROUTES ? '12 6' : null}
                />
              )}

              {/* Origin/Dest markers */}
              {fromCoords && (
                <Marker position={[fromCoords.lat, fromCoords.lng]} icon={createPinIcon('#00e5a0')}>
                  <Popup><b>Start</b><br />{from}</Popup>
                </Marker>
              )}
              {toCoords && (
                <Marker position={[toCoords.lat, toCoords.lng]} icon={createPinIcon('#ff4d4d')}>
                  <Popup><b>Destination</b><br />{to}</Popup>
                </Marker>
              )}

              {/* User live position */}
              {userPos && (
                <>
                  <Marker position={[userPos.lat, userPos.lon]} icon={createUserIcon()}>
                    <Popup>You are here</Popup>
                  </Marker>
                  <Circle
                    center={[userPos.lat, userPos.lon]}
                    radius={100}
                    color="#4db8ff"
                    fillColor="#4db8ff"
                    fillOpacity={0.1}
                    weight={1}
                  />
                </>
              )}

              {/* Hotspot markers on nav map */}
              {NAGPUR_HOTSPOTS.filter(h => h.risk === 'CRITICAL').map(h => (
                <Marker key={h.id} position={[h.lat, h.lng]} icon={createPinIcon('#ff4d4d')}>
                  <Popup><b style={{ color: '#ff4d4d' }}>{h.risk}</b><br />{h.label}<br />{h.detail}</Popup>
                </Marker>
              ))}

              <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 800, background: 'rgba(8,12,14,0.9)', borderRadius: 8, padding: '6px 12px', fontSize: 11, color: '#aaa', pointerEvents: 'none' }}>
                {active?.name} Preview
              </div>
            </MapContainer>
          </div>

          {/* Turn by Turn */}
          <div className="card">
            <div className="section-header" style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Turn-by-Turn</div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{active?.time} • {active?.distance}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {active?.turns.map((turn, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 14, padding: '12px 0',
                  borderBottom: i < active.turns.length - 1 ? '1px solid rgba(30,45,50,0.5)' : 'none',
                  alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{turn}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {(i === 0 || i === active.turns.length - 1) ? '— waypoint' : `~${(i + 1) * 3} min`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Start Navigation */}
          <button
            className={`btn ${navigating ? 'btn-danger' : 'btn-primary'}`}
            style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15, borderRadius: 10 }}
            onClick={navigating ? stopNavigation : startNavigation}
          >
            {navigating
              ? <><Shield size={16} /> Stop Navigation</>
              : <><Navigation size={16} /> Start Navigation</>
            }
          </button>

          {navigating && (
            <div className="alert-banner info">
              <CheckCircle size={14} color="var(--accent)" />
              <span style={{ color: 'var(--text-primary)' }}>
                SafeRoute AI is monitoring your route in real-time. GPS tracking active.
                {nearbyHazards.length > 0 && (
                  <span style={{ color: 'var(--red)', fontWeight: 700 }}>
                    {' '}⚠ {nearbyHazards.length} hazard{nearbyHazards.length > 1 ? 's' : ''} nearby!
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
