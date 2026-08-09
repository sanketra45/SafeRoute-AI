import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Navigation, MapPin, Clock, Shield, AlertTriangle,
  CheckCircle, RefreshCw, Loader, Locate
} from 'lucide-react'
import { useProximityAlerts } from '../hooks/useProximityAlerts'
import ProximityAlertBanner from '../components/ProximityAlertBanner'
import { getHotspots } from '../services/api'

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

function getStoredHazards() {
  try { return JSON.parse(localStorage.getItem('saferoute_hazards') || '[]') } catch { return [] }
}

// Geocode using Nominatim
async function geocodeAddress(query) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Nagpur, India')}&limit=1`,
    { headers: { 'Accept-Language': 'en' } }
  )
  const data = await res.json()
  if (!data.length) throw new Error(`Could not find: ${query}`)
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name }
}

// Get route from OSRM (free routing API)
async function getOSRMRoute(fromLat, fromLng, toLat, toLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=true`
  const res = await fetch(url)
  const data = await res.json()
  if (!data.routes?.length) throw new Error('No route found')
  const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng])
  const duration = Math.round(data.routes[0].duration / 60)
  const distance = (data.routes[0].distance / 1000).toFixed(1)
  const steps = data.routes[0].legs?.[0]?.steps?.map(s => s.maneuver?.instruction || s.name).filter(Boolean) || []
  return { coords, duration, distance, steps }
}

function MapController({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView(center, zoom || 13)
  }, [center, zoom, map])
  return null
}

export default function NavigatePage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [navigating, setNavigating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [routeCoords, setRouteCoords] = useState(null)
  const [userPos, setUserPos] = useState(null)
  const [fromCoords, setFromCoords] = useState(null)
  const [toCoords, setToCoords] = useState(null)
  const [mapCenter, setMapCenter] = useState([21.1458, 79.0882])
  const [locating, setLocating] = useState(false)
  const [routeInfo, setRouteInfo] = useState(null)
  const [hotspots, setHotspots] = useState([])
  const watchRef = useRef(null)

  useEffect(() => {
    getHotspots()
      .then(data => setHotspots(Array.isArray(data) ? data : []))
      .catch(() => setHotspots([]))
  }, [])

  const allHazards = [...hotspots, ...getStoredHazards()]
  const nearbyHazards = useProximityAlerts(userPos, allHazards, 500)

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

  const handleFindRoutes = async () => {
    if (!from.trim() || !to.trim()) { setError('Please enter both source and destination.'); return }
    setLoading(true)
    setError(null)
    setRouteCoords(null)
    setRouteInfo(null)
    try {
      const [fromResult, toResult] = await Promise.all([
        geocodeAddress(from),
        geocodeAddress(to),
      ])
      setFromCoords(fromResult)
      setToCoords(toResult)
      setMapCenter([(fromResult.lat + toResult.lat) / 2, (fromResult.lng + toResult.lng) / 2])

      const osrm = await getOSRMRoute(fromResult.lat, fromResult.lng, toResult.lat, toResult.lng)
      setRouteCoords(osrm.coords)
      setRouteInfo({ duration: osrm.duration, distance: osrm.distance, steps: osrm.steps })
    } catch (err) {
      setError(err.message || 'Could not find route.')
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
        setUserPos({ lat: 21.1458, lon: 79.0882 })
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
          <div className="section-sub">Real-time path planning for Nagpur</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="pulse-dot" />
          <span style={{ fontSize: 11, color: 'var(--accent)' }}>Live GPS Router</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }} className="nav-grid">
        {/* LEFT: Input + Route Card */}
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
                  onChange={(e) => setFrom(e.target.value)}
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
                  onChange={(e) => setTo(e.target.value)}
                  style={{ paddingLeft: 32 }}
                  placeholder="To — destination"
                />
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleFindRoutes}
                disabled={loading}
              >
                {loading
                  ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Finding Route...</>
                  : <><Navigation size={14} /> Find Safe Route</>
                }
              </button>

              {error && (
                <div style={{ fontSize: 11, color: 'var(--orange)', padding: '4px 0' }}>⚠ {error}</div>
              )}
            </div>
          </div>

          {/* Calculated Route Info Card */}
          {routeInfo ? (
            <div className="card" style={{ border: '1px solid var(--accent)', background: 'rgba(0,229,160,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="badge badge-low">Calculated Route</span>
                <CheckCircle size={16} color="var(--accent)" />
              </div>

              <div style={{ display: 'flex', gap: 16, margin: '12px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  <Clock size={14} color="var(--accent)" /> ~{routeInfo.duration} min
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  <MapPin size={14} color="var(--accent)" /> {routeInfo.distance} km
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Live route mapped via OpenStreetMap and OSRM telemetry.
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <Navigation size={28} color="var(--text-muted)" style={{ marginBottom: 8, opacity: 0.5 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>No Active Route</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Enter your starting location and destination above to compute a route.
              </div>
            </div>
          )}
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
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Route polyline */}
              {routeCoords && (
                <Polyline
                  positions={routeCoords}
                  color="#00e5a0"
                  weight={5}
                  opacity={0.85}
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
              {hotspots.filter(h => h.risk === 'CRITICAL' || h.risk === 'HIGH').map((h, i) => (
                <Marker key={h.id || i} position={[h.lat || h.latitude, h.lng || h.longitude]} icon={createPinIcon('#ff4d4d')}>
                  <Popup><b style={{ color: '#ff4d4d' }}>{h.risk || 'HAZARD'}</b><br />{h.label || h.location}<br />{h.detail || h.description}</Popup>
                </Marker>
              ))}

              <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 800, background: 'rgba(8,12,14,0.9)', borderRadius: 8, padding: '6px 12px', fontSize: 11, color: '#aaa', pointerEvents: 'none' }}>
                {routeInfo ? 'Route Active' : 'Map View'}
              </div>
            </MapContainer>
          </div>

          {/* Turn by Turn Directions */}
          {routeInfo?.steps && routeInfo.steps.length > 0 && (
            <div className="card">
              <div className="section-header" style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Directions</div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{routeInfo.duration} min • {routeInfo.distance} km</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 200, overflowY: 'auto' }}>
                {routeInfo.steps.map((step, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 14, padding: '10px 0',
                    borderBottom: i < routeInfo.steps.length - 1 ? '1px solid rgba(30,45,50,0.5)' : 'none',
                    alignItems: 'center',
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'var(--bg-base)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{step}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Start Navigation */}
          <button
            className={`btn ${navigating ? 'btn-danger' : 'btn-primary'}`}
            style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15, borderRadius: 10 }}
            onClick={navigating ? stopNavigation : startNavigation}
            disabled={!routeCoords && !userPos}
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
