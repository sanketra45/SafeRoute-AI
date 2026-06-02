import { useState } from 'react'
import {
  Shield, Map, Navigation, BarChart2, Trophy, Settings,
  Sun, Radio, Bell, Monitor, AlertTriangle, Zap, Route,
  LogOut, ChevronRight, Activity
} from 'lucide-react'

export default function MainLayout({ children, activePage, setActivePage, onLogout }) {
  const [sidebarActive, setSidebarActive] = useState('route')
  const [alerts, setAlerts] = useState(3)

  const navLinks = [
    { id: 'map', label: 'Map' },
    { id: 'navigate', label: 'Navigate' },
    { id: 'risk', label: 'Risk Analysis' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'admin', label: 'Admin' },
  ]

  const sidebarItems = [
    { id: 'route', icon: <Route size={15} />, label: 'Route Planner' },
    { id: 'risk', icon: <Shield size={15} />, label: 'Risk Analysis' },
    { id: 'hotspots', icon: <BarChart2 size={15} />, label: 'Hotspots' },
    { id: 'emergency', icon: <AlertTriangle size={15} />, label: 'Emergency' },
    { id: 'settings', icon: <Settings size={15} />, label: 'Settings' },
  ]

  return (
    <div className="app-layout">
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="navbar-logo" onClick={() => setActivePage('map')}>
          <Shield size={18} />
          <span>SafeRoute AI</span>
        </div>
        {activePage === 'admin' && (
          <span className="admin-badge">Admin Console</span>
        )}
        <div className="navbar-nav">
          {navLinks.map(link => (
            <button
              key={link.id}
              className={`nav-link ${activePage === link.id ? 'active' : ''}`}
              onClick={() => setActivePage(link.id)}
            >
              {link.label}
            </button>
          ))}
        </div>
        <div className="navbar-right">
          <button className="icon-btn" title="Theme">
            <Sun size={14} />
          </button>
          <button className="icon-btn" style={{ position: 'relative' }} title="Live Signal">
            <Radio size={14} />
            <span style={{
              position: 'absolute', top: -2, right: -2,
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--accent)', border: '1.5px solid var(--bg-base)'
            }} />
          </button>
          {alerts > 0 && (
            <button className="icon-btn" style={{ position: 'relative' }} title="Alerts" onClick={() => setAlerts(0)}>
              <Bell size={14} />
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: 'var(--red)', color: 'white',
                borderRadius: '50%', width: 16, height: 16,
                fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid var(--bg-base)'
              }}>{alerts}</span>
            </button>
          )}
          <div
            className="score-pill"
            style={{ cursor: 'pointer' }}
            onClick={() => setActivePage('leaderboard')}
          >
            98% Score
          </div>
          <div className="avatar" title="Profile">A</div>
          <button className="icon-btn" title="Logout" onClick={onLogout}>
            <LogOut size={14} />
          </button>
        </div>
      </nav>

      {/* BODY */}
      <div className="app-body">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div style={{ padding: '0 0 12px' }}>
            <div className="sidebar-section-label">Map Controls</div>
            <div className="sidebar-sub">Nagpur Intelligent Grid</div>
          </div>

          {sidebarItems.map(item => (
            <div
              key={item.id}
              className={`sidebar-item ${sidebarActive === item.id ? 'active' : ''}`}
              onClick={() => setSidebarActive(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}

          <div style={{ padding: '20px 16px 8px' }}>
            <button className="sidebar-cta" onClick={() => setActivePage('navigate')}>
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
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>3</span>
            </div>
            <div className="sidebar-status-item">
              <Monitor size={13} />
              <span style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>System Status</span>
              <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 10 }}>●</span>
            </div>
          </div>
        </aside>

        {/* CONTENT */}
        <main className="main-content">
          {children}
          {/* Footer inside main content */}
          <footer className="footer">
            <div className="footer-left">
              <strong>SafeRoute AI Nagpur</strong>
              <span>© 2024</span>
              <span style={{ color: 'var(--border-bright)' }}>•</span>
              <span>Live Data Mode Active</span>
            </div>
            <div className="footer-right">
              <a>Terms</a>
              <a>Privacy</a>
              <a style={{ color: 'var(--accent)' }}>Hazard Database</a>
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
    </div>
  )
}
