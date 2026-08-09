import { useState, useEffect } from 'react'
import { Share2, TrendingUp, TrendingDown, Minus, Search, Trophy } from 'lucide-react'
import { getLeaderboard } from '../services/api'

export default function LeaderboardPage() {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let isMounted = true
    getLeaderboard()
      .then((data) => {
        if (isMounted) {
          setDrivers(Array.isArray(data) ? data : [])
          setLoading(false)
        }
      })
      .catch(() => {
        if (isMounted) {
          setDrivers([])
          setLoading(false)
        }
      })
    return () => { isMounted = false }
  }, [])

  const filtered = drivers.filter(d =>
    d.name?.toLowerCase().includes(search.toLowerCase())
  )

  const top3 = drivers.slice(0, 3)
  const you = drivers.find(d => d.isUser)

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
      {you && (
        <div style={{
          background: 'rgba(0,229,160,0.06)',
          border: '1px solid rgba(0,229,160,0.25)',
          borderRadius: 12, padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 16,
          marginBottom: 24,
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--accent)', minWidth: 40 }}>
            #{you.rank}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Your Current Ranking</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Keep driving safely!</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{you.score}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>SCORE</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{you.grade || 'N/A'}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>GRADE</div>
            </div>
            <TrendingUp size={20} color="var(--accent)" />
          </div>
        </div>
      )}

      {/* Top 3 Podium */}
      {top3.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>
          {top3.map((d, i) => {
            const sizes = [64, 48, 48]
            return (
              <div key={d.rank || i} className="card" style={{
                textAlign: 'center', padding: '20px 16px',
                background: i === 0 ? 'rgba(255,215,0,0.04)' : 'var(--bg-card)',
                border: i === 0 ? '1px solid rgba(255,215,0,0.2)' : '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{i === 0 ? '🏆' : i === 1 ? '🥈' : '🥉'}</div>
                <div style={{
                  width: sizes[i], height: sizes[i], borderRadius: '50%', margin: '0 auto 10px',
                  background: 'linear-gradient(135deg, #1a3a3a, #0d2525)',
                  border: `2px solid ${i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : '#cd7f32'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, color: i === 0 ? '#ffd700' : 'var(--accent)',
                }}>
                  {d.name ? d.name[0] : 'U'}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{d.name}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: getScoreColor(d.score) }}>{d.score}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Rank #{d.rank || i + 1}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Table / Empty State */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600 }}>
            Driver Safety Leaderboard
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

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading leaderboard data...
          </div>
        ) : drivers.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <Trophy size={36} color="var(--text-muted)" style={{ marginBottom: 12, opacity: 0.5 }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              No Database Records Found
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
              No drivers are currently recorded in the database. Drive safely and register trips to earn scores!
            </div>
          </div>
        ) : (
          <>
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
                        #{d.rank || i + 1}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="driver-avatar" style={{
                          border: `1.5px solid ${d.isUser ? 'var(--accent)' : 'var(--border-bright)'}`,
                          boxShadow: d.isUser ? '0 0 10px var(--accent-glow)' : 'none',
                        }}>
                          {d.name ? d.name[0] : 'U'}
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
                        {d.grade || 'N/A'}
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
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Showing {filtered.length} Drivers</span>
              <div className="pagination">
                <button className="page-btn">‹</button>
                <button className="page-btn active">1</button>
                <button className="page-btn">›</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
