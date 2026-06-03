import { useState } from 'react'
import { Shield, User, Mail, Lock, RefreshCw, Zap, Route, Activity, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage({ onRegister, onLogin }) {
  const { register, error, clearError } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    setLocalError(null)
    clearError()

    if (!name.trim()) { setLocalError('Please enter your full name.'); return }
    if (!email.trim()) { setLocalError('Please enter your email address.'); return }
    if (password.length < 6) { setLocalError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setLocalError('Passwords do not match.'); return }
    if (!agreed) { setLocalError('Please agree to the Terms of Service.'); return }

    setLoading(true)
    setTimeout(() => {
      const ok = register(name.trim(), email.trim(), password)
      if (ok) {
        onRegister()
      } else {
        setLoading(false)
      }
    }, 700)
  }

  const displayError = localError || error

  return (
    <div className="auth-layout">
      {/* LEFT */}
      <div className="auth-left">
        <div className="auth-left-bg" />
        <div className="auth-left-gradient" />

        {/* City silhouette */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 220,
          background: 'linear-gradient(to top, rgba(0,5,5,1) 20%, transparent)',
          zIndex: 1,
        }} />
        <svg style={{ position: 'absolute', bottom: 100, left: 0, right: 0, opacity: 0.15, zIndex: 1 }}
          viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
          <rect x="20" y="80" width="40" height="120" fill="var(--accent)" />
          <rect x="70" y="50" width="30" height="150" fill="var(--accent)" />
          <rect x="110" y="100" width="50" height="100" fill="var(--accent)" />
          <rect x="170" y="30" width="35" height="170" fill="var(--accent)" />
          <rect x="215" y="70" width="45" height="130" fill="var(--accent)" />
          <rect x="270" y="90" width="30" height="110" fill="var(--accent)" />
          <rect x="310" y="20" width="60" height="180" fill="var(--accent)" />
          <rect x="380" y="60" width="40" height="140" fill="var(--accent)" />
          <rect x="430" y="85" width="50" height="115" fill="var(--accent)" />
          <rect x="490" y="40" width="35" height="160" fill="var(--accent)" />
          <rect x="535" y="75" width="45" height="125" fill="var(--accent)" />
        </svg>

        <div className="auth-left-content">
          <div className="auth-floating-cards">
            <div className="auth-fcard fade-in">
              <div className="auth-fcard-icon" style={{ background: 'rgba(0,229,160,0.12)', border: '1px solid rgba(0,229,160,0.3)' }}>
                <Shield size={18} color="var(--accent)" />
              </div>
              <div>
                <div className="auth-fcard-title" style={{ color: 'var(--accent)' }}>Live Grid Active</div>
                <div className="auth-fcard-sub">Nagpur North Sector: High Precision</div>
              </div>
            </div>

            <div className="auth-fcard fade-in-delay-1">
              <div className="auth-fcard-icon" style={{ background: 'rgba(100,80,255,0.12)', border: '1px solid rgba(100,80,255,0.3)' }}>
                <Zap size={18} color="#9d87ff" />
              </div>
              <div>
                <div className="auth-fcard-title" style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 800 }}>98.4% Confidence</div>
                <div className="auth-fcard-sub">Real-time risk mitigation engine</div>
              </div>
            </div>

            <div className="auth-fcard fade-in-delay-2">
              <div className="auth-fcard-icon" style={{ background: 'rgba(80,80,120,0.2)', border: '1px solid rgba(100,100,160,0.3)' }}>
                <Route size={18} color="#8888cc" />
              </div>
              <div>
                <div className="auth-fcard-title">Route Optimizer</div>
                <div className="auth-fcard-sub">420+ incidents avoided today</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="auth-right">
        <div style={{ maxWidth: 420, margin: '0 auto', width: '100%' }}>
          <div className="auth-form-header">
            <div className="auth-logo">
              <Shield size={22} />
              SafeRoute AI
            </div>
            <div className="auth-form-title">Join the safety network</div>
            <div className="auth-form-sub">Create your Nagpur driver profile to access real-time risk intelligence.</div>
          </div>

          {displayError && (
            <div style={{
              background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.25)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={13} /> {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <div className="input-icon-wrap">
                <User size={14} className="input-icon" />
                <input className="input" type="text" placeholder="Enter your full name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Email Address</label>
              <div className="input-icon-wrap">
                <Mail size={14} className="input-icon" />
                <input className="input" type="email" placeholder="driver@nagpur-safe.in" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Password</label>
                <div className="input-icon-wrap">
                  <Lock size={14} className="input-icon" />
                  <input className="input" type="password" placeholder="Min. 6 chars" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Confirm</label>
                <div className="input-icon-wrap">
                  <RefreshCw size={14} className="input-icon" />
                  <input className="input" type="password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </div>
              </div>
            </div>

            <label className="checkbox-row">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>
                I agree to the <a href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a> and{' '}
                <a href="#" onClick={(e) => e.preventDefault()}>Hazard Database Participation</a> policies.
              </span>
            </label>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 14, borderRadius: 10 }}
              disabled={loading || !agreed}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={14} /> Creating Account...
                </span>
              ) : 'Create Account →'}
            </button>

            <div className="auth-form-footer">
              Already have an account? <a onClick={onLogin}>Sign In</a>
            </div>
          </form>

          <div className="auth-footer">© 2024 SafeRoute AI Nagpur</div>
        </div>
      </div>
    </div>
  )
}
