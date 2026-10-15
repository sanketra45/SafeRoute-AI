import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, Marker, Popup, useMap, useMapEvents, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AlertTriangle, Locate, Layers, Plus, RefreshCw, Eye, EyeOff, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import ReportHazardModal from '../components/ReportHazardModal'
import { getBlackspots, getHotspots } from '../services/api'

// Fix Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Available tile layers ──────────────────────────────────────
const TILE_LAYERS = {
  street: {
    label: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  humanitarian: {
    label: 'Humanitarian',
    url: 'https://tile-{s}.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles by <a href="https://hot.openstreetmap.org/">HOT</a>',
  },
  topo: {
    label: 'Topo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a> contributors',
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Source: Esri, USGS, NOAA',
  },
}

// ── Icons ─────────────────────────────────────────────────────
const createBlackspotIcon = (risk) => {
  const colors = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#10b981' }
  const color = colors[risk] || '#f59e0b'
  const size = risk === 'HIGH' ? 18 : 14
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      <div style="position:absolute;inset:-4px;border-radius:50%;border:1.5px solid ${color}55;animation:ripplePulse 2.5s infinite;"></div>
      <div style="width:100%;height:100%;border-radius:50%;background:${color};border:2.5px solid rgba(255,255,255,0.5);box-shadow:0 0 12px ${color}88;display:flex;align-items:center;justify-content:center;">
        <div style="width:5px;height:5px;background:white;border-radius:50%;"></div>
      </div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

const createUserHazardIcon = () => L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;background:#ffd60a;border-radius:5px;transform:rotate(45deg);border:2px solid rgba(255,214,10,0.5);box-shadow:0 0 12px #ffd60a88;display:flex;align-items:center;justify-content:center;">
    <span style="transform:rotate(-45deg);font-size:11px;">⚠</span>
  </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

const createCurrentLocationIcon = () => L.divIcon({
  className: '',
  html: '<div style="width:20px;height:20px;border-radius:50%;background:#2684ff;border:3px solid white;box-shadow:0 0 0 5px rgba(38,132,255,0.25),0 0 14px rgba(38,132,255,0.9);"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

function isValidCoordinate(lat, lng) {
  return Number.isFinite(Number(lat))
    && Number.isFinite(Number(lng))
    && Number(lat) >= -90
    && Number(lat) <= 90
    && Number(lng) >= -180
    && Number(lng) <= 180
}

// ── MapController: handles tile layer changes + panning ──────
function MapController({ tileLayerKey, panSignal }) {
  const map = useMap()
  const tileRef = useRef(null)

  // Replace tile layer when key changes
  useEffect(() => {
    const layerConfig = TILE_LAYERS[tileLayerKey]
    if (!layerConfig) return

    // Remove old tile layer
    if (tileRef.current) {
      map.removeLayer(tileRef.current)
    }

    // Add new tile layer at the bottom (z-index 0)
    const newLayer = L.tileLayer(layerConfig.url, {
      attribution: layerConfig.attribution,
      maxZoom: 19,
    })
    newLayer.addTo(map)
    newLayer.setZIndex(0)
    tileRef.current = newLayer

    return () => {
      // We don't remove on cleanup because React may call cleanup before the new effect runs
    }
  }, [tileLayerKey, map])

  // Pan the map on signal
  useEffect(() => {
    if (!panSignal) return
    const PAN_PIXELS = 120
    const dirs = {
      up:    [0, -PAN_PIXELS],
      down:  [0,  PAN_PIXELS],
      left:  [-PAN_PIXELS, 0],
      right: [ PAN_PIXELS, 0],
    }
    const dir = panSignal.split('_')[0]
    if (dirs[dir]) {
      map.panBy(dirs[dir], { animate: true, duration: 0.3 })
    }
  }, [panSignal, map])

  return null
}

function HazardLocationPicker({ active, selectedLocation, onSelect }) {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    container.style.cursor = active ? 'crosshair' : ''
    return () => { container.style.cursor = '' }
  }, [active, map])

  useMapEvents({ click: (event) => active && onSelect({ lat: event.latlng.lat, lng: event.latlng.lng }) })
  return selectedLocation ? <Marker position={[selectedLocation.lat, selectedLocation.lng]} icon={createUserHazardIcon()} /> : null
}

function MapPickerResizer({ active }) {
  const map = useMap()
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 0)
    return () => window.clearTimeout(timer)
  }, [active, map])
  return null
}

// ── User Location Button ─────────────────────────────────────
function UserLocationButton({ onLocation, onError }) {
  const map = useMap()
  const [locating, setLocating] = useState(false)
  const locate = () => {
    if (!navigator.geolocation) {
      onError('Geolocation is not supported by this browser. Use HTTPS or localhost to enable it.')
      return
    }
    setLocating(true)
    onError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        if (!isValidCoordinate(latitude, longitude)) {
          onError('Your location could not be validated. Please try again.')
        } else {
          onLocation({ lat: latitude, lng: longitude, accuracy })
          map.setView([latitude, longitude], 16)
        }
        setLocating(false)
      },
      (locationError) => {
        onError(locationError.code === locationError.PERMISSION_DENIED
          ? 'Location access was denied. Enable it in browser settings and try again.'
          : locationError.code === locationError.TIMEOUT
            ? 'Location request timed out. Please try again.'
            : 'Your location is unavailable. Please try again.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }
  return (
    <div style={{ position: 'absolute', bottom: 90, right: 12, zIndex: 1000 }}>
      <button onClick={locate} disabled={locating} title="Go to My Location" style={{
        width: 40, height: 40, borderRadius: 10,
        background: locating ? 'var(--accent-dim)' : 'var(--bg-card)',
        border: '1px solid var(--accent)', color: 'var(--accent)',
        cursor: locating ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)', transition: 'all 0.2s',
      }}>
        <Locate size={16} style={{ animation: locating ? 'spin 1s linear infinite' : 'none' }} />
      </button>
    </div>
  )
}

// ── Directional D-Pad ────────────────────────────────────────
function DPad({ onPan }) {
  const btnStyle = (dir) => ({
    width: 34, height: 34, borderRadius: 8,
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    color: 'var(--text-secondary)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)', transition: 'all 0.15s',
    flexShrink: 0,
  })
  return (
    <div style={{
      position: 'absolute', bottom: 90, left: 12, zIndex: 1000,
      display: 'grid', gridTemplateColumns: '34px 34px 34px', gridTemplateRows: '34px 34px 34px',
      gap: 4,
    }}>
      {/* row 1: empty, up, empty */}
      <div />
      <button style={btnStyle('up')} aria-label="Pan map north" title="Pan North" onClick={() => onPan('up')}>
        <ChevronUp size={16} />
      </button>
      <div />
      {/* row 2: left, center(empty), right */}
      <button style={btnStyle('left')} aria-label="Pan map west" title="Pan West" onClick={() => onPan('left')}>
        <ChevronLeft size={16} />
      </button>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg-card2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border-bright)' }} />
      </div>
      <button style={btnStyle('right')} aria-label="Pan map east" title="Pan East" onClick={() => onPan('right')}>
        <ChevronRight size={16} />
      </button>
      {/* row 3: empty, down, empty */}
      <div />
      <button style={btnStyle('down')} aria-label="Pan map south" title="Pan South" onClick={() => onPan('down')}>
        <ChevronDown size={16} />
      </button>
      <div />
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────
export default function MapPage() {
  const [blackspots, setBlackspots] = useState([])
  const [userHazards, setUserHazards] = useState([])
  const [showBlackspots, setShowBlackspots] = useState(true)
  const [showUserHazards, setShowUserHazards] = useState(true)
  const [showHazardModal, setShowHazardModal] = useState(false)
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [activeLayer, setActiveLayer] = useState('street')
  const [showLayerPicker, setShowLayerPicker] = useState(false)
  const [userPos, setUserPos] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [panSignal, setPanSignal] = useState(null)
  const [selectingHazardLocation, setSelectingHazardLocation] = useState(false)
  const [selectedHazardLocation, setSelectedHazardLocation] = useState(null)
  const [pickerLocation, setPickerLocation] = useState(null)

  const loadBlackspots = useCallback(() => {
    setLoading(true)
    getBlackspots()
      .then(data => { setBlackspots(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setBlackspots([]); setLoading(false) })
  }, [])

  useEffect(() => { loadBlackspots() }, [loadBlackspots])

  const loadUserHazards = useCallback(() => {
    getHotspots().then(data => setUserHazards(Array.isArray(data) ? data : [])).catch(() => setUserHazards([]))
  }, [])

  useEffect(() => { loadUserHazards() }, [loadUserHazards])

  const filteredBlackspots = riskFilter === 'ALL'
    ? blackspots
    : blackspots.filter(b => b.risk === riskFilter)

  const statsData = [
    { label: 'Total Blackspots', value: blackspots.length, color: 'var(--red)' },
    { label: 'High Risk', value: blackspots.filter(b => b.risk === 'HIGH').length, color: 'var(--orange)' },
    { label: 'Medium Risk', value: blackspots.filter(b => b.risk === 'MEDIUM').length, color: 'var(--yellow)' },
    { label: 'User Reports', value: userHazards.length, color: '#4db8ff' },
  ]

  // Pan: set a timestamped signal so repeated same-direction presses still fire the effect
  const handlePan = (dir) => setPanSignal(`${dir}_${Date.now()}`)

  const extractDir = (signal) => signal ? signal.split('_')[0] : null

  return (
    <div className="page">
      <style>{`
        @keyframes ripplePulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.8); opacity: 0; }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div className="section-header" style={{ marginBottom: 14 }}>
        <div>
          <div className="section-title">Nagpur Accident Map</div>
          <div className="section-sub">Live blackspot grid from accident dataset — {blackspots.length} locations loaded</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" style={{ fontSize: 11, padding: '7px 12px' }} onClick={loadBlackspots}>
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            className="btn btn-primary"
            style={{ fontSize: 11, padding: '7px 14px' }}
            onClick={() => setShowHazardModal(true)}
          >
            <Plus size={12} /> Report Hazard
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }} className="map-grid">

        {/* ── MAP COLUMN ── */}
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {/* Layer picker button */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-outline"
                style={{ padding: '6px 12px', fontSize: 11, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => setShowLayerPicker(v => !v)}
                title="Switch map layer"
                aria-label="Open layer selector"
              >
                <Layers size={12} />
                {TILE_LAYERS[activeLayer]?.label || 'Street'}
              </button>
              {showLayerPicker && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 2000,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 10, marginTop: 4, overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)', minWidth: 140,
                }}>
                  {Object.entries(TILE_LAYERS).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => { setActiveLayer(key); setShowLayerPicker(false) }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '9px 14px', fontSize: 12, cursor: 'pointer', border: 'none',
                        background: activeLayer === key ? 'rgba(0,229,160,0.1)' : 'transparent',
                        color: activeLayer === key ? 'var(--accent)' : 'var(--text-primary)',
                        fontWeight: activeLayer === key ? 700 : 400,
                        borderBottom: '1px solid var(--border)',
                        transition: 'background 0.12s',
                      }}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Blackspot toggle */}
            <button
              onClick={() => setShowBlackspots(v => !v)}
              title={showBlackspots ? 'Hide Blackspots' : 'Show Blackspots'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 6, fontSize: 11,
                border: `1px solid ${showBlackspots ? '#ef4444' : 'var(--border)'}`,
                background: showBlackspots ? 'rgba(239,68,68,0.1)' : 'var(--bg-card)',
                color: showBlackspots ? '#ef4444' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {showBlackspots ? <Eye size={12} /> : <EyeOff size={12} />}
              Blackspots ({filteredBlackspots.length})
            </button>
          </div>

          {/* Risk filter pills */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[['ALL', 'All Zones', '#888'], ['HIGH', '⚠ High Risk', '#ef4444'], ['MEDIUM', '~ Medium', '#f59e0b'], ['LOW', '✓ Low Risk', '#10b981']].map(([val, label, col]) => (
              <button key={val} onClick={() => setRiskFilter(val)} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                border: `1px solid ${riskFilter === val ? col : 'var(--border)'}`,
                background: riskFilter === val ? `${col}18` : 'var(--bg-card)',
                color: riskFilter === val ? col : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>

          {/* MAP */}
          <div className={`map-container ${selectingHazardLocation ? 'map-picker-active' : ''}`} style={selectingHazardLocation
            ? { position: 'fixed', inset: 0, zIndex: 12000, width: '100vw', height: '100dvh', borderRadius: 0, overflow: 'hidden' }
            : { height: 500, position: 'relative', borderRadius: 14, overflow: 'hidden' }}
            onClick={() => setShowLayerPicker(false)}>
            {loading && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: 14 }}>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 24px', fontSize: 13, color: 'var(--accent)' }}>
                  Loading blackspot data…
                </div>
              </div>
            )}

            {/* We render MapContainer ONCE and control tile layers via MapController */}
            <MapContainer center={[21.1458, 79.0882]} zoom={12} style={{ width: '100%', height: '100%' }} zoomControl={true}>
              {/* No TileLayer here — MapController manages it imperatively to avoid duplicates */}
              <MapController tileLayerKey={activeLayer} panSignal={panSignal} />
              <MapPickerResizer active={selectingHazardLocation} />
              <HazardLocationPicker active={selectingHazardLocation} selectedLocation={selectingHazardLocation ? pickerLocation : selectedHazardLocation} onSelect={(location) => {
                setPickerLocation(location)
              }} />

              {/* Blackspot markers */}
              {showBlackspots && filteredBlackspots.filter(b => isValidCoordinate(b.lat, b.lng)).map((b) => (
                <Marker key={b.id} position={[b.lat, b.lng]} icon={createBlackspotIcon(b.risk)}>
                  <Popup>
                    <div style={{ fontFamily: 'Inter,sans-serif', minWidth: 190 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 4,
                        color: b.risk === 'HIGH' ? '#ef4444' : b.risk === 'MEDIUM' ? '#f59e0b' : '#10b981' }}>
                        ● ACCIDENT BLACKSPOT — {b.risk} RISK
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: '#1a1a1a' }}>{b.location}</div>
                      <table style={{ fontSize: 11, width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr><td style={{ color: '#888', paddingBottom: 2 }}>Total Accidents</td><td style={{ fontWeight: 700, color: '#ef4444', textAlign: 'right' }}>{b.total_accidents}</td></tr>
                          <tr><td style={{ color: '#888', paddingBottom: 2 }}>Avg per Record</td><td style={{ fontWeight: 600, textAlign: 'right' }}>{b.avg_accidents}</td></tr>
                          <tr><td style={{ color: '#888', paddingBottom: 2 }}>Road Type</td><td style={{ fontWeight: 600, textAlign: 'right' }}>{b.road_type}</td></tr>
                          <tr><td style={{ color: '#888' }}>Dataset Records</td><td style={{ fontWeight: 600, textAlign: 'right' }}>{b.records}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* User-reported hazard markers */}
              {showUserHazards && userHazards.map((h, i) => (
                (h.latitude ?? h.lat) != null && (h.longitude ?? h.lng) != null ? (
                  <Marker key={`user-${h.id ?? i}`} position={[h.latitude ?? h.lat, h.longitude ?? h.lng]} icon={createUserHazardIcon()}>
                    <Popup>
                      <div style={{ fontFamily: 'Inter,sans-serif', minWidth: 160 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#ffd60a', marginBottom: 3 }}>⚠ USER REPORTED</div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{h.hazardType || h.label || h.type || 'Hazard'}</div>
                        <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{h.description || ''}</div>
                        <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>{h.location || ''}</div>
                      </div>
                    </Popup>
                  </Marker>
                ) : null
              ))}

              {/* User GPS dot */}
              {userPos && isValidCoordinate(userPos.lat, userPos.lng) && (
                <>
                  <Marker position={[userPos.lat, userPos.lng]} icon={createCurrentLocationIcon()}>
                    <Popup>📍 You are here</Popup>
                  </Marker>
                  <Circle center={[userPos.lat, userPos.lng]} radius={Math.max(userPos.accuracy || 0, 30)} color="#2684ff" fillColor="#2684ff" fillOpacity={0.12} />
                </>
              )}

              <UserLocationButton onLocation={setUserPos} onError={setLocationError} />

              {/* D-Pad inside map */}
              <DPad onPan={handlePan} />
            </MapContainer>
            {selectingHazardLocation && (
              <div style={{ position:'absolute', inset:0, zIndex:1300, pointerEvents:'none', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:16 }}>
                <div style={{ alignSelf:'center', maxWidth:520, width:'100%', pointerEvents:'auto', background:'rgba(8,12,14,0.96)', border:'1px solid var(--accent)', borderRadius:12, padding:'14px 16px', boxShadow:'0 10px 30px rgba(0,0,0,0.45)' }}>
                  <div style={{ fontWeight:700, color:'var(--accent)', fontSize:14 }}>Select hazard location</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>Click on the map to select the hazard location.</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color: pickerLocation ? 'var(--accent)' : 'var(--text-muted)', marginTop:8 }}>
                    {pickerLocation ? `${pickerLocation.lat.toFixed(6)}, ${pickerLocation.lng.toFixed(6)}` : 'No location selected'}
                  </div>
                </div>
                <div style={{ alignSelf:'center', display:'flex', gap:10, pointerEvents:'auto', background:'rgba(8,12,14,0.96)', border:'1px solid var(--border)', borderRadius:12, padding:10, boxShadow:'0 10px 30px rgba(0,0,0,0.45)' }}>
                  <button type="button" className="btn btn-outline" onClick={() => { setSelectingHazardLocation(false); setPickerLocation(null) }}>Cancel</button>
                  <button type="button" className="btn btn-primary" disabled={!pickerLocation} onClick={() => { setSelectedHazardLocation(pickerLocation); setSelectingHazardLocation(false); setPickerLocation(null) }}>Confirm Location</button>
                </div>
              </div>
            )}

            {locationError && (
              <div role="alert" style={{ position: 'absolute', left: 14, right: 14, bottom: 14, zIndex: 900, background: 'rgba(127,29,29,0.95)', border: '1px solid #ef4444', borderRadius: 8, padding: '9px 12px', color: '#fee2e2', fontSize: 12 }}>
                {locationError}
              </div>
            )}

            {/* Legend */}
            {!selectingHazardLocation && <div style={{
              position: 'absolute', top: 10, left: 10, zIndex: 800,
              background: 'rgba(8,12,14,0.92)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '10px 14px', fontSize: 11, pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 9, color: '#666', letterSpacing: 1, marginBottom: 6 }}>BLACKSPOT RISK</div>
              {[['#ef4444', '● High Risk'], ['#f59e0b', '● Medium Risk'], ['#10b981', '● Low Risk'], ['#ffd60a', '⚠ User Report']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                  <span style={{ color: '#bbb' }}>{l}</span>
                </div>
              ))}
            </div>}

            {/* Report FAB */}
            {!selectingHazardLocation && <button
              onClick={() => setShowHazardModal(true)}
              style={{
                position: 'absolute', bottom: 16, right: 16, zIndex: 800,
                background: 'var(--orange)', color: '#fff', border: 'none',
                borderRadius: 10, padding: '10px 16px', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 20px rgba(255,149,0,0.4)', transition: 'all 0.2s',
              }}
            >
              <Plus size={14} /> Report Hazard
            </button>}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Quick Stats */}
          <div className="card card-sm">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Live Telemetry</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {statsData.map(s => (
                <div key={s.label} style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: s.color }}>
                    {loading ? '…' : s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Layer Controls */}
          <div className="card card-sm">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Map Layers</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Accident Blackspots', count: filteredBlackspots.length, show: showBlackspots, set: setShowBlackspots, color: '#ef4444' },
                { label: 'User Reports', count: userHazards.length, show: showUserHazards, set: setShowUserHazards, color: '#ffd60a' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                    <span style={{ fontSize: 12 }}>{item.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({item.count})</span>
                  </div>
                  <button onClick={() => item.set(v => !v)} style={{
                    width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: item.show ? item.color : 'var(--border)',
                    position: 'relative', transition: 'all 0.2s',
                  }}>
                    <div style={{ position: 'absolute', top: 2, left: item.show ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'all 0.2s' }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Base Layer Picker (panel) */}
          <div className="card card-sm">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Base Map</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(TILE_LAYERS).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setActiveLayer(key)}
                  style={{
                    textAlign: 'left', padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                    background: activeLayer === key ? 'rgba(0,229,160,0.1)' : 'var(--bg-base)',
                    border: `1px solid ${activeLayer === key ? 'rgba(0,229,160,0.3)' : 'var(--border)'}`,
                    color: activeLayer === key ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: activeLayer === key ? 700 : 400, fontSize: 12, transition: 'all 0.15s',
                  }}
                >
                  {activeLayer === key ? '✓ ' : ''}{cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Top Blackspots list */}
          <div className="card card-sm" style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
              Top Accident Zones
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
              {blackspots.slice(0, 15).map((b, i) => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', minWidth: 20, textAlign: 'center' }}>#{i + 1}</div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: b.risk === 'HIGH' ? '#ef4444' : b.risk === 'MEDIUM' ? '#f59e0b' : '#10b981' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{b.location}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{b.total_accidents} accidents · {b.road_type}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700,
                    color: b.risk === 'HIGH' ? '#ef4444' : b.risk === 'MEDIUM' ? '#f59e0b' : '#10b981' }}>
                    {b.risk}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Report Hazard Modal */}
      {showHazardModal && (
        <ReportHazardModal
          onClose={() => { setShowHazardModal(false); setSelectingHazardLocation(false); setPickerLocation(null); setSelectedHazardLocation(null) }}
          selectedLocation={selectedHazardLocation}
          selectingOnMap={selectingHazardLocation}
          pickerOpen={selectingHazardLocation}
          onSelectOnMap={() => { setPickerLocation(selectedHazardLocation); setSelectingHazardLocation(true) }}
          onCancelSelection={() => { setSelectingHazardLocation(false); setPickerLocation(null) }}
          onClearMapSelection={() => setSelectedHazardLocation(null)}
          onSubmit={() => {
            loadUserHazards()
            setShowHazardModal(false)
            setSelectingHazardLocation(false)
            setPickerLocation(null)
            setSelectedHazardLocation(null)
          }}
        />
      )}
    </div>
  )
}
