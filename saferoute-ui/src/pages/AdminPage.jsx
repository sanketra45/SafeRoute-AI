import { useState, useEffect, useCallback } from 'react'
import {
  Users, AlertTriangle, Shield, Activity, RefreshCw,
  Plus, Edit2, Trash2, CheckCircle, XCircle, MapPin,
  Search, ChevronDown, X, Loader, BarChart2
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import {
  getAdminStats, adminGetUsers, adminActivateUser, adminDeactivateUser, adminDeleteUser,
  adminGetBlackspots, adminAddBlackspot, adminUpdateBlackspot, adminDeleteBlackspot,
  adminGetHazards, adminAddHazard, adminUpdateHazard, adminDeleteHazard, adminResolveHazard,
} from '../services/api'
import { useAuth } from '../context/AuthContext'

// ── Confirm Dialog ───────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 28, maxWidth: 380, width: '90%',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          Confirm Action
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={onCancel}>Cancel</button>
          <button
            className="btn"
            style={{ fontSize: 12, background: 'var(--red)', color: 'white', border: 'none' }}
            onClick={onConfirm}
          >
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Toast ────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 10000,
      background: type === 'error' ? 'rgba(255,77,77,0.15)' : 'rgba(0,229,160,0.12)',
      border: `1px solid ${type === 'error' ? 'rgba(255,77,77,0.4)' : 'rgba(0,229,160,0.3)'}`,
      color: type === 'error' ? 'var(--red)' : 'var(--accent)',
      borderRadius: 10, padding: '12px 18px', fontSize: 13, fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      animation: 'fadeIn 0.25s ease',
    }}>
      {type === 'error' ? <XCircle size={15} /> : <CheckCircle size={15} />}
      {message}
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8, opacity: 0.6 }}>
        <X size={13} />
      </button>
    </div>
  )
}

// ── Field Row for forms ───────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  background: 'var(--bg-base)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)',
  outline: 'none', width: '100%', boxSizing: 'border-box',
}

const selectStyle = { ...inputStyle }

// ── SECTIONS ─────────────────────────────────────────────────
const SECTIONS = ['overview', 'users', 'blackspots', 'hazards']

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

// ═══════════════════════════════════════════════════════════════
export default function AdminPage() {
  const { user: currentUser } = useAuth()
  const [activeSection, setActiveSection] = useState('overview')
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const showToast = (message, type = 'success') => setToast({ message, type })

  // ── Overview stats ──────────────────────────────────────────
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)

  const loadStats = useCallback(() => {
    setStatsLoading(true)
    getAdminStats().then(setStats).catch(() => setStats(null)).finally(() => setStatsLoading(false))
  }, [])

  useEffect(() => { if (activeSection === 'overview') loadStats() }, [activeSection, loadStats])

  // ── Users ───────────────────────────────────────────────────
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')

  const loadUsers = useCallback(() => {
    setUsersLoading(true)
    adminGetUsers().then(u => setUsers(Array.isArray(u) ? u : [])).catch(() => setUsers([])).finally(() => setUsersLoading(false))
  }, [])

  useEffect(() => { if (activeSection === 'users') loadUsers() }, [activeSection, loadUsers])

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  )

  const handleToggleUser = (u) => {
    const fn = u.active ? adminDeactivateUser : adminActivateUser
    fn(u.id).then(() => { showToast(`User ${u.active ? 'deactivated' : 'activated'}`); loadUsers() })
      .catch(err => showToast(err.message, 'error'))
  }

  const handleDeleteUser = (u) => {
    setConfirm({
      message: `Delete user "${u.name}" (${u.email})? This cannot be undone.`,
      onConfirm: () => {
        setConfirm(null)
        adminDeleteUser(u.id).then(() => { showToast('User deleted'); loadUsers() })
          .catch(err => showToast(err.message, 'error'))
      },
      onCancel: () => setConfirm(null),
    })
  }

  // ── Blackspots ──────────────────────────────────────────────
  const [blackspots, setBlackspots] = useState([])
  const [bsLoading, setBsLoading] = useState(false)
  const [bsForm, setBsForm] = useState(null)  // null = closed, {} = new, {id,...} = edit
  const [bsFormData, setBsFormData] = useState({})

  const loadBlackspots = useCallback(() => {
    setBsLoading(true)
    adminGetBlackspots().then(d => setBlackspots(Array.isArray(d) ? d : [])).catch(() => setBlackspots([])).finally(() => setBsLoading(false))
  }, [])

  useEffect(() => { if (activeSection === 'blackspots') loadBlackspots() }, [activeSection, loadBlackspots])

  const openBsForm = (bs = null) => {
    setBsForm(bs ? bs : {})
    setBsFormData(bs ? {
      latitude: bs.latitude, longitude: bs.longitude, severity: bs.severity,
      locationName: bs.locationName, timeOfDay: bs.timeOfDay,
      weatherCondition: bs.weatherCondition, roadType: bs.roadType,
      trafficDensity: bs.trafficDensity, historicalAccidentCount: bs.historicalAccidentCount,
    } : { severity: 'HIGH', timeOfDay: 'DAY', weatherCondition: 'CLEAR', roadType: 'MAIN_ROAD', trafficDensity: 'MEDIUM', historicalAccidentCount: 1 })
  }

  const saveBs = () => {
    const isNew = !bsForm?.id
    const fn = isNew ? adminAddBlackspot(bsFormData) : adminUpdateBlackspot(bsForm.id, bsFormData)
    fn.then(() => { showToast(isNew ? 'Blackspot added' : 'Blackspot updated'); setBsForm(null); loadBlackspots() })
      .catch(err => showToast(err.message, 'error'))
  }

  const deleteBs = (bs) => {
    setConfirm({
      message: `Delete blackspot "${bs.locationName}"?`,
      onConfirm: () => {
        setConfirm(null)
        adminDeleteBlackspot(bs.id).then(() => { showToast('Blackspot deleted'); loadBlackspots() })
          .catch(err => showToast(err.message, 'error'))
      },
      onCancel: () => setConfirm(null),
    })
  }

  // ── Hazards ─────────────────────────────────────────────────
  const [hazards, setHazards] = useState([])
  const [hzLoading, setHzLoading] = useState(false)
  const [hzForm, setHzForm] = useState(null)
  const [hzFormData, setHzFormData] = useState({})

  const loadHazards = useCallback(() => {
    setHzLoading(true)
    adminGetHazards().then(d => setHazards(Array.isArray(d) ? d : [])).catch(() => setHazards([])).finally(() => setHzLoading(false))
  }, [])

  useEffect(() => { if (activeSection === 'hazards') loadHazards() }, [activeSection, loadHazards])

  const openHzForm = (hz = null) => {
    setHzForm(hz ? hz : {})
    setHzFormData(hz ? {
      latitude: hz.latitude, longitude: hz.longitude,
      hazardType: hz.hazardType, description: hz.description, status: hz.status,
    } : { hazardType: 'POTHOLE', description: '', status: 'ACTIVE' })
  }

  const saveHz = () => {
    const isNew = !hzForm?.id
    const fn = isNew ? adminAddHazard(hzFormData) : adminUpdateHazard(hzForm.id, hzFormData)
    fn.then(() => { showToast(isNew ? 'Hazard added' : 'Hazard updated'); setHzForm(null); loadHazards() })
      .catch(err => showToast(err.message, 'error'))
  }

  const deleteHz = (hz) => {
    setConfirm({
      message: `Delete hazard at (${hz.latitude?.toFixed(4)}, ${hz.longitude?.toFixed(4)})?`,
      onConfirm: () => {
        setConfirm(null)
        adminDeleteHazard(hz.id).then(() => { showToast('Hazard deleted'); loadHazards() })
          .catch(err => showToast(err.message, 'error'))
      },
      onCancel: () => setConfirm(null),
    })
  }

  const resolveHz = (hz) => {
    adminResolveHazard(hz.id).then(() => { showToast('Hazard resolved'); loadHazards() })
      .catch(err => showToast(err.message, 'error'))
  }

  // ── Overview charts ─────────────────────────────────────────
  const severityData = stats?.severityCounts?.map(s => ({
    name: s.severity, value: s.count,
    color: s.severity === 'HIGH' ? 'var(--red)' : s.severity === 'MEDIUM' ? 'var(--orange)' : 'var(--accent)',
  })) || []

  return (
    <div className="page">
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div className="section-title">Admin Control Panel</div>
          <div className="section-sub" style={{ marginTop: 4 }}>Manage users, blackspots, and hazards securely.</div>
        </div>
        <button className="btn btn-outline" style={{ fontSize: 11, padding: '7px 12px' }}
          onClick={() => { if (activeSection === 'overview') loadStats(); if (activeSection === 'users') loadUsers(); if (activeSection === 'blackspots') loadBlackspots(); if (activeSection === 'hazards') loadHazards() }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Tab Nav */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, padding: '3px', background: 'var(--bg-card)', borderRadius: 10, width: 'fit-content', border: '1px solid var(--border)' }}>
        {SECTIONS.map(s => (
          <button key={s} onClick={() => setActiveSection(s)} style={{
            fontSize: 12, padding: '6px 16px', borderRadius: 7, cursor: 'pointer',
            fontFamily: 'var(--font-mono)', textTransform: 'capitalize', border: 'none',
            background: activeSection === s ? 'var(--accent)' : 'transparent',
            color: activeSection === s ? '#080c0e' : 'var(--text-secondary)',
            fontWeight: activeSection === s ? 700 : 400, transition: 'all 0.2s',
          }}>{s}</button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeSection === 'overview' && (
        <div>
          <div className="grid-4" style={{ marginBottom: 20 }}>
            {[
              { label: 'Total Accidents', value: stats?.totalAccidents ?? 0, icon: <AlertTriangle size={16} color="var(--red)" />, iconBg: 'rgba(255,77,77,0.12)' },
              { label: 'Active Hazards', value: stats?.activeHazards ?? 0, icon: <Activity size={16} color="var(--orange)" />, iconBg: 'rgba(255,149,0,0.12)' },
              { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: <Users size={16} color="var(--blue)" />, iconBg: 'rgba(77,184,255,0.12)' },
              { label: 'Total Hazards', value: stats?.totalHazards ?? 0, icon: <Shield size={16} color="var(--accent)" />, iconBg: 'rgba(0,229,160,0.12)' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-icon" style={{ background: s.iconBg }}>{s.icon}</div>
                </div>
                <div className="stat-value" style={{ fontSize: 30 }}>{statsLoading ? '...' : s.value}</div>
              </div>
            ))}
          </div>

          {severityData.length > 0 && (
            <div className="grid-2" style={{ gap: 20 }}>
              <div className="chart-area">
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Blackspot Severity Split</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={severityData} cx={75} cy={75} innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                        {severityData.map((entry, i) => <Cell key={i} fill={entry.color || 'var(--accent)'} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {severityData.map(s => (
                      <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color || 'var(--accent)' }} />
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{s.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: s.color || 'var(--text-primary)' }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="chart-area">
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Top Blackspots</div>
                {(stats?.topBlackspots || []).slice(0, 5).map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', minWidth: 20 }}>#{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{b.locationName || 'Unknown'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{b.accidentCount} accidents</div>
                    </div>
                  </div>
                ))}
                {!stats?.topBlackspots?.length && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 16, textAlign: 'center' }}>No data available</div>}
              </div>
            </div>
          )}
          {!stats && !statsLoading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Could not load stats. Ensure backend is running.
            </div>
          )}
        </div>
      )}

      {/* ── USERS ── */}
      {activeSection === 'users' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div className="search-wrap" style={{ flex: 1 }}>
              <Search size={13} className="search-icon" />
              <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search by name or email…" />
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700 }}>
              Users ({filteredUsers.length})
            </div>
            {usersLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {users.length === 0 ? 'No users found. Ensure backend is running.' : 'No matching users.'}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{u.email}</td>
                      <td>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                          background: u.role === 'ROLE_ADMIN' ? 'rgba(255,149,0,0.15)' : 'rgba(77,184,255,0.12)',
                          color: u.role === 'ROLE_ADMIN' ? 'var(--orange)' : 'var(--blue)',
                        }}>
                          {u.role === 'ROLE_ADMIN' ? 'ADMIN' : 'USER'}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                          background: u.active ? 'rgba(0,229,160,0.12)' : 'rgba(255,77,77,0.12)',
                          color: u.active ? 'var(--accent)' : 'var(--red)',
                        }}>
                          {u.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            title={u.active ? 'Deactivate' : 'Activate'}
                            onClick={() => handleToggleUser(u)}
                            style={{
                              padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: 'none',
                              background: u.active ? 'rgba(255,149,0,0.15)' : 'rgba(0,229,160,0.15)',
                              color: u.active ? 'var(--orange)' : 'var(--accent)',
                            }}
                          >
                            {u.active ? <XCircle size={12} /> : <CheckCircle size={12} />}
                          </button>
                          <button
                            title="Delete"
                            onClick={() => handleDeleteUser(u)}
                            disabled={u.email === currentUser?.email}
                            style={{
                              padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: 'none',
                              background: 'rgba(255,77,77,0.12)', color: 'var(--red)',
                              opacity: u.email === currentUser?.email ? 0.4 : 1,
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── BLACKSPOTS ── */}
      {activeSection === 'blackspots' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button className="btn btn-primary" style={{ fontSize: 11, padding: '7px 14px' }} onClick={() => openBsForm()}>
              <Plus size={12} /> Add Blackspot
            </button>
          </div>

          {/* Form Modal */}
          {bsForm !== null && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: 480, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
                  {bsForm.id ? 'Edit Blackspot' : 'Add New Blackspot'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Latitude *">
                    <input style={inputStyle} type="number" step="0.0001" value={bsFormData.latitude ?? ''} onChange={e => setBsFormData(p => ({ ...p, latitude: e.target.value }))} placeholder="e.g. 21.1458" />
                  </Field>
                  <Field label="Longitude *">
                    <input style={inputStyle} type="number" step="0.0001" value={bsFormData.longitude ?? ''} onChange={e => setBsFormData(p => ({ ...p, longitude: e.target.value }))} placeholder="e.g. 79.0882" />
                  </Field>
                  <Field label="Location Name">
                    <input style={inputStyle} value={bsFormData.locationName ?? ''} onChange={e => setBsFormData(p => ({ ...p, locationName: e.target.value }))} placeholder="e.g. Sitabuldi Overpass" />
                  </Field>
                  <Field label="Severity">
                    <select style={selectStyle} value={bsFormData.severity ?? 'HIGH'} onChange={e => setBsFormData(p => ({ ...p, severity: e.target.value }))}>
                      {['HIGH', 'MEDIUM', 'LOW'].map(v => <option key={v}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="Time of Day">
                    <select style={selectStyle} value={bsFormData.timeOfDay ?? 'DAY'} onChange={e => setBsFormData(p => ({ ...p, timeOfDay: e.target.value }))}>
                      {['DAY', 'MORNING_PEAK', 'EVENING_PEAK', 'NIGHT'].map(v => <option key={v}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="Weather">
                    <select style={selectStyle} value={bsFormData.weatherCondition ?? 'CLEAR'} onChange={e => setBsFormData(p => ({ ...p, weatherCondition: e.target.value }))}>
                      {['CLEAR', 'RAIN', 'FOG', 'CLOUDY', 'HAZE'].map(v => <option key={v}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="Road Type">
                    <select style={selectStyle} value={bsFormData.roadType ?? 'MAIN_ROAD'} onChange={e => setBsFormData(p => ({ ...p, roadType: e.target.value }))}>
                      {['MAIN_ROAD', 'HIGHWAY', 'JUNCTION', 'FLYOVER', 'RING_ROAD', 'URBAN'].map(v => <option key={v}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="Traffic Density">
                    <select style={selectStyle} value={bsFormData.trafficDensity ?? 'MEDIUM'} onChange={e => setBsFormData(p => ({ ...p, trafficDensity: e.target.value }))}>
                      {['LOW', 'MEDIUM', 'HIGH'].map(v => <option key={v}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="Accident Count">
                    <input style={inputStyle} type="number" min="1" value={bsFormData.historicalAccidentCount ?? 1} onChange={e => setBsFormData(p => ({ ...p, historicalAccidentCount: parseInt(e.target.value) || 1 }))} />
                  </Field>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => setBsForm(null)}>Cancel</button>
                  <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={saveBs}>
                    {bsForm.id ? 'Update' : 'Add Blackspot'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700 }}>
              Accident Blackspots ({blackspots.length})
            </div>
            {bsLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}><Loader size={20} /></div>
            ) : blackspots.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No blackspots found.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Location</th><th>Lat/Lng</th><th>Severity</th><th>Accidents</th><th>Road Type</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {blackspots.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>{b.locationName || 'Unknown'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {b.latitude?.toFixed(4)}, {b.longitude?.toFixed(4)}
                      </td>
                      <td>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                          background: b.severity === 'HIGH' ? 'rgba(255,77,77,0.12)' : b.severity === 'MEDIUM' ? 'rgba(255,149,0,0.12)' : 'rgba(0,229,160,0.12)',
                          color: b.severity === 'HIGH' ? 'var(--red)' : b.severity === 'MEDIUM' ? 'var(--orange)' : 'var(--accent)',
                        }}>{b.severity}</span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{b.historicalAccidentCount}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{b.roadType}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button title="Edit" onClick={() => openBsForm(b)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: 'none', background: 'rgba(77,184,255,0.12)', color: 'var(--blue)' }}>
                            <Edit2 size={12} />
                          </button>
                          <button title="Delete" onClick={() => deleteBs(b)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: 'none', background: 'rgba(255,77,77,0.12)', color: 'var(--red)' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── HAZARDS ── */}
      {activeSection === 'hazards' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button className="btn btn-primary" style={{ fontSize: 11, padding: '7px 14px' }} onClick={() => openHzForm()}>
              <Plus size={12} /> Add Hazard
            </button>
          </div>

          {/* Hazard Form Modal */}
          {hzForm !== null && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: 420, maxWidth: '94vw' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
                  {hzForm.id ? 'Edit Hazard' : 'Add New Hazard'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <Field label="Latitude *">
                      <input style={inputStyle} type="number" step="0.0001" value={hzFormData.latitude ?? ''} onChange={e => setHzFormData(p => ({ ...p, latitude: e.target.value }))} />
                    </Field>
                    <Field label="Longitude *">
                      <input style={inputStyle} type="number" step="0.0001" value={hzFormData.longitude ?? ''} onChange={e => setHzFormData(p => ({ ...p, longitude: e.target.value }))} />
                    </Field>
                  </div>
                  <Field label="Hazard Type">
                    <select style={selectStyle} value={hzFormData.hazardType ?? 'POTHOLE'} onChange={e => setHzFormData(p => ({ ...p, hazardType: e.target.value }))}>
                      {['POTHOLE', 'FLOODING', 'CONSTRUCTION', 'ACCIDENT', 'ROAD_DAMAGE', 'DEBRIS', 'OTHER'].map(v => <option key={v}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="Description">
                    <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }} value={hzFormData.description ?? ''} onChange={e => setHzFormData(p => ({ ...p, description: e.target.value }))} />
                  </Field>
                  {hzForm.id && (
                    <Field label="Status">
                      <select style={selectStyle} value={hzFormData.status ?? 'ACTIVE'} onChange={e => setHzFormData(p => ({ ...p, status: e.target.value }))}>
                        {['ACTIVE', 'RESOLVED'].map(v => <option key={v}>{v}</option>)}
                      </select>
                    </Field>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => setHzForm(null)}>Cancel</button>
                  <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={saveHz}>
                    {hzForm.id ? 'Update' : 'Add Hazard'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700 }}>
              Road Hazards ({hazards.length})
            </div>
            {hzLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}><Loader size={20} /></div>
            ) : hazards.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No hazards found.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Type</th><th>Location</th><th>Description</th><th>Status</th><th>Reported</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {hazards.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 600, fontSize: 12 }}>{h.hazardType}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {h.latitude?.toFixed(4)}, {h.longitude?.toFixed(4)}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.description || '—'}
                      </td>
                      <td>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                          background: h.status === 'ACTIVE' ? 'rgba(255,149,0,0.12)' : 'rgba(0,229,160,0.12)',
                          color: h.status === 'ACTIVE' ? 'var(--orange)' : 'var(--accent)',
                        }}>{h.status}</span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {h.reportedAt ? new Date(h.reportedAt).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button title="Edit" onClick={() => openHzForm(h)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: 'none', background: 'rgba(77,184,255,0.12)', color: 'var(--blue)' }}>
                            <Edit2 size={12} />
                          </button>
                          {h.status === 'ACTIVE' && (
                            <button title="Resolve" onClick={() => resolveHz(h)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: 'none', background: 'rgba(0,229,160,0.12)', color: 'var(--accent)' }}>
                              <CheckCircle size={12} />
                            </button>
                          )}
                          <button title="Delete" onClick={() => deleteHz(h)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: 'none', background: 'rgba(255,77,77,0.12)', color: 'var(--red)' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Global Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Confirm Dialog */}
      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={confirm.onCancel} />}
    </div>
  )
}
