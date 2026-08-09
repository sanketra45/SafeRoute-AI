import { useState, useEffect } from 'react'
import { AlertTriangle, Download, RefreshCw } from 'lucide-react'
import { getHotspots } from '../services/api'

export default function RiskAnalysisPage() {
  const [filter, setFilter] = useState('all')
  const [hotspots, setHotspots] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = () => {
    setLoading(true)
    getHotspots()
      .then((data) => {
        setHotspots(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => {
        setHotspots([])
        setLoading(false)
      })
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = filter === 'all'
    ? hotspots
    : hotspots.filter(l => (l.risk || '').toLowerCase() === filter)

  const criticalCount = hotspots.filter(h => h.risk === 'CRITICAL').length
  const highCount     = hotspots.filter(h => h.risk === 'HIGH').length
  const lowCount      = hotspots.filter(h => h.risk === 'LOW').length

  return (
    <div className="page">
      <div className="section-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="section-title">Risk Analysis</div>
          <div className="section-sub">System hazard analytics and database blackspot monitoring</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" style={{ padding: '7px 12px', fontSize: 11 }} onClick={loadData}>
            <RefreshCw size={12} /> Refresh
          </button>
          <button className="btn btn-outline" style={{ padding: '7px 12px', fontSize: 11 }}>
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* TOP STATS */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Database Blackspots', value: String(hotspots.length), sub: 'Total monitored zones', color: 'var(--red)', icon: '🚨' },
          { label: 'Critical Zones', value: String(criticalCount), sub: 'High accident probability', color: 'var(--orange)', icon: '⚠️' },
          { label: 'High Risk Zones', value: String(highCount), sub: 'Frequent hazard points', color: 'var(--yellow)', icon: '⚡' },
          { label: 'Low Risk Zones', value: String(lowCount), sub: 'Cleared safe zones', color: 'var(--accent)', icon: '🛡' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-label">{s.label}</div>
              <span style={{ fontSize: 18 }}>{s.icon}</span>
            </div>
            <div className="stat-value" style={{ color: s.color, fontSize: 28 }}>{loading ? '...' : s.value}</div>
            <div className="stat-footer">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Hotspot Table */}
      <div className="card">
        <div className="section-header">
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Monitored Blackspots</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Intersections recorded in the database</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'critical', 'high', 'medium', 'low'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`btn ${filter === f ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '5px 10px', fontSize: 11, textTransform: 'capitalize' }}>{f}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading risk analysis data...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <AlertTriangle size={36} color="var(--text-muted)" style={{ marginBottom: 12, opacity: 0.5 }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              No Blackspot Records Found
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
              There are no blackspot records matching your criteria in the database.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Location Name</th>
                <th>Incident Details</th>
                <th>Risk Level</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => (
                <tr key={l.id || i}>
                  <td style={{ fontWeight: 600 }}>{l.label || l.location || l.name || 'Location'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{l.detail || l.rate || 'Recorded zone'}</td>
                  <td>
                    <span className={`badge badge-${l.risk === 'CRITICAL' ? 'critical' : l.risk === 'HIGH' ? 'high' : 'medium'}`}>
                      {l.risk || 'ACTIVE'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{l.confidence ? `${l.confidence}%` : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
