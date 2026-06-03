import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AlertTriangle, CheckCircle, Filter, Locate, Layers, MapPin, Plus, RefreshCw } from 'lucide-react'
import ReportHazardModal from '../components/ReportHazardModal'

// Fix Leaflet default icon paths (needed with Vite)
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

const BASE_HOTSPOTS = [
  { id: 1, lat: 21.1458, lng: 79.0882, type: 'red', label: 'Sitabuldi Interchange', risk: 'CRITICAL', detail: '12 incidents/month' },
  { id: 2, lat: 21.1320, lng: 79.1070, type: 'red', label: 'Wardha Road Signal', risk: 'CRITICAL', detail: '8 incidents/month' },
  { id: 3, lat: 21.1520, lng: 79.0650, type: 'orange', label: 'Dharampeth Square', risk: 'HIGH', detail: '5 incidents/month' },
  { id: 4, lat: 21.1640, lng: 79.1120, type: 'orange', label: 'Manish Nagar Flyover', risk: 'HIGH', detail: '3 incidents/month' },
  { id: 5, lat: 21.1150, lng: 79.0720, type: 'green', label: 'Hingna Road', risk: 'LOW', detail: '1 incident/month' },
  { id: 6, lat: 21.1580, lng: 79.0510, type: 'green', label: 'Civil Lines Bypass', risk: 'LOW', detail: '0 incidents' },
  { id: 7, lat: 21.1250, lng: 79.1350, type: 'orange', label: 'Besa Road', risk: 'MEDIUM', detail: '2 incidents/month' },
]

const ROAD_INCIDENTS = [
  { time: '2 min ago', location: 'Sitabuldi Interchange', type: 'Accident', severity: 'critical' },
  { time: '8 min ago', location: 'Wardha Road', type: 'Congestion', severity: 'high' },
  { time: '15 min ago', location: 'Dharampeth', type: 'Road Work', severity: 'medium' },
  { time: '22 min ago', location: 'Manish Nagar', type: 'Breakdown', severity: 'low' },
]

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
  const [mapLayer, setMapLayer] = useState('risk')
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  const refreshHazards = useCallback(() => setUserHazards(getStoredHazards()), [])

  const allHotspots = [
    ...BASE_HOTSPOTS.filter((h) => {
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
    const colors = { red: '#ff4d4d', orange: '#ff9500', green: '#00e5a0' }
    return createColoredIcon(colors[h.type] || '#4db8ff')
  }

  return (
    <div className="page">
      <style>{`
        @keyframes ripplePulse {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>

      {/* Alert Bar */}
      <div className="alert-banner" style={{ marginBottom: 16 }}>
        <AlertTriangle size={14} color="var(--red)" />
        <span style={{ color: 'var(--red)', fontWeight: 600 }}>LIVE ALERT:</span>
        <span style={{ color: 'var(--text-secondary)' }}>
          High-risk incident detected at Sitabuldi Interchange — 2 min ago. Consider alternate route.
        </span>
        <button
          className="btn-ghost"
          style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 8px' }}
          onClick={() => document.querySelector('[data-page="navigate"]')?.click()}
        >
          Reroute
        </button>
      </div>

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

              {allHotspots.map((h) => (
                <Marker key={h.id} position={[h.lat, h.lng]} icon={getIcon(h)}>
                  <Popup>
                    <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 160 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: 1,
                        color: h.risk === 'CRITICAL' ? '#ff4d4d' : h.risk === 'HIGH' ? '#ff9500' : h.userReported ? '#ffd60a' : '#00e5a0',
                        marginBottom: 4,
                      }}>
                        {h.userReported ? '⚠ USER REPORTED' : h.risk}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{h.label}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{h.detail || h.description}</div>
                      {h.userReported && (
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
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Live Statistics</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Active Alerts', value: String(allHotspots.filter(h => h.risk === 'CRITICAL').length), color: 'var(--red)' },
                { label: 'Safe Zones', value: String(allHotspots.filter(h => h.risk === 'LOW').length), color: 'var(--accent)' },
                { label: 'User Reports', value: String(userHazards.length), color: 'var(--yellow)' },
                { label: 'Live Vehicles', value: '1.2K', color: 'var(--blue)' },
              ].map((s) => (
                <div key={s.label} style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Incidents */}
          <div className="card card-sm" style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' }}>Recent Incidents</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ROAD_INCIDENTS.map((inc, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, padding: '8px',
                  background: 'var(--bg-base)', borderRadius: 8,
                  border: '1px solid var(--border)', cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                    background: inc.severity === 'critical' ? 'var(--red)' : inc.severity === 'high' ? 'var(--orange)' : inc.severity === 'medium' ? 'var(--yellow)' : 'var(--accent)'
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{inc.type}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{inc.location}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{inc.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Route */}
          <div className="card card-sm" style={{ background: 'rgba(0,229,160,0.05)', borderColor: 'rgba(0,229,160,0.2)' }}>
            <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>Active Route</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Civil Lines → Airport</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>Via Wardha Road Bypass • 18 min</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2 }}>
                <div style={{ width: '35%', height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--accent)' }}>35%</span>
            </div>
            <span className="badge badge-low">Safe Route Active</span>
          </div>
        </div>
      </div>

      {/* Hotspot Grid */}
      <div style={{ marginTop: 20 }}>
        <div className="section-header">
          <div>
            <div className="section-title">Nagpur Hotspot Grid</div>
            <div className="section-sub">{allHotspots.length} monitored locations • Updated live</div>
          </div>
          <button
            className="btn btn-outline"
            style={{ padding: '7px 14px', fontSize: 12 }}
            onClick={() => setShowFilterPanel(!showFilterPanel)}
          >
            <Filter size={12} /> Filter
          </button>
        </div>
        <div className="grid-4 hotspot-grid">
          {allHotspots.map((h) => (
            <div key={h.id} className="card card-sm" style={{ cursor: 'pointer', transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <MapPin size={14} color={
                  h.userReported ? 'var(--yellow)' :
                  h.type === 'red' ? 'var(--red)' :
                  h.type === 'orange' ? 'var(--orange)' : 'var(--accent)'
                } />
                <span className={`badge badge-${
                  h.risk === 'CRITICAL' ? 'critical' :
                  h.risk === 'HIGH' ? 'high' :
                  h.risk === 'MEDIUM' ? 'medium' : 'low'
                }`}>
                  {h.userReported ? '⚠ Reported' : h.risk}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{h.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{h.detail || h.description}</div>
            </div>
          ))}
        </div>
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
