import { useState } from 'react'
import { Users, AlertTriangle, Shield, Activity, TrendingUp, Download, RefreshCw, MoreHorizontal } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts'

const RISK_TREND = [
  { time: '00:00', high: 2, medium: 5, low: 10 },
  { time: '04:00', high: 1, medium: 3, low: 6 },
  { time: '08:00', high: 9, medium: 13, low: 8 },
  { time: '12:00', high: 6, medium: 10, low: 11 },
  { time: '16:00', high: 11, medium: 15, low: 7 },
  { time: '20:00', high: 7, medium: 9, low: 8 },
]

const USER_GROWTH = [
  { month: 'Jan', users: 72000 },
  { month: 'Feb', users: 75000 },
  { month: 'Mar', users: 78000 },
  { month: 'Apr', users: 80000 },
  { month: 'May', users: 82000 },
  { month: 'Jun', users: 85200 },
]

const SEVERITY_DATA = [
  { name: 'High Risk', value: 28, color: 'var(--red)' },
  { name: 'Medium Risk', value: 45, color: 'var(--orange)' },
  { name: 'Low Risk', value: 27, color: 'var(--accent)' },
]

const HOTSPOT_DATA = [
  { name: 'Sitabuldi\nInterchange', rate: '12 / month', risk: 'CRITICAL', confidence: 98.2 },
  { name: 'Wardha Road\nSignal', rate: '8 / month', risk: 'CRITICAL', confidence: 94.5 },
  { name: 'Dharampeth\nSquare', rate: '5 / month', risk: 'HIGH', confidence: 88.1 },
  { name: 'Manish Nagar\nFlyover', rate: '3 / month', risk: 'MEDIUM', confidence: 91.0 },
  { name: 'Besa Road\nJunction', rate: '2 / month', risk: 'MEDIUM', confidence: 82.4 },
]

const MiniBar = ({ data, color }) => (
  <div className="mini-bars">
    {data.map((h, i) => (
      <div key={i} className="mini-bar" style={{ height: `${(h / Math.max(...data)) * 100}%`, background: color }} />
    ))}
  </div>
)

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
  const [trendView, setTrendView] = useState('hourly')
  const [activeSection, setActiveSection] = useState('overview')

  const SECTIONS = ['overview', 'hotspots', 'users', 'alerts', 'reports']

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div className="section-title">Admin Analytics Dashboard</div>
          <div className="section-sub" style={{ marginTop: 4 }}>
            Real-time safety telemetry and risk distribution for Nagpur Intelligent Grid.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" style={{ fontSize: 11, padding: '7px 12px' }}>
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
            label: 'Total Accidents', value: '1,284',
            sub: '↑ 12% from last month', subColor: 'var(--red)',
            icon: <AlertTriangle size={16} color="var(--red)" />,
            iconBg: 'rgba(255,77,77,0.12)',
            bars: [4, 6, 5, 8, 7, 9, 10, 8, 12, 11],
            barColor: 'var(--red)',
          },
          {
            label: 'Active Hazards', value: '42',
            sub: 'Live system monitoring...',
            icon: <Activity size={16} color="var(--orange)" />,
            iconBg: 'rgba(255,149,0,0.12)',
            bars: [3, 5, 4, 6, 5, 7, 4, 8, 5, 6],
            barColor: 'var(--orange)',
          },
          {
            label: 'Registered Users', value: '85.2K',
            sub: '↑ 4.2K new this week', subColor: 'var(--accent)',
            icon: <Users size={16} color="var(--blue)" />,
            iconBg: 'rgba(77,184,255,0.12)',
            bars: [6, 6, 7, 7, 8, 8, 9, 9, 10, 10],
            barColor: 'var(--blue)',
          },
          {
            label: 'Avg Safety Score', value: '78%',
            sub: 'Target: 85% by Q4',
            icon: <Shield size={16} color="var(--accent)" />,
            iconBg: 'rgba(0,229,160,0.12)',
            bars: [6, 7, 7, 8, 7, 8, 7, 8, 8, 8],
            barColor: 'var(--accent)',
          },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-icon" style={{ background: s.iconBg }}>{s.icon}</div>
            </div>
            <div className="stat-value" style={{ fontSize: 30 }}>{s.value}</div>
            <MiniBar data={s.bars} color={s.barColor} />
            <div className="stat-footer" style={{ color: s.subColor || 'var(--text-muted)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid-2" style={{ marginBottom: 20, gap: 20 }}>
        {/* Risk Trends */}
        <div className="chart-area">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>Risk Trends (24h)</div>
            <div className="chart-tabs">
              {['hourly', 'daily'].map(t => (
                <button key={t} className={`chart-tab ${trendView === t ? 'active' : ''}`} onClick={() => setTrendView(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={RISK_TREND} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="high" name="High Risk" stackId="a" fill="var(--red)" opacity={0.85} />
              <Bar dataKey="medium" name="Medium Risk" stackId="a" fill="var(--orange)" opacity={0.85} />
              <Bar dataKey="low" name="Low Risk" stackId="a" fill="var(--accent)" opacity={0.7} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Severity Split Donut */}
        <div className="chart-area">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Severity Split</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={SEVERITY_DATA} cx={75} cy={75} innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                    {SEVERITY_DATA.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 }}>1.2K</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>TOTAL</div>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {SEVERITY_DATA.map(s => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{s.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* User Growth Chart */}
      <div className="chart-area" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>User Growth — 2024</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Registered Nagpur drivers on the grid</div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>+18.3% YTD</span>
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={USER_GROWTH} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="users" name="Users" stroke="var(--accent)" strokeWidth={2} fill="url(#userGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
        {/* Hotspot Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700 }}>
            Top Hazard Locations
          </div>
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
              {HOTSPOT_DATA.map((h, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, whiteSpace: 'pre-line' }}>{h.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{h.rate}</td>
                  <td>
                    <span className={`badge badge-${h.risk === 'CRITICAL' ? 'critical' : h.risk === 'HIGH' ? 'high' : h.risk === 'MEDIUM' ? 'medium' : 'low'}`}>
                      {h.risk === 'CRITICAL' ? '⊙ ' : h.risk === 'HIGH' ? '⚠ ' : 'ℹ '}{h.risk}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{h.confidence}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Nagpur Grid Status */}
        <div className="card">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Nagpur Urban Core</div>
          {/* Mini grid visualization */}
          <div style={{
            width: '100%', aspectRatio: '1', borderRadius: 8,
            background: 'var(--bg-base)',
            backgroundImage: 'linear-gradient(rgba(0,229,160,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,160,0.08) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            position: 'relative', marginBottom: 12, overflow: 'hidden',
            border: '1px solid var(--border)',
          }}>
            {/* Dots on grid */}
            <div style={{ position: 'absolute', top: '30%', left: '25%', width: 10, height: 10, borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 12px var(--red)' }} />
            <div style={{ position: 'absolute', top: '55%', left: '60%', width: 10, height: 10, borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 12px var(--red)' }} />
            <div style={{ position: 'absolute', top: '42%', left: '42%', width: 8, height: 8, borderRadius: '50%', background: 'var(--orange)', boxShadow: '0 0 8px var(--orange)' }} />
            <div style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 10, color: 'var(--text-muted)' }}>Nagpur Urban Core</div>
            <div style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>Active</div>
            <div style={{ position: 'absolute', bottom: 20, right: 8, width: 40, height: 3, background: 'var(--border)', borderRadius: 2 }}>
              <div style={{ width: '80%', height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Grid Nodes', value: '248', ok: true },
              { label: 'Active Sensors', value: '1,892', ok: true },
              { label: 'Offline Nodes', value: '3', ok: false },
              { label: 'Data Latency', value: '42ms', ok: true },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                <span style={{ color: s.ok ? 'var(--text-primary)' : 'var(--red)', fontWeight: 600 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
