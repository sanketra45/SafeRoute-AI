import { useState } from 'react'
import { Share2, TrendingUp, TrendingDown, Minus, Search, Trophy, Medal } from 'lucide-react'

const DRIVERS = [
  { rank: 1, name: 'Arjun Mehra', score: 99, grade: 'A+', trend: 'up', badge: '🏆', isUser: false },
  { rank: 2, name: 'Sana Kapoor', score: 98, grade: 'A+', trend: 'flat', badge: '🥈', isUser: false },
  { rank: 3, name: 'Rohan Deshmukh', score: 97, grade: 'A+', trend: 'down', badge: '🥉', isUser: false },
  { rank: 4, name: 'Priya Patel', score: 95, grade: 'A', trend: 'up', badge: null, isUser: false },
  { rank: 5, name: 'Vikram Sharma', score: 93, grade: 'A', trend: 'up', badge: null, isUser: false },
  { rank: 14, name: 'Admin (You)', score: 94, grade: 'A', trend: 'up', badge: null, isUser: true },
  { rank: 102, name: 'Priya Sharma', score: 84, grade: 'B+', trend: 'up', badge: null, isUser: false },
  { rank: 540, name: 'Vikram Singh', score: 72, grade: 'B-', trend: 'down', badge: null, isUser: false },
]

const TOP3 = DRIVERS.slice(0, 3)
const YOU = DRIVERS.find(d => d.isUser)

export default function LeaderboardPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = DRIVERS.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  const getScoreColor = (score) => {
    if (score >= 95) return '#ffd700'
    if (score >= 85) return 'var(--accent)'
    if (score >= 70) return 'var(--orange)'
    return 'var(--red)'
  }

  const getScoreClass = (score) => {
    if (score >= 95) return 'score-99'
    if (score >= 85) return 'score-high'
    if (score >= 70) return 'score-mid'
    return 'score-low'
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trophy size={20} color="var(--accent)" />
            Leaderboard
          </div>
          <div className="section-sub" style={{ marginTop: 6 }}>
            Your performance is calculated based on safe driving behavior and hazard avoidance.
          </div>
        </div>
        <button className="btn btn-primary" style={{ gap: 8 }}>
          <Share2 size={14} /> Share Stats
        </button>
      </div>

      {/* Your Rank Banner */}
      {YOU && (
        <div style={{
          background: 'rgba(0,229,160,0.06)',
          border: '1px solid rgba(0,229,160,0.25)',
          borderRadius: 12, padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 16,
          marginBottom: 24,
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--accent)', minWidth: 40 }}>
            #{YOU.rank}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Your Current Ranking</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Top 2% of all Nagpur drivers • Keep it up!</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{YOU.score}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>SCORE</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{YOU.grade}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>GRADE</div>
            </div>
            <TrendingUp size={20} color="var(--accent)" />
          </div>
        </div>
      )}

      {/* Top 3 Podium */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>
        {[TOP3[1], TOP3[0], TOP3[2]].map((d, i) => {
          const sizes = [48, 64, 48]
          const heights = ['80px', '100px', '72px']
          return (
            <div key={d.rank} className="card" style={{
              textAlign: 'center', padding: '20px 16px',
              background: d.rank === 1 ? 'rgba(255,215,0,0.04)' : 'var(--bg-card)',
              border: d.rank === 1 ? '1px solid rgba(255,215,0,0.2)' : '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{d.badge}</div>
              <div style={{
                width: sizes[i], height: sizes[i], borderRadius: '50%', margin: '0 auto 10px',
                background: 'linear-gradient(135deg, #1a3a3a, #0d2525)',
                border: `2px solid ${d.rank === 1 ? '#ffd700' : d.rank === 2 ? '#c0c0c0' : '#cd7f32'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 800, color: d.rank === 1 ? '#ffd700' : 'var(--accent)',
              }}>
                {d.name[0]}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{d.name}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: getScoreColor(d.score) }}>{d.score}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Rank #{d.rank}</div>
            </div>
          )
        })}
      </div>

      {/* Full Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600 }}>
            Nagpur Intelligent Grid
          </div>
          <div className="search-wrap">
            <Search size={13} className="search-icon" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search driver..."
            />
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Driver</th>
              <th>Score</th>
              <th>Grade</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => (
              <tr key={i} className={d.isUser ? 'highlight-row' : ''}>
                <td>
                  <span className={`lb-rank ${d.rank === 1 ? 'lb-rank-1' : d.rank === 2 ? 'lb-rank-2' : d.rank === 3 ? 'lb-rank-3' : ''}`}>
                    #{d.rank} {d.badge || ''}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="driver-avatar" style={{
                      border: `1.5px solid ${d.isUser ? 'var(--accent)' : 'var(--border-bright)'}`,
                      boxShadow: d.isUser ? '0 0 10px var(--accent-glow)' : 'none',
                    }}>
                      {d.name[0]}
                    </div>
                    <span style={{ color: d.isUser ? 'var(--accent)' : 'var(--text-primary)', fontWeight: d.isUser ? 700 : 400 }}>
                      {d.name}
                    </span>
                  </div>
                </td>
                <td>
                  <div className={`lb-score-pill ${getScoreClass(d.score)}`}>{d.score}</div>
                </td>
                <td>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: getScoreColor(d.score), fontSize: 15 }}>
                    {d.grade}
                  </span>
                </td>
                <td>
                  {d.trend === 'up' ? <TrendingUp size={16} className="trend-up" /> :
                    d.trend === 'down' ? <TrendingDown size={16} className="trend-down" /> :
                      <Minus size={16} className="trend-flat" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Showing 1,244 Drivers</span>
          <div className="pagination">
            <button className="page-btn">‹</button>
            {[1, 2, 3].map(p => (
              <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="page-btn">›</button>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="grid-3" style={{ marginTop: 20, gap: 14 }}>
        {[
          { label: 'Safe Routes Taken', value: '47', sub: 'Last 30 days', icon: '🛡' },
          { label: 'Hazards Avoided', value: '12', sub: 'Incidents bypassed', icon: '⚡' },
          { label: 'Driving Streak', value: '14 days', sub: 'No incidents', icon: '🔥' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{s.value}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, marginTop: 4 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
