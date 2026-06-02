import { useState } from 'react'
import { AlertTriangle, CheckCircle, Info, Layers, Filter, ZoomIn, ZoomOut, Locate, MapPin } from 'lucide-react'

const HOTSPOTS = [
  { id: 1, x: '22%', y: '28%', type: 'red', label: 'Sitabuldi Interchange', risk: 'CRITICAL', detail: '12 incidents/month' },
  { id: 2, x: '58%', y: '42%', type: 'red', label: 'Wardha Road Signal', risk: 'CRITICAL', detail: '8 incidents/month' },
  { id: 3, x: '38%', y: '60%', type: 'orange', label: 'Dharampeth Square', risk: 'HIGH', detail: '5 incidents/month' },
  { id: 4, x: '72%', y: '25%', type: 'orange', label: 'Manish Nagar Flyover', risk: 'HIGH', detail: '3 incidents/month' },
  { id: 5, x: '48%', y: '78%', type: 'green', label: 'Hingna Road', risk: 'LOW', detail: '1 incident/month' },
  { id: 6, x: '15%', y: '65%', type: 'green', label: 'Civil Lines Bypass', risk: 'LOW', detail: '0 incidents' },
  { id: 7, x: '82%', y: '65%', type: 'orange', label: 'Besa Road', risk: 'MEDIUM', detail: '2 incidents/month' },
]

const ROAD_INCIDENTS = [
  { time: '2 min ago', location: 'Sitabuldi Interchange', type: 'Accident', severity: 'critical' },
  { time: '8 min ago', location: 'Wardha Road', type: 'Congestion', severity: 'high' },
  { time: '15 min ago', location: 'Dharampeth', type: 'Road Work', severity: 'medium' },
  { time: '22 min ago', location: 'Manish Nagar', type: 'Breakdown', severity: 'low' },
]

export default function MapPage() {
  const [activeHotspot, setActiveHotspot] = useState(null)
  const [mapLayer, setMapLayer] = useState('risk')
  const [zoom, setZoom] = useState(100)

  return (
    <div className="page">
      {/* Alert Bar */}
      <div className="alert-banner" style={{ marginBottom: 16 }}>
        <AlertTriangle size={14} color="var(--red)" />
        <span style={{ color: 'var(--red)', fontWeight: 600 }}>LIVE ALERT:</span>
        <span style={{ color: 'var(--text-secondary)' }}>High-risk incident detected at Sitabuldi Interchange — 2 min ago. Consider alternate route.</span>
        <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 8px' }}>Reroute</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        {/* MAP */}
        <div>
          {/* Map Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {['risk', 'traffic', 'incidents', 'routes'].map(layer => (
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
              <button className="icon-btn" onClick={() => setZoom(z => Math.min(z + 10, 150))}><ZoomIn size={13} /></button>
              <button className="icon-btn" onClick={() => setZoom(z => Math.max(z - 10, 70))}><ZoomOut size={13} /></button>
              <button className="icon-btn"><Locate size={13} /></button>
              <button className="icon-btn"><Layers size={13} /></button>
            </div>
          </div>

          {/* MAP CANVAS */}
          <div className="map-container" style={{ height: 480 }}>
            <div className="mock-map" style={{ height: '100%', transform: `scale(${zoom / 100})`, transition: 'transform 0.3s' }}>
              {/* Roads */}
              <div className="map-road" style={{ width: '80%', height: 3, top: '35%', left: '10%', transform: 'rotate(0deg)' }} />
              <div className="map-road" style={{ width: '60%', height: 3, top: '55%', left: '20%', transform: 'rotate(5deg)' }} />
              <div className="map-road" style={{ width: 3, height: '70%', top: '15%', left: '40%' }} />
              <div className="map-road" style={{ width: 3, height: '50%', top: '25%', left: '65%' }} />
              <div className="map-road" style={{ width: '40%', height: 3, top: '72%', left: '15%', transform: 'rotate(-3deg)' }} />

              {/* Hotspots */}
              {HOTSPOTS.map(h => (
                <div
                  key={h.id}
                  className={`map-hotspot hotspot-${h.type}`}
                  style={{ left: h.x, top: h.y }}
                  onClick={() => setActiveHotspot(activeHotspot?.id === h.id ? null : h)}
                />
              ))}

              {/* Active tooltip */}
              {activeHotspot && (
                <div className="map-overlay-card" style={{ left: activeHotspot.x, top: `calc(${activeHotspot.y} + 20px)`, zIndex: 10 }}>
                  <div style={{ fontSize: 10, letterSpacing: 1, color: activeHotspot.type === 'red' ? 'var(--red)' : activeHotspot.type === 'orange' ? 'var(--orange)' : 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>
                    {activeHotspot.risk}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 2 }}>{activeHotspot.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{activeHotspot.detail}</div>
                </div>
              )}

              {/* Center label */}
              <div style={{ position: 'absolute', bottom: 16, left: 16, fontSize: 11, color: 'var(--text-muted)', background: 'rgba(13,20,23,0.8)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                🗺 Nagpur Urban Core • Zoom: {zoom}%
              </div>

              {/* Legend */}
              <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(13,20,23,0.9)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 11 }}>
                <div style={{ marginBottom: 6, fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>RISK LEVEL</div>
                {[['red', 'Critical'], ['orange', 'High/Medium'], ['green', 'Low/Safe']].map(([c, l]) => (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${c === 'green' ? 'accent' : c})` }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Stats */}
          <div className="card card-sm">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Live Statistics</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Active Alerts', value: '7', color: 'var(--red)' },
                { label: 'Safe Routes', value: '12', color: 'var(--accent)' },
                { label: 'Avg Risk Score', value: '72', color: 'var(--orange)' },
                { label: 'Live Vehicles', value: '1.2K', color: 'var(--blue)' },
              ].map(s => (
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
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.2s' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: inc.severity === 'critical' ? 'var(--red)' : inc.severity === 'high' ? 'var(--orange)' : inc.severity === 'medium' ? 'var(--yellow)' : 'var(--accent)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{inc.type}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{inc.location}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{inc.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* My Route */}
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
            <div className="section-sub">7 monitored intersections • Updated 30 sec ago</div>
          </div>
          <button className="btn btn-outline" style={{ padding: '7px 14px', fontSize: 12 }}>
            <Filter size={12} /> Filter
          </button>
        </div>
        <div className="grid-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {HOTSPOTS.map(h => (
            <div key={h.id} className="card card-sm" style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setActiveHotspot(h)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <MapPin size={14} color={h.type === 'red' ? 'var(--red)' : h.type === 'orange' ? 'var(--orange)' : 'var(--accent)'} />
                <span className={`badge badge-${h.risk.toLowerCase() === 'critical' ? 'critical' : h.risk.toLowerCase() === 'high' ? 'high' : h.risk.toLowerCase() === 'medium' ? 'medium' : 'low'}`}>
                  {h.risk}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{h.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{h.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
