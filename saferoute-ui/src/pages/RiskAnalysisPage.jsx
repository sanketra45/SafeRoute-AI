import { useState } from 'react'
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Filter, Download, RefreshCw } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'

const LOCATIONS = [
  { name: 'Sitabuldi Interchange', rate: '12 / month', risk: 'CRITICAL', confidence: 98.2, trend: 'up', score: 88 },
  { name: 'Wardha Road Signal', rate: '8 / month', risk: 'CRITICAL', confidence: 94.5, trend: 'up', score: 76 },
  { name: 'Dharampeth Square', rate: '5 / month', risk: 'HIGH', confidence: 88.1, trend: 'down', score: 65 },
  { name: 'Manish Nagar Flyover', rate: '3 / month', risk: 'MEDIUM', confidence: 91.0, trend: 'flat', score: 55 },
  { name: 'Besa Road Junction', rate: '2 / month', risk: 'MEDIUM', confidence: 82.4, trend: 'down', score: 48 },
  { name: 'Civil Lines Chowk', rate: '1 / month', risk: 'LOW', confidence: 77.3, trend: 'flat', score: 22 },
  { name: 'Hingna Road', rate: '0 / month', risk: 'LOW', confidence: 95.6, trend: 'down', score: 10 },
]

const HOURLY_DATA = [
  { time: '00:00', high: 2, medium: 4, low: 8 },
  { time: '04:00', high: 1, medium: 2, low: 5 },
  { time: '08:00', high: 8, medium: 12, low: 6 },
  { time: '12:00', high: 5, medium: 9, low: 10 },
  { time: '16:00', high: 9, medium: 14, low: 7 },
  { time: '20:00', high: 6, medium: 8, low: 9 },
  { time: '23:00', high: 3, medium: 5, low: 7 },
]

const RADAR_DATA = [
  { axis: 'Congestion', value: 82 },
  { axis: 'Accidents', value: 65 },
  { axis: 'Weather', value: 40 },
  { axis: 'Visibility', value: 55 },
  { axis: 'Road Cond.', value: 71 },
  { axis: 'Night Risk', value: 60 },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 3 }}>{p.name}: {p.value}</div>
      ))}
    </div>
  )
}

export default function RiskAnalysisPage() {
  const [chartView, setChartView] = useState('hourly')
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? LOCATIONS : LOCATIONS.filter(l => l.risk.toLowerCase() === filter)

  return (
    <div className="page">
      <div className="section-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="section-title">Risk Analysis</div>
          <div className="section-sub">AI hazard detection across Nagpur Intelligent Grid</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" style={{ padding: '7px 12px', fontSize: 11 }}>
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
          { label: 'Total Incidents', value: '1,284', sub: '+12% from last month', color: 'var(--red)', icon: '🚨' },
          { label: 'Active Hazards', value: '42', sub: 'Live system monitoring', color: 'var(--orange)', icon: '⚠️' },
          { label: 'Avg Confidence', value: '89.6%', sub: 'AI model accuracy', color: 'var(--accent)', icon: '🧠' },
          { label: 'Hotspots', value: '7', sub: 'Critical zones active', color: 'var(--blue)', icon: '📍' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-label">{s.label}</div>
              <span style={{ fontSize: 18 }}>{s.icon}</span>
            </div>
            <div className="stat-value" style={{ color: s.color, fontSize: 28 }}>{s.value}</div>
            <div className="stat-footer">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
        {/* Risk Trend Chart */}
        <div className="chart-area">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>Risk Trends (24h)</div>
            <div className="chart-tabs">
              {['hourly', 'daily'].map(t => (
                <button key={t} className={`chart-tab ${chartView === t ? 'active' : ''}`} onClick={() => setChartView(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={HOURLY_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="high" name="High Risk" stackId="a" fill="var(--red)" opacity={0.8} radius={[0,0,0,0]} />
              <Bar dataKey="medium" name="Medium Risk" stackId="a" fill="var(--orange)" opacity={0.8} />
              <Bar dataKey="low" name="Low Risk" stackId="a" fill="var(--accent)" opacity={0.6} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar Chart */}
        <div className="chart-area">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Risk Factor Radar</div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={RADAR_DATA}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
              <Radar dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.15} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hotspot Table */}
      <div className="card">
        <div className="section-header">
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Hotspot Analysis</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>All monitored intersections with AI risk scoring</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'critical', 'high', 'medium', 'low'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`btn ${filter === f ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '5px 10px', fontSize: 11, textTransform: 'capitalize' }}>{f}</button>
            ))}
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Location Name</th>
              <th>Incident Rate</th>
              <th>Risk Level</th>
              <th>Confidence</th>
              <th>Score</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((loc, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{loc.name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{loc.rate}</td>
                <td>
                  <span className={`badge badge-${loc.risk === 'CRITICAL' ? 'critical' : loc.risk === 'HIGH' ? 'high' : loc.risk === 'MEDIUM' ? 'medium' : 'low'}`}>
                    {loc.risk === 'CRITICAL' && '⊙ '}{loc.risk === 'HIGH' && '⚠ '}{loc.risk}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{loc.confidence}%</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 60, height: 4, background: 'var(--border)', borderRadius: 2 }}>
                      <div style={{ width: `${loc.score}%`, height: '100%', background: loc.score >= 70 ? 'var(--red)' : loc.score >= 40 ? 'var(--orange)' : 'var(--accent)', borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{loc.score}</span>
                  </div>
                </td>
                <td>
                  {loc.trend === 'up' ? <TrendingUp size={14} color="var(--red)" /> : loc.trend === 'down' ? <TrendingDown size={14} color="var(--accent)" /> : <Minus size={14} color="var(--text-muted)" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
