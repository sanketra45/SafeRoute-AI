import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Navigation, MapPin, Clock, Shield, AlertTriangle,
  CheckCircle, RefreshCw, Loader, Locate, Search, X
} from 'lucide-react'
import { useProximityAlerts } from '../hooks/useProximityAlerts'
import ProximityAlertBanner from '../components/ProximityAlertBanner'
import { getHotspots, getSafeRoute } from '../services/api'

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

// Nominatim autocomplete (debounced)
async function nominatimSearch(query) {
  if (!query || query.length < 3) return []
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Nagpur, India')}&limit=5&addressdetails=1`,
    { headers: { 'Accept-Language': 'en' } }
  )
  const data = await res.json()
  return data.map(d => ({
    label: d.display_name,
    shortLabel: d.namedetails?.name || d.display_name.split(',')[0],
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
  }))
}

// LocationInput — input with live Nominatim autocomplete dropdown
function LocationInput({ value, onChange, onSelect, placeholder, icon, disabled }) {
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef(null)

  // Sync external value reset
  useEffect(() => { setQuery(value || '') }, [value])

  const handleChange = (e) => {
    const q = e.target.value
    setQuery(q)
    onChange(q)
    clearTimeout(debounceRef.current)
    if (q.length < 3) { setSuggestions([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await nominatimSearch(q)
        setSuggestions(results)
        setOpen(results.length > 0)
      } catch { setSuggestions([]); setOpen(false) }
    }, 400)
  }

  const handleSelect = (s) => {
    setQuery(s.shortLabel)
    onChange(s.shortLabel)
    setSuggestions([])
    setOpen(false)
    onSelect(s)
  }

  const clear = () => { setQuery(''); onChange(''); setSuggestions([]); setOpen(false); onSelect(null) }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 1, pointerEvents: 'none' }}>
        {icon}
      </div>
      <input
        className="input"
        value={query}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        style={{ paddingLeft: 32, paddingRight: query ? 36 : 12 }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {query && (
        <button
          type="button"
          onClick={clear}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
        >
          <X size={12} />
        </button>
      )}
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          marginTop: 4, overflow: 'hidden',
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onMouseDown={() => handleSelect(s)}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: 12,
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', flexDirection: 'column', gap: 2,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-base)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.shortLabel}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MapController({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView(center, zoom || 13)
  }, [center, zoom, map])
  return null
}

export default function NavigatePage() {
  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')
  const [fromCoords, setFromCoords] = useState(null)
  const [toCoords, setToCoords] = useState(null)

  const [navigating, setNavigating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [safeRoute, setSafeRoute] = useState(null)   // [{lat,lng},...] from ML
  const [fastRoute, setFastRoute] = useState(null)   // [{lat,lng},...] from ML
  const [showRoute, setShowRoute] = useState('safe') // 'safe' | 'fast' | 'both'
  const [routeInfo, setRouteInfo] = useState(null)
  const [liveConditions, setLiveConditions] = useState(null)

  const [userPos, setUserPos] = useState(null)
  const [mapCenter, setMapCenter] = useState([21.1458, 79.0882])
  const [locating, setLocating] = useState(false)
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
        const label = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`
        setFromText(label)
        setFromCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, label })
        setUserPos({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setMapCenter([pos.coords.latitude, pos.coords.longitude])
        setLocating(false)
      },
      () => { setError('Location permission denied. Please type your starting location.'); setLocating(false) }
    )
  }

  const handleFindRoutes = async () => {
    if (!fromCoords || !toCoords) {
      setError('Please select both a source and destination from the dropdown suggestions.')
      return
    }
    setLoading(true)
    setError(null)
    setSafeRoute(null)
    setFastRoute(null)
    setRouteInfo(null)
    setLiveConditions(null)

    try {
      // Center map between the two points immediately
      setMapCenter([(fromCoords.lat + toCoords.lat) / 2, (fromCoords.lng + toCoords.lng) / 2])

      // Call ML service A* safe-route
      const result = await getSafeRoute({
        originLat: fromCoords.lat,
        originLon: fromCoords.lng,
        destLat: toCoords.lat,
        destLon: toCoords.lng,
      })

      // ML returns [{lat, lon}, ...] — convert to Leaflet [[lat, lng], ...]
      const toLeaflet = (arr) => (arr || []).map(c => [c.lat, c.lon ?? c.lng])

      setSafeRoute(toLeaflet(result.safeRoute))
      setFastRoute(toLeaflet(result.fastRoute))

      const comp = result.comparison || {}
      setRouteInfo({
        safeDistance: result.safeDistance,
        fastDistance: result.fastDistance,
        safeRisk: result.safeRiskScore,
        fastRisk: result.fastRiskScore,
        extraKm: comp.extra_distance_km ?? 0,
        riskReductionPct: comp.risk_reduction_pct ?? 0,
        recommendation: comp.recommendation || '',
        message: result.message || '',
      })
      setLiveConditions(result.liveConditions || null)
    } catch (err) {
      setError(err.message || 'Could not find route. Make sure the ML service is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleSwap = () => {
    setFromText(toText); setToText(fromText)
    setFromCoords(toCoords); setToCoords(fromCoords)
    setSafeRoute(null); setFastRoute(null); setRouteInfo(null)
  }

  const startNavigation = () => {
    setNavigating(true)
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        setUserPos(newPos)
        setMapCenter([pos.coords.latitude, pos.coords.longitude])
      },
      () => { setUserPos({ lat: 21.1458, lon: 79.0882 }) },
      { enableHighAccuracy: true, maximumAge: 3000 }
    )
  }

  const stopNavigation = () => {
    setNavigating(false)
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = null
    setUserPos(null)
  }

  // Which route coords to show on map
  const displayedRoute = showRoute === 'both'
    ? null // both shown separately below
    : showRoute === 'fast' ? fastRoute : safeRoute

  const fmtDist = (m) => m ? (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`) : '—'

  return (
    <div className="page">
      <style>{`
        @keyframes userPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(77,184,255,0.5); }
          50% { box-shadow: 0 0 0 8px rgba(77,184,255,0); }
        }
      `}</style>

      {navigating && <ProximityAlertBanner nearbyHazards={nearbyHazards} />}

      <div className="section-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="section-title">Route Navigator</div>
          <div className="section-sub">AI-powered safe path planning for Nagpur</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="pulse-dot" />
          <span style={{ fontSize: 11, color: 'var(--accent)' }}>ML A* Router</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }} className="nav-grid">
        {/* LEFT: Inputs + Route Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Route Input Card */}
          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* FROM */}
              <div style={{ position: 'relative' }}>
                <LocationInput
                  value={fromText}
                  onChange={setFromText}
                  onSelect={(s) => { if (s) { setFromCoords(s); setFromText(s.shortLabel) } else setFromCoords(null) }}
                  placeholder="From — type to search"
                  icon={<div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-base)' }} />}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={locating}
                  title="Use current GPS location"
                  style={{
                    position: 'absolute', right: fromText ? 30 : 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4, zIndex: 2,
                  }}
                >
                  {locating ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Locate size={13} />}
                </button>
              </div>

              {/* SWAP */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button className="icon-btn" onClick={handleSwap} title="Swap source and destination">
                  <RefreshCw size={13} />
                </button>
              </div>

              {/* TO */}
              <LocationInput
                value={toText}
                onChange={setToText}
                onSelect={(s) => { if (s) { setToCoords(s); setToText(s.shortLabel) } else setToCoords(null) }}
                placeholder="To — destination"
                icon={<MapPin size={14} color="var(--red)" />}
                disabled={loading}
              />

              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleFindRoutes}
                disabled={loading || !fromCoords || !toCoords}
              >
                {loading
                  ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Calculating Route...</>
                  : <><Navigation size={14} /> Find Safe Route</>
                }
              </button>

              {!fromCoords && fromText.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 0' }}>
                  ↑ Select a suggestion from the dropdown
                </div>
              )}
              {error && <div style={{ fontSize: 11, color: 'var(--orange)', padding: '4px 0' }}>⚠ {error}</div>}
            </div>
          </div>

          {/* Route Info Card */}
          {routeInfo ? (
            <div className="card" style={{ border: '1px solid var(--accent)', background: 'rgba(0,229,160,0.04)' }}>
              {/* Route toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {[['safe', 'Safe Route'], ['fast', 'Fast Route'], ['both', 'Both']].map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setShowRoute(v)}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 7, fontSize: 11, cursor: 'pointer',
                      border: showRoute === v ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: showRoute === v ? 'var(--accent)' : 'var(--bg-base)',
                      color: showRoute === v ? '#080c0e' : 'var(--text-secondary)',
                      fontWeight: showRoute === v ? 700 : 400,
                    }}
                  >{label}</button>
                ))}
              </div>

              {/* Safe vs Fast comparison */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[
                  { label: '🛡 Safe Route', dist: routeInfo.safeDistance, risk: routeInfo.safeRisk, color: 'var(--accent)' },
                  { label: '⚡ Fast Route', dist: routeInfo.fastDistance, risk: routeInfo.fastRisk, color: 'var(--orange)' },
                ].map(r => (
                  <div key={r.label} style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{r.label}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: r.color }}>{fmtDist(r.dist)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      Risk: {r.risk !== undefined ? (r.risk * 100).toFixed(1) + '%' : '—'}
                    </div>
                  </div>
                ))}
              </div>

              {routeInfo.riskReductionPct > 0 && (
                <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 6, fontWeight: 600 }}>
                  ✓ Safe route reduces risk by {routeInfo.riskReductionPct.toFixed(1)}%
                  {routeInfo.extraKm > 0 && ` (+${routeInfo.extraKm.toFixed(2)} km)`}
                </div>
              )}

              {routeInfo.recommendation && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{routeInfo.recommendation}</div>
              )}

              {liveConditions && (
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
                  <span>🚦 Congestion: {(liveConditions.congestion * 100).toFixed(0)}%</span>
                  <span>🌧 Weather risk: {(liveConditions.weather_risk * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <Navigation size={28} color="var(--text-muted)" style={{ marginBottom: 8, opacity: 0.5 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>No Active Route</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Search and select your start and destination above. The ML service will compute both safe and fast routes.
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Map */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="map-container" style={{ height: 460, borderRadius: 12, position: 'relative' }}>
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

              {/* Safe route — green */}
              {(showRoute === 'safe' || showRoute === 'both') && safeRoute && safeRoute.length > 0 && (
                <Polyline positions={safeRoute} color="#00e5a0" weight={5} opacity={0.9} />
              )}

              {/* Fast route — orange */}
              {(showRoute === 'fast' || showRoute === 'both') && fastRoute && fastRoute.length > 0 && (
                <Polyline positions={fastRoute} color="#ff9500" weight={4} opacity={0.7} dashArray="10 6" />
              )}

              {/* Origin marker */}
              {fromCoords && (
                <Marker position={[fromCoords.lat, fromCoords.lng]} icon={createPinIcon('#00e5a0')}>
                  <Popup><b>Start</b><br />{fromText}</Popup>
                </Marker>
              )}

              {/* Destination marker */}
              {toCoords && (
                <Marker position={[toCoords.lat, toCoords.lng]} icon={createPinIcon('#ff4d4d')}>
                  <Popup><b>Destination</b><br />{toText}</Popup>
                </Marker>
              )}

              {/* User live position */}
              {userPos && (
                <>
                  <Marker position={[userPos.lat, userPos.lon]} icon={createUserIcon()}>
                    <Popup>You are here</Popup>
                  </Marker>
                  <Circle center={[userPos.lat, userPos.lon]} radius={100} color="#4db8ff" fillColor="#4db8ff" fillOpacity={0.1} weight={1} />
                </>
              )}

              {/* High-risk hotspot markers from backend */}
              {hotspots.filter(h => h.severity === 'CRITICAL' || h.risk === 'CRITICAL').map((h, i) => {
                const lat = h.latitude ?? h.lat
                const lng = h.longitude ?? h.lng
                if (!lat || !lng) return null
                return (
                  <Marker key={h.id || i} position={[lat, lng]} icon={createPinIcon('#ff4d4d')}>
                    <Popup>
                      <b style={{ color: '#ff4d4d' }}>CRITICAL</b><br />
                      {h.hazardType || h.label || ''}<br />
                      {h.description || ''}
                    </Popup>
                  </Marker>
                )
              })}

              <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 800, background: 'rgba(8,12,14,0.9)', borderRadius: 8, padding: '6px 12px', fontSize: 11, color: '#aaa', pointerEvents: 'none' }}>
                {safeRoute ? 'Route Active' : 'Map View'}
              </div>
            </MapContainer>

            {/* Route legend */}
            {routeInfo && (
              <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 800, background: 'rgba(8,12,14,0.92)', borderRadius: 8, padding: '8px 12px', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 20, height: 3, background: '#00e5a0', borderRadius: 2 }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Safe Route</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 20, height: 3, background: '#ff9500', borderRadius: 2, backgroundImage: 'repeating-linear-gradient(90deg, #ff9500 0 6px, transparent 6px 12px)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Fast Route</span>
                </div>
              </div>
            )}
          </div>

          {/* Start/Stop Navigation */}
          <button
            className={`btn ${navigating ? 'btn-danger' : 'btn-primary'}`}
            style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15, borderRadius: 10 }}
            onClick={navigating ? stopNavigation : startNavigation}
            disabled={!safeRoute && !userPos}
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
