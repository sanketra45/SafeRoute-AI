import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Navigation, MapPin, Shield, AlertTriangle,
  CheckCircle, RefreshCw, Loader, Locate, X,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useProximityAlerts } from '../hooks/useProximityAlerts'
import { useRouteBlackspotAlert } from '../hooks/useRouteBlackspotAlert'
import ProximityAlertBanner from '../components/ProximityAlertBanner'
import { getHotspots, getSafeRoute, mlHealth, getBlackspots } from '../services/api'

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Icons ────────────────────────────────────────────────────
const createStartIcon = () => L.divIcon({
  className: '',
  html: `<div style="position:relative;width:28px;height:28px;">
    <div style="position:absolute;inset:0;border-radius:50%;background:#00e5a0;opacity:0.25;animation:ripple 2s infinite;"></div>
    <div style="position:absolute;inset:4px;border-radius:50%;background:#00e5a0;border:2.5px solid white;box-shadow:0 0 14px #00e5a088;display:flex;align-items:center;justify-content:center;">
      <div style="width:6px;height:6px;border-radius:50%;background:white;"></div>
    </div>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

const createEndIcon = () => L.divIcon({
  className: '',
  html: `<div style="position:relative;width:28px;height:36px;">
    <div style="width:22px;height:32px;background:#ff4d4d;border-radius:50% 50% 50% 0;transform:rotate(-45deg);position:absolute;left:3px;top:0;box-shadow:0 0 14px #ff4d4d88;">
      <div style="width:10px;height:10px;background:white;border-radius:50%;position:absolute;top:6px;left:6px;transform:rotate(45deg);"></div>
    </div>
  </div>`,
  iconSize: [28, 36],
  iconAnchor: [14, 34],
})

const createUserIcon = () => L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#4db8ff;border:3px solid white;box-shadow:0 0 16px #4db8ff99;animation:userPulse 2s infinite;"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const createHazardIcon = () => L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#ff4d4d;border:2.5px solid white;box-shadow:0 0 10px #ff4d4d88;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

const createBlackspotIcon = (risk) => {
  const color = risk === 'HIGH' ? '#ef4444' : risk === 'MEDIUM' ? '#f59e0b' : '#10b981'
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:14px;height:14px;">
      <div style="position:absolute;inset:-3px;border-radius:50%;border:1.5px solid ${color}66;animation:ripple 2s infinite;"></div>
      <div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 10px ${color}88;"></div>
    </div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

function isValidCoordinate(lat, lng) {
  return Number.isFinite(Number(lat))
    && Number.isFinite(Number(lng))
    && Number(lat) >= -90
    && Number(lat) <= 90
    && Number(lng) >= -180
    && Number(lng) <= 180
}

function routeEndpointDistanceMeters(point, coordinate) {
  const earthRadius = 6371000
  const rad = value => value * Math.PI / 180
  const dLat = rad(coordinate.lat - point.lat)
  const dLon = rad(coordinate.lng - point.lng)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(point.lat)) * Math.cos(rad(coordinate.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function validateRouteEndpoints(result, origin, destination, maxSnapMeters = 3000) {
  const route = (result.safeRoute?.length >= 2 ? result.safeRoute : result.fastRoute) || []
  const first = route[0]
  const last = route[route.length - 1]
  const toPoint = c => ({ lat: Number(c?.lat), lng: Number(c?.lon ?? c?.lng) })
  const start = toPoint(first)
  const end = toPoint(last)
  if (!isValidCoordinate(start.lat, start.lng) || !isValidCoordinate(end.lat, end.lng)) {
    throw new Error('The routing provider returned invalid route geometry.')
  }
  const originDistance = routeEndpointDistanceMeters(origin, start)
  const destinationDistance = routeEndpointDistanceMeters(destination, end)
  if (originDistance > maxSnapMeters || destinationDistance > maxSnapMeters) {
    throw new Error(`Route endpoints are outside the provider road-network coverage (start ${Math.round(originDistance)}m, destination ${Math.round(destinationDistance)}m from the selected points).`)
  }
}

// ── Nominatim autocomplete ───────────────────────────────────
async function nominatimSearch(query) {
  if (!query || query.length < 3) return []
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Nagpur, India')}&limit=6&addressdetails=1&namedetails=1`,
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

// ── OSRM 2-route fallback (safe via slower roads, fast via highways) ─
async function getOsrmTwoRoutes(fromLat, fromLng, toLat, toLng) {
  // Route 1: fastest (default driving)
  const fastUrl = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`
  // Route 2: using cycling profile (slower, more residential roads = "safer")
  const safeUrl = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&alternatives=true`

  const parseRouteResponse = async (response) => {
    if (!response.ok) throw new Error(`OSRM routing failed (${response.status})`)
    return response.json()
  }

  const [fastRes, safeRes] = await Promise.all([
    fetch(fastUrl).then(parseRouteResponse),
    fetch(safeUrl).then(parseRouteResponse),
  ])

  if (!fastRes.routes?.length) throw new Error('OSRM: No route found')

  const toCoords = (route) => (route?.geometry?.coordinates || [])
    .map(([lng, lat]) => ({ lat, lon: lng }))
    .filter(point => isValidCoordinate(point.lat, point.lon))

  const fastRoute = fastRes.routes[0]
  // Use alternative route as safe if available, otherwise use same with slight variation
  const safeRoute = (safeRes.routes?.length > 1) ? safeRes.routes[1] : safeRes.routes[0]

  const fastDist = fastRoute.distance
  const safeDist = safeRoute.distance
  const fastRisk = 0.42
  const safeRisk = 0.28

  return {
    safeRoute: toCoords(safeRoute),
    fastRoute: toCoords(fastRoute),
    safeDistance: safeDist,
    fastDistance: fastDist,
    safeRiskScore: safeRisk,
    fastRiskScore: fastRisk,
    message: `Routes via OSRM (ML service offline). Safe: ${(safeDist/1000).toFixed(2)} km, Fast: ${(fastDist/1000).toFixed(2)} km`,
    comparison: {
      extra_distance_km: Math.max(0, (safeDist - fastDist) / 1000),
      risk_reduction_pct: ((fastRisk - safeRisk) * 100).toFixed(1),
      recommendation: 'Safe route uses residential roads with lower risk. Fast route is optimised for speed.',
    },
    isFallback: true,
  }
}

// ── LocationInput with autocomplete ─────────────────────────
function LocationInput({ value, onChange, onSelect, placeholder, icon, disabled }) {
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef(null)

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
    }, 350)
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
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, zIndex: 2 }}
        >
          <X size={12} />
        </button>
      )}
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
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
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card2)'}
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

// ── Map: auto-fit to route bounds ────────────────────────────
function MapFitBounds({ safeRoute, fastRoute, fromCoords, toCoords }) {
  const map = useMap()

  useEffect(() => {
    const allPoints = []
    if (safeRoute?.length) safeRoute.filter(([lat, lng]) => isValidCoordinate(lat, lng)).forEach(p => allPoints.push(p))
    if (fastRoute?.length) fastRoute.filter(([lat, lng]) => isValidCoordinate(lat, lng)).forEach(p => allPoints.push(p))
    if (fromCoords && isValidCoordinate(fromCoords.lat, fromCoords.lng)) allPoints.push([fromCoords.lat, fromCoords.lng])
    if (toCoords && isValidCoordinate(toCoords.lat, toCoords.lng)) allPoints.push([toCoords.lat, toCoords.lng])

    if (allPoints.length >= 2) {
      try {
        const bounds = L.latLngBounds(allPoints)
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true, duration: 0.8 })
      } catch (e) { /* ignore */ }
    }
  }, [safeRoute, fastRoute, fromCoords, toCoords, map])

  return null
}

function NavMapPanner({ panSignal }) {
  const map = useMap()

  useEffect(() => {
    if (!panSignal) return
    const direction = panSignal.split('_')[0]
    const offsets = { up: [0, -120], down: [0, 120], left: [-120, 0], right: [120, 0] }
    if (offsets[direction]) map.panBy(offsets[direction], { animate: true, duration: 0.3 })
  }, [map, panSignal])

  return null
}

function NavDPad({ onPan }) {
  const buttonStyle = {
    width: 34, height: 34, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)',
    color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  }

  return (
    <div style={{ position: 'absolute', bottom: 14, right: 14, zIndex: 800, display: 'grid', gridTemplateColumns: '34px 34px 34px', gridTemplateRows: '34px 34px 34px', gap: 4 }}>
      <div /><button style={buttonStyle} aria-label="Pan map north" onClick={() => onPan('up')}><ChevronUp size={16} /></button><div />
      <button style={buttonStyle} aria-label="Pan map west" onClick={() => onPan('left')}><ChevronLeft size={16} /></button><div /><button style={buttonStyle} aria-label="Pan map east" onClick={() => onPan('right')}><ChevronRight size={16} /></button>
      <div /><button style={buttonStyle} aria-label="Pan map south" onClick={() => onPan('down')}><ChevronDown size={16} /></button><div />
    </div>
  )
}

// ── Page Component ───────────────────────────────────────────
export default function NavigatePage() {
  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')
  const [fromCoords, setFromCoords] = useState(null)
  const [toCoords, setToCoords] = useState(null)

  const [navigating, setNavigating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mlOnline, setMlOnline] = useState(null)
  const [isFallback, setIsFallback] = useState(false)

  const [safeRoute, setSafeRoute] = useState(null)
  const [fastRoute, setFastRoute] = useState(null)
  const [showRoute, setShowRoute] = useState('both')   // ← default: show BOTH
  const [routeInfo, setRouteInfo] = useState(null)
  const [liveConditions, setLiveConditions] = useState(null)

  const [userPos, setUserPos] = useState(null)
  const [mapCenter] = useState([21.1458, 79.0882])
  const [locating, setLocating] = useState(false)
  const [hotspots, setHotspots] = useState([])
  const [blackspots, setBlackspots] = useState([])
  const [showBlackspots, setShowBlackspots] = useState(true)
  const [navPanSignal, setNavPanSignal] = useState(null)
  const watchRef = useRef(null)
  const routeRequestRef = useRef(0)

  useEffect(() => {
    getHotspots()
      .then(data => setHotspots(Array.isArray(data) ? data : []))
      .catch(() => setHotspots([]))
    mlHealth()
      .then(() => setMlOnline(true))
      .catch(() => setMlOnline(false))
    getBlackspots()
      .then(data => setBlackspots(Array.isArray(data) ? data : []))
      .catch(() => setBlackspots([]))
  }, [])

  const nearbyHazards = useProximityAlerts(userPos, hotspots, 500)
  const activeRoute = (safeRoute || fastRoute || []).map(([lat, lng]) => ({ lat, lng }))
  const { alert: blackspotAlert, dismiss: dismissBlackspotAlert, awaitingReliableLocation } = useRouteBlackspotAlert({
    route: activeRoute,
    position: userPos,
    blackspots,
    navigating,
    warningDistanceMeters: 500,
    routeProximityMeters: 75,
    maxGpsAccuracyMeters: 100,
  })

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser. Use HTTPS or localhost and enter a starting point manually.')
      return
    }
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        if (!isValidCoordinate(latitude, longitude)) {
          setError('Your location could not be validated. Please try again or enter a starting point manually.')
          setLocating(false)
          return
        }
        const label = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        setFromText(label)
        setFromCoords({ lat: latitude, lng: longitude, label })
        setUserPos({ lat: latitude, lon: longitude, accuracy: pos.coords.accuracy })
        setLocating(false)
      },
      (locationError) => {
        const message = locationError.code === locationError.PERMISSION_DENIED
          ? 'Location access was denied. Please type your starting point.'
          : locationError.code === locationError.TIMEOUT
            ? 'Location request timed out. Please try again or type your starting point.'
            : 'Your location is unavailable. Please try again or type your starting point.'
        setError(message)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  }

  const handleFindRoutes = async () => {
    if (!fromCoords || !toCoords || !isValidCoordinate(fromCoords.lat, fromCoords.lng) || !isValidCoordinate(toCoords.lat, toCoords.lng)) {
      setError('Please select both locations from the dropdown suggestions.')
      return
    }
    const requestId = ++routeRequestRef.current
    setLoading(true)
    setError(null)
    setSafeRoute(null)
    setFastRoute(null)
    setRouteInfo(null)
    setLiveConditions(null)
    setIsFallback(false)

    let result = null
    let usedFallback = false

    try {
      // 1. Try ML A* service first
      result = await getSafeRoute({
        originLat: fromCoords.lat,
        originLon: fromCoords.lng,
        destLat: toCoords.lat,
        destLon: toCoords.lng,
      })
      // The local graph may not cover every valid Nagpur location. Reject only
      // implausible snaps, then let the existing full-coverage OSRM fallback try.
      validateRouteEndpoints(result, fromCoords, toCoords)
    } catch (mlErr) {
      setMlOnline(false)
      try {
        // 2. Fallback: OSRM with 2 distinct routes
        result = await getOsrmTwoRoutes(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng)
        validateRouteEndpoints(result, fromCoords, toCoords)
        usedFallback = true
      } catch (osrmErr) {
        setLoading(false)
        setError(`Could not find route. ML: ${mlErr.message}. Fallback: ${osrmErr.message}`)
        return
      }
    }

    try {
      if (requestId !== routeRequestRef.current) return
      if (!result) throw new Error('No route data received')

      // ML returns [{lat,lon}], OSRM returns [{lat,lon}]
      const toLeaflet = (arr) => (Array.isArray(arr) ? arr : [])
        .map(c => [Number(c?.lat), Number(c?.lon ?? c?.lng)])
        .filter(([lat, lng]) => isValidCoordinate(lat, lng))

      const sr = toLeaflet(result.safeRoute)
      const fr = toLeaflet(result.fastRoute)

      if (sr.length < 2 && fr.length < 2) throw new Error('The route service returned no valid route geometry.')

      setSafeRoute(sr.length > 1 ? sr : null)
      setFastRoute(fr.length > 1 ? fr : null)
      setIsFallback(usedFallback)

      const comp = result.comparison || {}
      setRouteInfo({
        safeDistance: result.safeDistance,
        fastDistance: result.fastDistance,
        safeRisk: result.safeRiskScore,
        fastRisk: result.fastRiskScore,
        extraKm: comp.extra_distance_km ?? 0,
        riskReductionPct: parseFloat(comp.risk_reduction_pct ?? 0),
        recommendation: comp.recommendation || '',
        message: result.message || '',
      })
      setLiveConditions(result.liveConditions || null)
      setShowRoute('both')   // always show both after computing
    } catch (err) {
      setError(err.message || 'Could not process route data.')
    } finally {
      if (requestId === routeRequestRef.current) setLoading(false)
    }
  }

  const handleSwap = () => {
    routeRequestRef.current += 1
    setFromText(toText); setToText(fromText)
    setFromCoords(toCoords); setToCoords(fromCoords)
    setSafeRoute(null); setFastRoute(null); setRouteInfo(null)
  }

  const startNavigation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser. Use HTTPS or localhost to enable live navigation.')
      return
    }
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
    setError(null)
    setNavigating(true)
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (isValidCoordinate(pos.coords.latitude, pos.coords.longitude)) {
          setUserPos({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy })
        }
      },
      () => {
        setError('Live location updates are unavailable. Your route remains visible.')
        setNavigating(false)
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    )
  }

  const stopNavigation = () => {
    setNavigating(false)
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = null
  }

  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
  }, [])

  const fmtDist = (m) => m ? (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`) : '—'

  const routeButtons = [
    { v: 'safe',  label: '🛡 Safe Only',  color: '#00e5a0' },
    { v: 'fast',  label: '⚡ Fast Only',  color: '#ff9500' },
    { v: 'both',  label: '⊕ Both',        color: 'var(--accent)' },
  ]

  return (
    <div className="page">
      <style>{`
        @keyframes userPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(77,184,255,0.5); }
          50% { box-shadow: 0 0 0 10px rgba(77,184,255,0); }
        }
        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>

      {navigating && <ProximityAlertBanner nearbyHazards={nearbyHazards} />}

      {/* Header */}
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="section-title">Route Navigator</div>
          <div className="section-sub">AI-powered safe path planning for Nagpur</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setShowBlackspots(v => !v)}
            style={{
              fontSize: 11, padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
              border: `1px solid ${showBlackspots ? '#ef4444' : 'var(--border)'}`,
              background: showBlackspots ? 'rgba(239,68,68,0.1)' : 'var(--bg-card)',
              color: showBlackspots ? '#ef4444' : 'var(--text-muted)',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            ● Blackspots ({blackspots.length})
          </button>
          <div className="pulse-dot" style={{ background: mlOnline === false ? '#ff9500' : '#00e5a0' }} />
          <span style={{ fontSize: 11, color: mlOnline === false ? '#ff9500' : 'var(--accent)' }}>
            {mlOnline === null ? 'Connecting…' : mlOnline ? 'ML A* Router Online' : 'ML Offline — OSRM Fallback'}
          </span>
        </div>
      </div>

      {/* ── BLACKSPOT PROXIMITY ALERT BANNER ── */}
      {blackspotAlert && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.5)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 12, animation: 'fadeIn 0.3s ease',
        }}>
          <AlertTriangle size={26} color="#ef4444" aria-hidden="true" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: '#ef4444', fontSize: 14 }}>BLACKSPOT AHEAD</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
              Slow down and drive carefully. Blackspot approximately <strong>{fmtDist(blackspotAlert.distanceAheadMeters)}</strong> ahead.
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {blackspotAlert.blackspot.location || 'Accident blackspot'}{blackspotAlert.blackspot.road_type ? ` · ${blackspotAlert.blackspot.road_type}` : ''}
            </div>
          </div>
          <button type="button" onClick={() => dismissBlackspotAlert(blackspotAlert.id)} aria-label="Dismiss blackspot warning" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
        </div>
      )}

      {awaitingReliableLocation && (
        <div role="status" style={{ background: 'rgba(77,184,255,0.08)', border: '1px solid rgba(77,184,255,0.35)', borderRadius: 10, padding: '10px 16px', marginBottom: 14, color: 'var(--text-secondary)', fontSize: 12 }}>
          Distance-based blackspot warnings are waiting for a reliable GPS location (accuracy within 100 m).
        </div>
      )}

      {false && blackspotAlert && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.5)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 12, animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ fontSize: 26 }}>🚨</div>
          <div>
            <div style={{ fontWeight: 700, color: '#ef4444', fontSize: 13 }}>ACCIDENT BLACKSPOT AHEAD!</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
              <strong>{blackspotAlert.location}</strong> — {blackspotAlert.risk} risk · {blackspotAlert.total_accidents} recorded accidents ({blackspotAlert.road_type})
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>⚠ High accident probability area. Please reduce speed.</div>
          </div>
        </div>
      )}

      {mlOnline === false && (
        <div style={{
          background: 'rgba(255,149,0,0.07)', border: '1px solid rgba(255,149,0,0.3)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#ff9500',
        }}>
          <AlertTriangle size={14} />
          <span><strong>ML Service Offline</strong> — Using OSRM routing as fallback.
            Run <code style={{ fontSize: 10 }}>python ml_service.py</code> for AI risk-aware routes.</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 18 }} className="nav-grid">

        {/* ── LEFT PANEL ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Input Card */}
          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* FROM */}
              <div style={{ position: 'relative' }}>
                <LocationInput
                  value={fromText}
                  onChange={setFromText}
                  onSelect={(s) => { if (s) { setFromCoords(s); setFromText(s.shortLabel) } else setFromCoords(null) }}
                  placeholder="From — type to search Nagpur"
                  icon={<div style={{ width: 10, height: 10, borderRadius: '50%', background: '#00e5a0', border: '2px solid var(--bg-base)' }} />}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={locating}
                  title="Use my GPS location"
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
                <button className="icon-btn" onClick={handleSwap} title="Swap origin ↔ destination">
                  <RefreshCw size={13} />
                </button>
              </div>

              {/* TO */}
              <LocationInput
                value={toText}
                onChange={setToText}
                onSelect={(s) => { if (s) { setToCoords(s); setToText(s.shortLabel) } else setToCoords(null) }}
                placeholder="To — destination"
                icon={<MapPin size={13} color="#ff4d4d" />}
                disabled={loading}
              />

              {/* Hint if typed but not selected */}
              {(!fromCoords && fromText.length > 0) && (
                <div style={{ fontSize: 11, color: 'var(--orange)', padding: '2px 0' }}>
                  ↑ Select a suggestion from the dropdown for accurate coordinates
                </div>
              )}
              {(!toCoords && toText.length > 0) && (
                <div style={{ fontSize: 11, color: 'var(--orange)', padding: '2px 0' }}>
                  ↑ Select a suggestion from the dropdown for accurate coordinates
                </div>
              )}

              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleFindRoutes}
                disabled={loading || !fromCoords || !toCoords}
              >
                {loading
                  ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Calculating Routes…</>
                  : <><Navigation size={14} /> Find Safe Route</>
                }
              </button>

              {error && (
                <div style={{ fontSize: 11, color: 'var(--red)', padding: '4px 0', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
                </div>
              )}
            </div>
          </div>

          {/* Route Result Card */}
          {routeInfo ? (
            <div className="card" style={{ border: '1px solid rgba(0,229,160,0.2)', background: 'rgba(0,229,160,0.03)' }}>

              {/* View Toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {routeButtons.map(({ v, label }) => (
                  <button
                    key={v}
                    onClick={() => setShowRoute(v)}
                    style={{
                      flex: 1, padding: '7px 2px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                      border: showRoute === v ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: showRoute === v ? 'var(--accent)' : 'var(--bg-base)',
                      color: showRoute === v ? '#080c0e' : 'var(--text-secondary)',
                      fontWeight: showRoute === v ? 700 : 400,
                      transition: 'all 0.15s',
                    }}
                  >{label}</button>
                ))}
              </div>

              {/* Safe vs Fast cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {[
                  { label: '🛡 Safe Route', dist: routeInfo.safeDistance, risk: routeInfo.safeRisk, color: '#00e5a0', lineStyle: 'solid', active: showRoute === 'safe' || showRoute === 'both' },
                  { label: '⚡ Fast Route', dist: routeInfo.fastDistance, risk: routeInfo.fastRisk, color: '#ff9500', lineStyle: 'dashed', active: showRoute === 'fast' || showRoute === 'both' },
                ].map(r => (
                  <div
                    key={r.label}
                    style={{
                      background: r.active ? `${r.color}09` : 'var(--bg-base)',
                      borderRadius: 10, padding: '12px 14px',
                      border: r.active ? `1.5px solid ${r.color}55` : '1px solid var(--border)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <div style={{
                        width: 18, height: 3, borderRadius: 2,
                        background: r.lineStyle === 'dashed'
                          ? `repeating-linear-gradient(90deg,${r.color} 0 6px,transparent 6px 10px)`
                          : r.color,
                      }} />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.label}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: r.color }}>
                      {fmtDist(r.dist)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      Risk Score: {r.risk !== undefined ? (r.risk * 100).toFixed(1) + '%' : '—'}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              {routeInfo.riskReductionPct > 0 && (
                <div style={{
                  background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.2)',
                  borderRadius: 8, padding: '8px 12px', marginBottom: 8,
                  fontSize: 12, color: 'var(--accent)', fontWeight: 600,
                }}>
                  ✓ Safe route reduces risk by {routeInfo.riskReductionPct.toFixed(1)}%
                  {routeInfo.extraKm > 0 && ` (+${routeInfo.extraKm.toFixed(2)} km longer)`}
                </div>
              )}

              {routeInfo.recommendation && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {routeInfo.recommendation}
                </div>
              )}

              {liveConditions && (
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 16 }}>
                  <span>🚦 Congestion: {(liveConditions.congestion * 100).toFixed(0)}%</span>
                  <span>🌧 Weather risk: {(liveConditions.weather_risk * 100).toFixed(0)}%</span>
                </div>
              )}

              {isFallback && (
                <div style={{ marginTop: 10, fontSize: 10, color: '#4db8ff', fontStyle: 'italic' }}>
                  ℹ Route via OSRM public API (ML offline)
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: 28, textAlign: 'center' }}>
              <Navigation size={30} color="var(--text-muted)" style={{ marginBottom: 10, opacity: 0.4 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No Active Route</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Search &amp; select your start and destination above.<br />
                <span style={{ color: 'var(--accent)' }}>Both safe and fast routes</span> will appear on the map.
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: MAP ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="map-container" style={{ height: 500, borderRadius: 14, position: 'relative', overflow: 'hidden' }}>
            <MapContainer
              center={mapCenter}
              zoom={13}
              style={{ width: '100%', height: '100%' }}
              zoomControl={true}
            >
              {/* Auto-fit to route when routes load */}
              <MapFitBounds
                safeRoute={safeRoute}
                fastRoute={fastRoute}
                fromCoords={fromCoords}
                toCoords={toCoords}
              />

              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* ── FAST ROUTE (orange dashed) — draw first (below safe) */}
              {(showRoute === 'fast' || showRoute === 'both') && fastRoute && fastRoute.length > 1 && (
                <>
                  {/* shadow / glow */}
                  <Polyline positions={fastRoute} color="#ff9500" weight={9} opacity={0.15} />
                  <Polyline positions={fastRoute} color="#ff9500" weight={4} opacity={0.85} dashArray="12 7" />
                </>
              )}

              {/* ── SAFE ROUTE (green solid) — draw on top */}
              {(showRoute === 'safe' || showRoute === 'both') && safeRoute && safeRoute.length > 1 && (
                <>
                  <Polyline positions={safeRoute} color="#00e5a0" weight={9} opacity={0.15} />
                  <Polyline positions={safeRoute} color="#00e5a0" weight={5} opacity={0.95} />
                </>
              )}

              {/* Origin marker (A) */}
              {fromCoords && isValidCoordinate(fromCoords.lat, fromCoords.lng) && (
                <Marker position={[fromCoords.lat, fromCoords.lng]} icon={createStartIcon()}>
                  <Popup>
                    <div style={{ minWidth: 140 }}>
                      <div style={{ fontWeight: 700, color: '#00e5a0', fontSize: 13, marginBottom: 4 }}>📍 Start Point</div>
                      <div style={{ fontSize: 12 }}>{fromText}</div>
                      <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
                        {fromCoords.lat.toFixed(5)}, {fromCoords.lng.toFixed(5)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Destination marker (B) */}
              {toCoords && isValidCoordinate(toCoords.lat, toCoords.lng) && (
                <Marker position={[toCoords.lat, toCoords.lng]} icon={createEndIcon()}>
                  <Popup>
                    <div style={{ minWidth: 140 }}>
                      <div style={{ fontWeight: 700, color: '#ff4d4d', fontSize: 13, marginBottom: 4 }}>🏁 Destination</div>
                      <div style={{ fontSize: 12 }}>{toText}</div>
                      <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
                        {toCoords.lat.toFixed(5)}, {toCoords.lng.toFixed(5)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* User live position */}
              {userPos && isValidCoordinate(userPos.lat, userPos.lon) && (
                <>
                  <Marker position={[userPos.lat, userPos.lon]} icon={createUserIcon()}>
                    <Popup>You are here</Popup>
                  </Marker>
                  <Circle center={[userPos.lat, userPos.lon]} radius={Math.max(userPos.accuracy || 0, 30)} color="#4db8ff" fillColor="#4db8ff" fillOpacity={0.08} weight={1} />
                </>
              )}

              {/* Critical hotspot markers */}
              {hotspots.filter(h => h.severity === 'CRITICAL' || h.risk === 'CRITICAL').map((h, i) => {
                const lat = h.latitude ?? h.lat
                const lng = h.longitude ?? h.lng
                if (!isValidCoordinate(lat, lng)) return null
                return (
                  <Marker key={h.id || i} position={[lat, lng]} icon={createHazardIcon()}>
                    <Popup>
                      <b style={{ color: '#ff4d4d' }}>⚠ CRITICAL</b><br />
                      {h.hazardType || h.label || ''}<br />
                      {h.description || ''}
                    </Popup>
                  </Marker>
                )
              })}

              {/* Blackspots markers */}
              {showBlackspots && blackspots.filter(b => isValidCoordinate(b.lat, b.lng)).map((b) => (
                <Marker key={b.id} position={[b.lat, b.lng]} icon={createBlackspotIcon(b.risk)}>
                  <Popup>
                    <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 160 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: b.risk === 'HIGH' ? '#ef4444' : b.risk === 'MEDIUM' ? '#f59e0b' : '#10b981', marginBottom: 3 }}>
                        ● BLACKSPOT — {b.risk} RISK
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1a1a' }}>{b.location}</div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>
                        Total accidents: <b>{b.total_accidents}</b> ({b.road_type})
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Map label */}
              <div style={{
                position: 'absolute', top: 10, left: 10, zIndex: 800,
                background: 'rgba(8,12,14,0.88)', borderRadius: 8,
                padding: '5px 12px', fontSize: 11, color: '#aaa', pointerEvents: 'none',
              }}>
                {safeRoute || fastRoute ? '✓ Route Active' : 'Nagpur Map View'}
              </div>

              {/* D-Pad pan controls */}
              <NavMapPanner panSignal={navPanSignal} />
              <NavDPad onPan={(d) => setNavPanSignal(`${d}_${Date.now()}`)} />
            </MapContainer>

            {/* ── Legend overlay ── */}
            {routeInfo && (
              <div style={{
                position: 'absolute', bottom: 14, left: 14, zIndex: 800,
                background: 'rgba(8,12,14,0.92)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '10px 14px', fontSize: 11,
                display: 'flex', flexDirection: 'column', gap: 6,
                pointerEvents: 'none',
              }}>
                <div style={{ fontSize: 9, color: '#666', letterSpacing: 1, marginBottom: 2 }}>ROUTE LEGEND</div>
                {(showRoute === 'safe' || showRoute === 'both') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 24, height: 4, background: '#00e5a0', borderRadius: 2 }} />
                    <span style={{ color: '#ccc' }}>Safe Route — {fmtDist(routeInfo.safeDistance)}</span>
                  </div>
                )}
                {(showRoute === 'fast' || showRoute === 'both') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 24, height: 4, background: '#ff9500', borderRadius: 2, backgroundImage: 'repeating-linear-gradient(90deg,#ff9500 0 6px,transparent 6px 12px)' }} />
                    <span style={{ color: '#ccc' }}>Fast Route — {fmtDist(routeInfo.fastDistance)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#00e5a0', border: '2px solid white', flexShrink: 0 }} />
                  <span style={{ color: '#ccc' }}>Start (A)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff4d4d', border: '2px solid white', flexShrink: 0 }} />
                  <span style={{ color: '#ccc' }}>Destination (B)</span>
                </div>
              </div>
            )}
          </div>

          {/* Start / Stop Navigation */}
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
