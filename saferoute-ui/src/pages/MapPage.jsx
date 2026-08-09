import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AlertTriangle, Filter, Locate, Layers, MapPin, Plus, RefreshCw } from 'lucide-react'
import ReportHazardModal from '../components/ReportHazardModal'
import { getHotspots } from '../services/api'

// Fix Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const createColoredIcon = (color, size = 14) => L.divIcon({
  className: '',
  html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid rgba(255,255,255,0.4);box-shadow:0 0 12px ${color}99;position:relative;">
    <div style="position:absolute;inset:-5px;border-radius:50%;border:1.5px solid ${color}66;animation:ripplePulse 2s infinite;"></div>
  </div>`,
  iconSize: [size, size],
  iconAnchor: [size / 2, size / 2],
})

const createHazardIcon = () => L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;background:#ffd60a;border-radius:4px;transform:rotate(45deg);border:2px solid rgba(255,214,10,0.6);box-shadow:0 0 12px #ffd60a88;display:flex;align-items:center;justify-content:center;">
    <span style="transform:rotate(-45deg);font-size:11px;">⚠</span>
  </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

function UserLocationButton() {
  const map = useMap()
  const locate = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 15),
      () => alert('Location permission denied.')
    )
  }
  return (
    <button
      onClick={locate}
      title="My Location"
      style={{
        position: 'absolute', bottom: 80, right: 12, zIndex: 800,
        width: 36, height: 36, borderRadius: 8,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Locate size={15} />
    </button>
  )
}

function getStoredHazards() {
  try { return JSON.parse(localStorage.getItem('saferoute_hazards') || '[]') } catch { return [] }
}

export default function MapPage() {
  const [filter, setFilter] = useState('all')
  const [showHazardModal, setShowHazardModal] = useState(false)
  const [userHazards, setUserHazards] = useState(getStoredHazards)
  const [apiHotspots, setApiHotspots] = useState([])
  const [mapLayer, setMapLayer] = useState('risk')
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  const refreshHazards = useCallback(() => {
    setUserHazards(getStoredHazards())
    getHotspots()
      .then((data) => setApiHotspots(Array.isArray(data) ? data : []))
      .catch(() => setApiHotspots([]))
  }, [])

  useEffect(() => {
    refreshHazards()
  }, [refreshHazards])

  const allHotspots = [
    ...apiHotspots.filter((h) => {
      if (filter === 'all') return true
      if (filter === 'critical') return h.risk === 'CRITICAL'
      if (filter === 'high') return h.risk === 'HIGH'
      if (filter === 'safe') return h.risk === 'LOW'
      return true
    }),
    ...userHazards,
  ]

  const getIcon = (h) => {
    if (h.userReported) return createHazardIcon()
    const colors = { red: '#ff4d4d', orange: '#ff9500', green: '#00e5a0', CRITICAL: '#ff4d4d', HIGH: '#ff9500', LOW: '#00e5a0' }
    return createColoredIcon(colors[h.type] || colors[h.risk] || '#4db8ff')
  }

  return (
    <div className="page">
      <style>{`
        @keyframes ripplePulse {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }} className="map-grid">
        {/* MAP */}
        <div>
          {/* Map Layer Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {['risk', 'traffic', 'incidents', 'routes'].map((layer) => (
              <button
                key={layer}
                onClick={() => setMapLayer(layer)}
                className={`btn ${mapLayer === layer ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 12px', fontSize: 11, borderRadius: 6, textTransform: 'capitalize' }}
              >
                {layer}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button
                className="icon-btn"
                title="Filter"
                onClick={() => setShowFilterPanel(!showFilterPanel)}
              >
                <Filter size={13} />
              </button>
              <button
                className="icon-btn"
                title="Refresh Hazards"
                onClick={refreshHazards}
              >
                <RefreshCw size={13} />
              </button>
              <button className="icon-btn" title="Layers">
                <Layers size={13} />
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilterPanel && (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 10,
              display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Filter:</span>
              {[
                { val: 'all', label: 'All Zones' },
                { val: 'critical', label: '⊙ Critical' },
                { val: 'high', label: '⚠ High' },
                { val: 'safe', label: '✓ Safe' },
              ].map((f) => (
                <button
                  key={f.val}
                  onClick={() => setFilter(f.val)}
                  style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                    border: filter === f.val ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: filter === f.val ? 'var(--accent-glow2)' : 'var(--bg-base)',
                    color: filter === f.val ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* REAL LEAFLET MAP */}
          <div className="map-container" style={{ height: 460, position: 'relative' }}>
            <MapContainer
              center={[21.1458, 79.0882]}
              zoom={13}
              style={{ width: '100%', height: '100%', borderRadius: 12 }}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {allHotspots.map((h, i) => (
                <Marker key={h.id || i} position={[h.lat || h.latitude, h.lng || h.longitude]} icon={getIcon(h)}>
                  <Popup>
                    <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 160 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: 1,
                        color: h.risk === 'CRITICAL' ? '#ff4d4d' : h.risk === 'HIGH' ? '#ff9500' : h.userReported ? '#ffd60a' : '#00e5a0',
                        marginBottom: 4,
                      }}>
                        {h.userReported ? '⚠ USER REPORTED' : h.risk || 'HAZARD'}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{h.label || h.location || h.description || 'Reported Location'}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{h.detail || h.description || 'Live safety record'}</div>
                      {h.userReported && h.reportedAt && (
                        <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                          {new Date(h.reportedAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}

              <UserLocationButton />
            </MapContainer>

            {/* Legend overlay */}
            <div style={{
              position: 'absolute', top: 12, left: 12, zIndex: 800,
              background: 'rgba(13,20,23,0.92)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 12px', fontSize: 11,
              pointerEvents: 'none',
            }}>
              <div style={{ marginBottom: 6, fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>RISK LEVEL</div>
              {[
                ['#ff4d4d', 'Critical'],
                ['#ff9500', 'High/Medium'],
                ['#00e5a0', 'Low/Safe'],
                ['#ffd60a', 'User Reported'],
              ].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{l}</span>
                </div>
              ))}
            </div>

            {/* Report Hazard FAB */}
            <button
              onClick={() => setShowHazardModal(true)}
              title="Report a Hazard"
              style={{
                position: 'absolute', bottom: 16, right: 16, zIndex: 800,
                background: 'var(--orange)', color: '#fff',
                border: 'none', borderRadius: 10, padding: '10px 16px',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 20px rgba(255,149,0,0.4)',
                transition: 'all 0.2s',
              }}
            >
              <Plus size={14} /> Report Hazard
            </button>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Stats */}
          <div className="card card-sm">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Live Telemetry</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Active Alerts', value: String(allHotspots.filter(h => h.risk === 'CRITICAL').length), color: 'var(--red)' },
                { label: 'Safe Zones', value: String(allHotspots.filter(h => h.risk === 'LOW').length), color: 'var(--accent)' },
                { label: 'User Reports', value: String(userHazards.length), color: 'var(--yellow)' },
                { label: 'Database Records', value: String(apiHotspots.length), color: 'var(--blue)' },
              ].map((s) => (
                <div key={s.label} style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* User Hazards List */}
          <div className="card card-sm" style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' }}>User Reported Hazards</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {userHazards.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
                  No active hazard reports submitted. Click "Report Hazard" to submit one.
                </div>
              ) : (
                userHazards.map((inc, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, padding: '8px',
                    background: 'var(--bg-base)', borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                      background: 'var(--yellow)'
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{inc.type || 'Hazard'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{inc.description || inc.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{inc.reportedAt ? new Date(inc.reportedAt).toLocaleTimeString() : 'Just now'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hotspot Grid */}
      <div style={{ marginTop: 20 }}>
        <div className="section-header">
          <div>
            <div className="section-title">Database Hotspot Grid</div>
            <div className="section-sub">{allHotspots.length} active records loaded from system</div>
          </div>
          <button
            className="btn btn-outline"
            style={{ padding: '7px 14px', fontSize: 12 }}
            onClick={() => setShowFilterPanel(!showFilterPanel)}
          >
            <Filter size={12} /> Filter
          </button>
        </div>

        {allHotspots.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <AlertTriangle size={32} color="var(--text-muted)" style={{ marginBottom: 8, opacity: 0.5 }} />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No Blackspots or Hazards Found</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              The database does not contain active blackspots. Use "Report Hazard" to submit real-time hazards.
            </div>
          </div>
        ) : (
          <div className="grid-4 hotspot-grid">
            {allHotspots.map((h, idx) => (
              <div key={h.id || idx} className="card card-sm" style={{ cursor: 'pointer', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <MapPin size={14} color={
                    h.userReported ? 'var(--yellow)' :
                    h.type === 'red' || h.risk === 'CRITICAL' ? 'var(--red)' :
                    h.type === 'orange' || h.risk === 'HIGH' ? 'var(--orange)' : 'var(--accent)'
                  } />
                  <span className={`badge badge-${
                    h.risk === 'CRITICAL' ? 'critical' :
                    h.risk === 'HIGH' ? 'high' :
                    h.risk === 'MEDIUM' ? 'medium' : 'low'
                  }`}>
                    {h.userReported ? '⚠ Reported' : h.risk || 'ACTIVE'}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{h.label || h.location || 'Location Marker'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{h.detail || h.description || 'Geo-coordinate hazard'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hazard Modal */}
      {showHazardModal && (
        <ReportHazardModal
          onClose={() => setShowHazardModal(false)}
          onSubmit={(newHazard) => {
            setUserHazards((prev) => [...prev, newHazard])
            setShowHazardModal(false)
          }}
        />
      )}
    </div>
  )
}
