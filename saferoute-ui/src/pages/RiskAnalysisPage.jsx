import { useState, useEffect } from 'react'
import { AlertTriangle, Download, RefreshCw, TrendingUp, MapPin, Search } from 'lucide-react'
import { getBlackspots } from '../services/api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null
  return (
    <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.fill || p.color, marginBottom: 2 }}>{p.name}: {p.value}</div>
      ))}
    </div>
  )
}

export default function RiskAnalysisPage() {
  const [blackspots, setBlackspots] = useState([])
  const [loading, setLoading]       = useState(true)
  const [riskFilter, setRiskFilter] = useState('all')
  const [search, setSearch]         = useState('')
  const [sortBy, setSortBy]         = useState('total_accidents')

  const loadData = () => {
    setLoading(true)
    getBlackspots()
      .then(data => { setBlackspots(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setBlackspots([]); setLoading(false) })
  }

  useEffect(() => { loadData() }, [])

  // Stats
  const total     = blackspots.length
  const highCount = blackspots.filter(b => b.risk === 'HIGH').length
  const medCount  = blackspots.filter(b => b.risk === 'MEDIUM').length
  const lowCount  = blackspots.filter(b => b.risk === 'LOW').length
  const totalAcc  = blackspots.reduce((s, b) => s + (b.total_accidents || 0), 0)

  // Filter + sort
  const filtered = blackspots
    .filter(b => {
      if (riskFilter !== 'all' && b.risk !== riskFilter.toUpperCase()) return false
      if (search && !b.location.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0))

  // Bar chart — top 10 locations by accidents
  const barData = [...blackspots]
    .sort((a, b) => b.total_accidents - a.total_accidents)
    .slice(0, 10)
    .map(b => ({ name: b.location.replace(' ', '\n'), accidents: b.total_accidents, risk: b.risk }))

  // Pie chart — risk distribution
  const pieData = [
    { name: 'High Risk',   value: highCount, color: '#ef4444' },
    { name: 'Medium Risk', value: medCount,  color: '#f59e0b' },
    { name: 'Low Risk',    value: lowCount,  color: '#10b981' },
  ]

  // Road type breakdown
  const roadTypeMap = {}
  blackspots.forEach(b => {
    roadTypeMap[b.road_type] = (roadTypeMap[b.road_type] || 0) + b.total_accidents
  })
  const roadData = Object.entries(roadTypeMap)
    .map(([name, accidents]) => ({ name, accidents }))
    .sort((a, b) => b.accidents - a.accidents)

  const exportCSV = () => {
    const headers = ['Location', 'Risk Level', 'Total Accidents', 'Avg Accidents', 'Road Type', 'Records', 'Lat', 'Lng']
    const rows = blackspots.map(b => [b.location, b.risk, b.total_accidents, b.avg_accidents, b.road_type, b.records, b.lat, b.lng])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'nagpur_blackspots.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const riskColor = (r) => r === 'HIGH' ? '#ef4444' : r === 'MEDIUM' ? '#f59e0b' : '#10b981'

  return (
    <div className="page">
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="section-title">Risk Analysis Dashboard</div>
          <div className="section-sub">Nagpur accident blackspot analytics — {totalAcc.toLocaleString()} total accidents across {total} zones</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" style={{ fontSize: 11, padding: '7px 12px' }} onClick={loadData}>
            <RefreshCw size={12} /> Refresh
          </button>
          <button className="btn btn-outline" style={{ fontSize: 11, padding: '7px 12px' }} onClick={exportCSV}>
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Accident Zones',   value: total,        sub: 'Unique locations in dataset', color: '#ef4444',  icon: '🚨' },
          { label: 'High Risk Zones',  value: highCount,    sub: 'Frequent accident locations',  color: '#f59e0b',  icon: '⚠️' },
          { label: 'Total Accidents',  value: totalAcc.toLocaleString(), sub: 'From database records', color: '#3b82f6', icon: '📊' },
          { label: 'Safe Zones',       value: lowCount,     sub: 'Low-accident locations',       color: '#10b981',  icon: '🛡' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="stat-label">{s.label}</div>
              <div style={{ fontSize: 20 }}>{s.icon}</div>
            </div>
            <div className="stat-value" style={{ color: s.color, fontSize: 28 }}>
              {loading ? '…' : s.value}
            </div>
            <div className="stat-footer">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid-2" style={{ marginBottom: 20, gap: 20 }}>

        {/* Bar chart — top 10 accident locations */}
        <div className="chart-area">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
            Top 10 Accident Locations
          </div>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="accidents" name="Total Accidents" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={riskColor(entry.risk)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {loading ? 'Loading data…' : 'No data available'}
            </div>
          )}
        </div>

        {/* Risk Distribution Donut + Road Types */}
        <div className="chart-area">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Risk Distribution</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={pieData} cx={75} cy={75} innerRadius={48} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 }}>{total}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>ZONES</div>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pieData.map(s => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{s.name}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{loading ? '…' : s.value}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>By Road Type (accidents)</div>
                {roadData.slice(0, 4).map(r => (
                  <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{r.name}</span>
                    <span style={{ fontWeight: 600 }}>{r.accidents}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Blackspot Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Table Toolbar */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700 }}>
            All Accident Blackspots ({filtered.length})
          </div>
          {/* Search */}
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search location…"
              className="input"
              style={{ paddingLeft: 30, paddingRight: 10, fontSize: 12, height: 34, width: 200 }}
            />
          </div>
          {/* Risk filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', 'HIGH', 'MEDIUM', 'LOW'].map(r => (
              <button key={r} onClick={() => setRiskFilter(r)} style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                border: riskFilter === r ? `1px solid ${r === 'HIGH' ? '#ef4444' : r === 'MEDIUM' ? '#f59e0b' : r === 'LOW' ? '#10b981' : 'var(--accent)'}` : '1px solid var(--border)',
                background: riskFilter === r ? 'var(--bg-card2)' : 'var(--bg-base)',
                color: riskFilter === r ? (r === 'HIGH' ? '#ef4444' : r === 'MEDIUM' ? '#f59e0b' : r === 'LOW' ? '#10b981' : 'var(--accent)') : 'var(--text-muted)',
              }}>
                {r === 'all' ? 'All' : r}
              </button>
            ))}
          </div>
          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="input"
            style={{ width: 160, fontSize: 12, height: 34 }}
          >
            <option value="total_accidents">Sort: Most Accidents</option>
            <option value="avg_accidents">Sort: Avg Accidents</option>
            <option value="records">Sort: Records Count</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading blackspot data from ML service…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <AlertTriangle size={32} color="var(--text-muted)" style={{ opacity: 0.4, marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>No records found</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Try adjusting the filter or search term</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
            <table className="data-table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Location</th>
                  <th>Risk Level</th>
                  <th>Total Accidents</th>
                  <th>Avg / Record</th>
                  <th>Road Type</th>
                  <th>Dataset Records</th>
                  <th>Coordinates</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => (
                  <tr key={b.id}>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MapPin size={12} color={riskColor(b.risk)} />
                        <span style={{ fontWeight: 600 }}>{b.location}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                        background: `${riskColor(b.risk)}15`,
                        border: `1px solid ${riskColor(b.risk)}44`,
                        color: riskColor(b.risk),
                      }}>
                        ● {b.risk}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: riskColor(b.risk) }}>
                        {b.total_accidents}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{b.avg_accidents}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{b.road_type}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{b.records}</td>
                    <td style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {b.lat.toFixed(4)}, {b.lng.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
