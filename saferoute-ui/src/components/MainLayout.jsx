import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import {
  Shield, Map, Navigation, BarChart2, Settings,
  Sun, Moon, Bell, Monitor, AlertTriangle, Route,
  LogOut, MoreVertical, ChevronRight, Activity
} from 'lucide-react'
import ReportHazardModal from './ReportHazardModal'

function getTheme() {
  return localStorage.getItem('saferoute_theme') || 'dark'
}

export default function MainLayout({ children, activePage, setActivePage, onLogout }) {
  const { user } = useAuth()
  const [theme, setTheme] = useState(getTheme)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [alerts, setAlerts] = useState(0)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [showHazardModal, setShowHazardModal] = useState(false)
  const [sidebarActive, setSidebarActive] = useState('route')
  const mobileMenuRef = useRef(null)
  const mobileMenuButtonRef = useRef(null)

  // Apply theme to root element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('saferoute_theme', theme)
  }, [theme])

  useEffect(() => {
    if (!mobileMenuOpen) return undefined

    const menuItems = () => [...(mobileMenuRef.current?.querySelectorAll('[role="menuitem"]') || [])]
    menuItems()[0]?.focus()

    const handlePointerDown = (event) => {
      if (!mobileMenuRef.current?.contains(event.target) && !mobileMenuButtonRef.current?.contains(event.target)) {
        setMobileMenuOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      const items = menuItems()
      const currentIndex = items.indexOf(document.activeElement)

      if (event.key === 'Escape') {
        event.preventDefault()
        setMobileMenuOpen(false)
        mobileMenuButtonRef.current?.focus()
      } else if (items.length && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault()
        const nextIndex = event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : currentIndex < 0
              ? event.key === 'ArrowDown' ? 0 : items.length - 1
              : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[nextIndex]?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  const navLinks = [
    { id: 'map', label: 'Map', icon: <Map size={13} /> },
    { id: 'navigate', label: 'Navigate', icon: <Navigation size={13} /> },
    { id: 'risk', label: 'Risk Analysis', icon: <BarChart2 size={13} /> },
    ...(user?.role === 'admin' ? [{ id: 'admin', label: 'Admin', icon: <Shield size={13} /> }] : []),
  ]

  const sidebarItems = [
    { id: 'route', icon: <Route size={15} />, label: 'Route Planner', action: () => setActivePage('navigate') },
    { id: 'risk', icon: <Shield size={15} />, label: 'Risk Analysis', action: () => setActivePage('risk') },
    { id: 'hotspots', icon: <BarChart2 size={15} />, label: 'Hotspots', action: () => setActivePage('map') },
    { id: 'report', icon: <AlertTriangle size={15} />, label: 'Report Hazard', action: () => setShowHazardModal(true) },
    { id: 'settings', icon: <Settings size={15} />, label: 'Settings', action: () => {} },
  ]

  const handleNav = (id) => {
    if (mobileMenuOpen) mobileMenuButtonRef.current?.focus()
    setActivePage(id)
    setMobileMenuOpen(false)
  }

  const openHazardReport = () => {
    if (mobileMenuOpen) mobileMenuButtonRef.current?.focus()
    setMobileMenuOpen(false)
    setShowHazardModal(true)
  }

  const initials = user?.name ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : 'U'

  return (
    <div className="app-layout">
      {/* NAVBAR */}
      <nav className="navbar">
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

        <div className="navbar-right">
          {/* Theme toggle */}
          <button className="icon-btn" type="button" aria-label="Toggle theme" title="Toggle Theme" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Alerts */}
          <div style={{ position: 'relative' }}>
            <button
              className="icon-btn"
              title="Alerts"
              type="button"
              aria-label="Notifications"
              aria-expanded={alertsOpen}
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
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>
                  No active system alerts.
                </div>
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

          <button
            ref={mobileMenuButtonRef}
            className="icon-btn mobile-overflow-btn"
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-haspopup="menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-overflow-menu"
            onClick={() => {
              setAlertsOpen(false)
              setMobileMenuOpen((open) => !open)
            }}
          >
            <MoreVertical size={18} aria-hidden="true" />
          </button>

          <div className="avatar" title={user?.name || 'User'}>
            {initials}
          </div>

          <button className="icon-btn desktop-logout" type="button" aria-label="Logout" title="Logout" onClick={onLogout}>
            <LogOut size={14} />
          </button>
        </div>
      </nav>

      {createPortal(
        <div
          id="mobile-overflow-menu"
          className="mobile-overflow-menu"
          hidden={!mobileMenuOpen}
          role="menu"
          aria-label="Main navigation"
          ref={mobileMenuRef}
        >
          {[
            ...navLinks.map((link) => ({
              id: link.id,
              label: link.id === 'map' ? 'Home / Map' : link.id === 'admin' ? 'Admin Panel' : link.label,
              icon: link.icon,
              action: () => handleNav(link.id),
              active: activePage === link.id,
            })),
            { id: 'report', label: 'Report Hazard', icon: <AlertTriangle size={17} />, action: openHazardReport },
            { id: 'logout', label: 'Logout', icon: <LogOut size={17} />, action: onLogout, destructive: true },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              tabIndex={0}
              className={`mobile-overflow-item${item.active ? ' active' : ''}${item.destructive ? ' destructive' : ''}${item.id === 'report' || item.id === 'logout' ? ' separated' : ''}`}
              aria-current={item.active ? 'page' : undefined}
              onClick={item.action}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.active && <span className="mobile-overflow-current">Current</span>}
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* BODY */}
      <div className="app-body">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div style={{ padding: '0 0 12px' }}>
            <div className="sidebar-section-label">Map Controls</div>
            <div className="sidebar-sub">Nagpur Intelligent Grid</div>
          </div>

          {sidebarItems.map((item) => (
            <div
              key={item.id}
              className={`sidebar-item ${sidebarActive === item.id ? 'active' : ''}`}
              onClick={() => { setSidebarActive(item.id); item.action() }}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}

          <div style={{ padding: '20px 16px 8px' }}>
            <button className="sidebar-cta" onClick={() => handleNav('navigate')}>
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
