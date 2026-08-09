import { useState, useEffect } from 'react'
import { Users, AlertTriangle, Shield, Activity, RefreshCw, Download } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import { getAdminStats, getHotspots } from '../services/api'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null
  return (
    <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || p.stroke, marginBottom: 3 }}>{p.name}: {p.value?.toLocaleString()}</div>
      ))}
    </div>
  )
}

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState('overview')
  const [stats, setStats] = useState(null)
  const [hotspots, setHotspots] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = () => {
    setLoading(true)
    Promise.all([
      getAdminStats().catch(() => null),
      getHotspots().catch(() => []),
    ]).then(([statsRes, hotspotsRes]) => {
      setStats(statsRes)
      setHotspots(Array.isArray(hotspotsRes) ? hotspotsRes : [])
      setLoading(false)
    })
  }

  useEffect(() => {
    loadData()
  }, [])

  const SECTIONS = ['overview', 'hotspots', 'users', 'alerts', 'reports']

  const totalAccidents = stats?.totalAccidents ?? 0
  const activeHazards  = stats?.activeHazards ?? hotspots.length
  const totalUsers     = stats?.totalUsers ?? 0
  const avgSafetyScore = stats?.avgSafetyScore ? `${stats.avgSafetyScore}%` : '0%'

  const severityData = stats?.severitySplit || [
    { name: 'High Risk', value: hotspots.filter(h => h.risk === 'CRITICAL' || h.risk === 'HIGH').length, color: 'var(--red)' },
    { name: 'Medium Risk', value: hotspots.filter(h => h.risk === 'MEDIUM').length, color: 'var(--orange)' },
    { name: 'Low Risk', value: hotspots.filter(h => h.risk === 'LOW').length, color: 'var(--accent)' },
  ]

  const riskTrendData = stats?.riskTrend || []

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div className="section-title">Admin Analytics Dashboard</div>
          <div className="section-sub" style={{ marginTop: 4 }}>
            System telemetry & database risk monitoring console.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" style={{ fontSize: 11, padding: '7px 12px' }} onClick={loadData}>
            <RefreshCw size={12} /> Sync Data
          </button>
          <button className="btn btn-outline" style={{ fontSize: 11, padding: '7px 12px' }}>
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* Sub Navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, padding: '3px', background: 'var(--bg-card)', borderRadius: 10, width: 'fit-content', border: '1px solid var(--border)' }}>
        {SECTIONS.map(s => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            style={{
              fontSize: 12, padding: '6px 14px', borderRadius: 7, cursor: 'pointer',
              fontFamily: 'var(--font-mono)', textTransform: 'capitalize', border: 'none',
              background: activeSection === s ? 'var(--accent)' : 'transparent',
              color: activeSection === s ? '#080c0e' : 'var(--text-secondary)',
              fontWeight: activeSection === s ? 700 : 400,
              transition: 'all 0.2s',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* STAT CARDS */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          {
            label: 'Total Accidents', value: String(totalAccidents),
            sub: 'Database records',
            icon: <AlertTriangle size={16} color="var(--red)" />,
            iconBg: 'rgba(255,77,77,0.12)',
          },
          {
            label: 'Active Hazards', value: String(activeHazards),
            sub: 'Live system monitoring',
            icon: <Activity size={16} color="var(--orange)" />,
            iconBg: 'rgba(255,149,0,0.12)',
          },
          {
            label: 'Registered Users', value: String(totalUsers),
            sub: 'Active accounts',
            icon: <Users size={16} color="var(--blue)" />,
            iconBg: 'rgba(77,184,255,0.12)',
          },
          {
            label: 'Avg Safety Score', value: avgSafetyScore,
            sub: 'System average',
            icon: <Shield size={16} color="var(--accent)" />,
            iconBg: 'rgba(0,229,160,0.12)',
          },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-icon" style={{ background: s.iconBg }}>{s.icon}</div>
            </div>
            <div className="stat-value" style={{ fontSize: 30 }}>{loading ? '...' : s.value}</div>
            <div className="stat-footer" style={{ color: 'var(--text-muted)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid-2" style={{ marginBottom: 20, gap: 20 }}>
        {/* Risk Trends */}
        <div className="chart-area">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            Risk Trends
          </div>
          {riskTrendData.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No telemetry trend data available in database
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={riskTrendData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="high" name="High Risk" fill="var(--red)" />
                <Bar dataKey="medium" name="Medium Risk" fill="var(--orange)" />
                <Bar dataKey="low" name="Low Risk" fill="var(--accent)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Severity Split Donut */}
        <div className="chart-area">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Severity Split</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={severityData} cx={75} cy={75} innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                    {severityData.map((entry, index) => (
                      <Cell key={index} fill={entry.color || 'var(--accent)'} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 }}>{hotspots.length}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>TOTAL</div>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {severityData.map(s => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color || 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{s.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: s.color || 'var(--text-primary)' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hotspot Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700 }}>
          Monitored Hazard Locations ({hotspots.length})
        </div>
        {hotspots.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No hazard locations recorded in database.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Location Name</th>
                <th>Incident Rate</th>
                <th>Risk Level</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {hotspots.map((h, i) => (
                <tr key={h.id || i}>
                  <td style={{ fontWeight: 600 }}>{h.label || h.location || h.name || 'Hazard Location'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{h.rate || h.detail || 'N/A'}</td>
                  <td>
                    <span className={`badge badge-${h.risk === 'CRITICAL' ? 'critical' : h.risk === 'HIGH' ? 'high' : 'medium'}`}>
                      {h.risk || 'HIGH'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{h.confidence ? `${h.confidence}%` : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
