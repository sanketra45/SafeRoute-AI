import { useState } from 'react'
import { Navigation, MapPin, Clock, Shield, AlertTriangle, ChevronRight, Zap, CheckCircle, RefreshCw, Loader } from 'lucide-react'
import { getSafeRoute, geocode } from '../services/api'

const ROUTES = [
  {
    id: 1, name: 'Safest Route', via: 'Civil Lines → Wardha Road Bypass → Airport',
    time: '22 min', distance: '14.2 km', riskScore: 92, incidents: 0,
    type: 'safe', recommended: true,
    turns: ['Head North on Civil Lines Rd', 'Turn right on Wardha Road', 'Take Bypass at KP signal', 'Merge onto Airport Road'],
  },
  {
    id: 2, name: 'Fastest Route', via: 'Sitabuldi → Zero Mile → Airport',
    time: '14 min', distance: '11.8 km', riskScore: 55, incidents: 3,
    type: 'fast', recommended: false,
    turns: ['Head South on Sitabuldi Rd', 'Pass Zero Mile', 'Enter high-risk zone', 'Airport terminal'],
  },
  {
    id: 3, name: 'Balanced Route', via: 'Dharampeth → Manish Nagar → Airport',
    time: '18 min', distance: '12.9 km', riskScore: 74, incidents: 1,
    type: 'balanced', recommended: false,
    turns: ['Head West on Dharampeth Rd', 'Turn at Manish Nagar', 'Merge at Ring Road', 'Airport exit'],
  },
]

export default function NavigatePage() {
  const [from, setFrom] = useState('Civil Lines, Nagpur')
  const [to, setTo] = useState('Dr. Babasaheb Ambedkar International Airport')
  const [selectedRoute, setSelectedRoute] = useState(1)
  const [navigating, setNavigating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [apiRoutes, setApiRoutes] = useState(null)
  const [apiError, setApiError] = useState(null)

  const handleFindRoutes = async () => {
    setLoading(true)
    setApiError(null)
    try {
      // Try to geocode both locations
      const [fromResults, toResults] = await Promise.all([
        geocode(from, 1),
        geocode(to, 1),
      ])
      const origin = fromResults[0]
      const dest   = toResults[0]
      if (!origin || !dest) throw new Error('Could not geocode locations')
      const result = await getSafeRoute({
        originLat: parseFloat(origin.lat),
        originLon: parseFloat(origin.lon),
        destLat:   parseFloat(dest.lat),
        destLon:   parseFloat(dest.lon),
      })
      setApiRoutes(result)
    } catch (err) {
      setApiError(err.message.includes('geocode') ? 'Could not find those locations.' : 'ML service offline — showing demo routes.')
    } finally {
      setLoading(false)
    }
  }

  const active = ROUTES.find(r => r.id === selectedRoute)

  return (
    <div className="page">
      <div className="section-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="section-title">Route Navigator</div>
          <div className="section-sub">AI-powered safe path planning for Nagpur</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="pulse-dot" />
          <span style={{ fontSize: 11, color: 'var(--accent)' }}>Live traffic data</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>
        {/* LEFT: Input + Route Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Route Input */}
          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-base)', zIndex: 1 }} />
                <input className="input" value={from} onChange={e => setFrom(e.target.value)} style={{ paddingLeft: 32 }} placeholder="From" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button className="icon-btn" onClick={() => { const t = from; setFrom(to); setTo(t) }}>
                  <RefreshCw size={13} />
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}>
                  <MapPin size={14} color="var(--red)" />
                </div>
                <input className="input" value={to} onChange={e => setTo(e.target.value)} style={{ paddingLeft: 32 }} placeholder="To" />
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleFindRoutes}
                disabled={loading}
              >
                {loading ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Finding Routes...</> : <><Navigation size={14} /> Find Safe Routes</>}
              </button>
              {apiError && (
                <div style={{ fontSize: 11, color: 'var(--orange)', padding: '4px 0' }}>
                  ⚠ {apiError}
                </div>
              )}
              {apiRoutes && (
                <div style={{ fontSize: 11, color: 'var(--accent)', padding: '4px 0' }}>
                  ✓ Route found! Safe: {(apiRoutes.safeDistance / 1000).toFixed(1)}km vs Fast: {(apiRoutes.fastDistance / 1000).toFixed(1)}km
                </div>
              )}
            </div>
          </div>

          {/* Route Options */}
          {ROUTES.map(route => (
            <div
              key={route.id}
              className="card"
              style={{
                cursor: 'pointer',
                border: selectedRoute === route.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: selectedRoute === route.id ? 'rgba(0,229,160,0.04)' : 'var(--bg-card)',
                transition: 'all 0.2s',
              }}
              onClick={() => setSelectedRoute(route.id)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700 }}>{route.name}</span>
                    {route.recommended && <span className="badge badge-low" style={{ fontSize: 9 }}>RECOMMENDED</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{route.via}</div>
                </div>
                {selectedRoute === route.id && <CheckCircle size={16} color="var(--accent)" />}
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
                    background: route.riskScore >= 80 ? 'var(--accent)' : route.riskScore >= 60 ? 'var(--orange)' : 'var(--red)',
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: route.riskScore >= 80 ? 'var(--accent)' : route.riskScore >= 60 ? 'var(--orange)' : 'var(--red)', minWidth: 32, textAlign: 'right' }}>
                  {route.riskScore}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Safety</span>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT: Map + Turn-by-turn */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Route Map Preview */}
          <div className="map-container" style={{ height: 280, borderRadius: 12 }}>
            <div className="mock-map" style={{ height: '100%' }}>
              {/* Route path */}
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                {selectedRoute === 1 && (
                  <polyline points="80,60 180,80 280,140 400,180 520,200" stroke="var(--accent)" strokeWidth="3" fill="none" strokeDasharray="8,4" />
                )}
                {selectedRoute === 2 && (
                  <polyline points="80,60 160,100 240,120 340,130 520,200" stroke="var(--red)" strokeWidth="3" fill="none" strokeDasharray="8,4" />
                )}
                {selectedRoute === 3 && (
                  <polyline points="80,60 200,110 310,160 430,175 520,200" stroke="var(--orange)" strokeWidth="3" fill="none" strokeDasharray="8,4" />
                )}
                <circle cx="80" cy="60" r="6" fill="var(--accent)" />
                <circle cx="520" cy="200" r="6" fill="var(--red)" />
              </svg>
              <div style={{ position: 'absolute', top: 12, left: 12, fontSize: 11, color: 'var(--text-muted)', background: 'rgba(13,20,23,0.85)', padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                {active?.name} Preview
              </div>
            </div>
          </div>

          {/* Turn by Turn */}
          <div className="card">
            <div className="section-header" style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Turn-by-Turn</div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{active?.time} • {active?.distance}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {active?.turns.map((turn, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: i < active.turns.length - 1 ? '1px solid rgba(30,45,50,0.5)' : 'none', alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-base)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{turn}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{(i === 0 || i === active.turns.length - 1) ? '— waypoint' : `~${(i + 1) * 3} min`}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Start Navigation */}
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15, borderRadius: 10 }}
            onClick={() => setNavigating(!navigating)}
          >
            {navigating ? (
              <><Shield size={16} /> Navigation Active — Tap to End</>
            ) : (
              <><Navigation size={16} /> Start Navigation</>
            )}
          </button>

          {navigating && (
            <div className="alert-banner info">
              <CheckCircle size={14} color="var(--accent)" />
              <span style={{ color: 'var(--text-primary)' }}>SafeRoute AI is monitoring your route in real-time. 0 hazards ahead.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
