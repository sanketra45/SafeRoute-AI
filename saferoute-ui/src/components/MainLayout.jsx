import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  Shield, Map, Navigation, BarChart2, Trophy, Settings,
  Sun, Moon, Bell, Monitor, AlertTriangle, Route,
  LogOut, Menu, X, ChevronRight, Activity, MapPin
} from 'lucide-react'
import ReportHazardModal from './ReportHazardModal'

function getTheme() {
  return localStorage.getItem('saferoute_theme') || 'dark'
}

export default function MainLayout({ children, activePage, setActivePage, onLogout }) {
  const { user } = useAuth()
  const [theme, setTheme] = useState(getTheme)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [alerts, setAlerts] = useState(3)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [showHazardModal, setShowHazardModal] = useState(false)
  const [sidebarActive, setSidebarActive] = useState('route')

  // Apply theme to root element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('saferoute_theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  const navLinks = [
    { id: 'map', label: 'Map', icon: <Map size={13} /> },
    { id: 'navigate', label: 'Navigate', icon: <Navigation size={13} /> },
    { id: 'risk', label: 'Risk Analysis', icon: <BarChart2 size={13} /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={13} /> },
    ...(user?.role === 'admin' ? [{ id: 'admin', label: 'Admin', icon: <Shield size={13} /> }] : []),
  ]

  const sidebarItems = [
    { id: 'route', icon: <Route size={15} />, label: 'Route Planner', action: () => setActivePage('navigate') },
    { id: 'risk', icon: <Shield size={15} />, label: 'Risk Analysis', action: () => setActivePage('risk') },
    { id: 'hotspots', icon: <BarChart2 size={15} />, label: 'Hotspots', action: () => setActivePage('map') },
    { id: 'report', icon: <AlertTriangle size={15} />, label: 'Report Hazard', action: () => setShowHazardModal(true) },
    { id: 'settings', icon: <Settings size={15} />, label: 'Settings', action: () => {} },
  ]

  const recentAlerts = [
    { id: 1, title: 'High Risk Zone', location: 'Sitabuldi Interchange', time: '2 min ago', color: 'var(--red)' },
    { id: 2, title: 'Congestion Alert', location: 'Wardha Road Signal', time: '8 min ago', color: 'var(--orange)' },
    { id: 3, title: 'Road Work', location: 'Dharampeth Square', time: '15 min ago', color: 'var(--yellow)' },
  ]

  const handleNav = (id) => {
    setActivePage(id)
    setMobileMenuOpen(false)
    setSidebarOpen(false)
  }

  const initials = user?.name ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : 'U'

  return (
    <div className="app-layout">
      {/* NAVBAR */}
      <nav className="navbar">
        <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Menu size={16} />
        </button>
        <div className="navbar-logo" onClick={() => handleNav('map')}>
          <Shield size={18} />
          <span>SafeRoute AI</span>
        </div>
        {activePage === 'admin' && user?.role === 'admin' && (
          <span className="admin-badge">Admin Console</span>
        )}
        <div className="navbar-nav">
          {navLinks.map((link) => (
            <button
              key={link.id}
              className={`nav-link ${activePage === link.id ? 'active' : ''}`}
              onClick={() => handleNav(link.id)}
            >
              {link.icon}
              {link.label}
            </button>
          ))}
        </div>

        {/* Mobile hamburger for nav links */}
        <button className="mobile-nav-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
        </button>

        <div className="navbar-right">
          {/* Theme toggle */}
          <button className="icon-btn" title="Toggle Theme" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Alerts */}
          <div style={{ position: 'relative' }}>
            <button
              className="icon-btn"
              title="Alerts"
              onClick={() => { setAlertsOpen(!alertsOpen); if (alerts > 0) setAlerts(0) }}
              style={{ position: 'relative' }}
            >
              <Bell size={14} />
              {alerts > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  background: 'var(--red)', color: 'white',
                  borderRadius: '50%', width: 16, height: 16,
                  fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid var(--bg-base)',
                }}>{alerts}</span>
              )}
            </button>

            {alertsOpen && (
              <div style={{
                position: 'absolute', top: 44, right: 0,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 16, minWidth: 280, zIndex: 2000,
                boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>Recent Alerts</div>
                {recentAlerts.map((a) => (
                  <div key={a.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{a.location}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.time}</div>
                    </div>
                  </div>
                ))}
                <button
                  className="btn btn-outline"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 12, fontSize: 11, padding: '7px' }}
                  onClick={() => { setAlertsOpen(false); handleNav('navigate') }}
                >
                  Navigate Safely <ChevronRight size={11} />
                </button>
              </div>
            )}
          </div>

          <div
            className="score-pill"
            style={{ cursor: 'pointer' }}
            onClick={() => handleNav('leaderboard')}
            title="Your Safety Score"
          >
            {user?.score ?? 75}% Score
          </div>

          <div className="avatar" title={user?.name || 'User'}>
            {initials}
          </div>

          <button className="icon-btn" title="Logout" onClick={onLogout}>
            <LogOut size={14} />
          </button>
        </div>
      </nav>

      {/* MOBILE NAV DROPDOWN */}
      {mobileMenuOpen && (
        <div className="mobile-nav-menu">
          {navLinks.map((link) => (
            <button
              key={link.id}
              className={`mobile-nav-link ${activePage === link.id ? 'active' : ''}`}
              onClick={() => handleNav(link.id)}
            >
              {link.icon} {link.label}
            </button>
          ))}
        </div>
      )}

      {/* BODY */}
      <div className="app-body">
        {/* SIDEBAR OVERLAY (mobile) */}
        {sidebarOpen && (
          <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        {/* SIDEBAR */}
        <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
          <div style={{ padding: '0 0 12px' }}>
            <div className="sidebar-section-label">Map Controls</div>
            <div className="sidebar-sub">Nagpur Intelligent Grid</div>
          </div>

          {sidebarItems.map((item) => (
            <div
              key={item.id}
              className={`sidebar-item ${sidebarActive === item.id ? 'active' : ''}`}
              onClick={() => { setSidebarActive(item.id); item.action(); setSidebarOpen(false) }}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}

          <div style={{ padding: '20px 16px 8px' }}>
            <button className="sidebar-cta" onClick={() => { handleNav('navigate'); setSidebarOpen(false) }}>
              <Navigation size={15} />
              Find Safe Route
            </button>
          </div>

          <div style={{ flex: 1 }} />

          <div className="sidebar-bottom">
            <div className="sidebar-status-item">
              <Bell size={13} />
              <span style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>Live Alerts</span>
              <span style={{
                marginLeft: 'auto', background: 'var(--red)', color: 'white',
                borderRadius: '50%', width: 16, height: 16,
                fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>3</span>
            </div>
            <div className="sidebar-status-item">
              <Monitor size={13} />
              <span style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>System Status</span>
              <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 10 }}>●</span>
            </div>
            {user && (
              <div className="sidebar-status-item" style={{ marginTop: 4 }}>
                <Activity size={13} />
                <span style={{ letterSpacing: '0.5px', textTransform: 'capitalize' }}>
                  {user.name} · <span style={{ color: user.role === 'admin' ? 'var(--orange)' : 'var(--accent)', textTransform: 'uppercase', fontSize: 10 }}>{user.role}</span>
                </span>
              </div>
            )}
          </div>
        </aside>

        {/* CONTENT */}
        <main className="main-content" onClick={() => { if (alertsOpen) setAlertsOpen(false) }}>
          {children}
          <footer className="footer">
            <div className="footer-left">
              <strong>SafeRoute AI Nagpur</strong>
              <span>© 2024</span>
              <span style={{ color: 'var(--border-bright)' }}>•</span>
              <span>Live Data Mode Active</span>
            </div>
            <div className="footer-right">
              <a href="#" onClick={(e) => e.preventDefault()}>Terms</a>
              <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setShowHazardModal(true) }}
                style={{ color: 'var(--accent)' }}
              >
                Report Hazard
              </a>
              {activePage === 'admin' && (
                <div className="live-dot">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                  Live Telemetry Connected
                </div>
              )}
            </div>
          </footer>
        </main>
      </div>

      {/* HAZARD REPORT MODAL */}
      {showHazardModal && (
        <ReportHazardModal
          onClose={() => setShowHazardModal(false)}
          onSubmit={() => setShowHazardModal(false)}
        />
      )}
    </div>
  )
}
