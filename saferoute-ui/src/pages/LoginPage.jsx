import { useState } from 'react'
import { Shield, Mail, Lock, Eye, EyeOff, AlertTriangle, CheckCircle, Activity } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage({ onLogin, onRegister }) {
  const { login, error, clearError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)
    clearError()
    if (!email.trim() || !password.trim()) { setLocalError('Please enter email and password.'); return }
    setLoading(true)
    const ok = await login(email.trim(), password)
    if (ok) onLogin()
    else setLoading(false)
  }

  const displayError = localError || error

  return (
    <div className="auth-layout">
      {/* LEFT */}
      <div className="auth-left">
        <div className="auth-left-bg" />
        <div className="auth-left-gradient" />

        {/* Decorative hotspots */}
        <div style={{ position: 'absolute', top: '20%', left: '15%', width: 10, height: 10, borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 16px var(--red)' }} />
        <div style={{ position: 'absolute', top: '35%', left: '55%', width: 8, height: 8, borderRadius: '50%', background: 'var(--orange)', boxShadow: '0 0 12px var(--orange)' }} />
        <div style={{ position: 'absolute', top: '55%', left: '30%', width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 12px var(--accent-glow)' }} />

        <div className="auth-left-content">
          <div className="auth-headline">Nagpur's<br />Pulse.</div>
          <div className="auth-headline-sub">
            Real-time risk assessment for every intersection in the Orange City.
          </div>

          <div className="auth-floating-cards">
            <div className="auth-fcard fade-in-delay-1">
              <div className="auth-fcard-icon" style={{ background: 'rgba(255,77,77,0.12)', border: '1px solid rgba(255,77,77,0.25)' }}>
                <AlertTriangle size={18} color="var(--red)" />
              </div>
              <div>
                <div className="auth-fcard-title" style={{ color: 'var(--red)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>HIGH RISK ZONE</div>
                <div className="auth-fcard-title">Sitabuldi Interchange</div>
                <div className="auth-fcard-sub">High congestion detected</div>
              </div>
            </div>

            <div className="auth-fcard fade-in-delay-2">
              <div className="auth-fcard-icon" style={{ background: 'rgba(0,229,160,0.12)', border: '1px solid rgba(0,229,160,0.25)' }}>
                <CheckCircle size={18} color="var(--accent)" />
              </div>
              <div>
                <div className="auth-fcard-title" style={{ color: 'var(--accent)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>SAFE ROUTE FOUND</div>
                <div className="auth-fcard-title">Wardha Road Bypass</div>
                <div className="auth-fcard-sub">0 hazards reported</div>
              </div>
            </div>

            <div className="auth-fcard fade-in-delay-3">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 11, letterSpacing: '1.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Driver Score</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>94</div>
                <div style={{ width: '60%', height: 3, background: 'var(--border)', borderRadius: 2, marginTop: 4 }}>
                  <div style={{ width: '94%', height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Excellent Performance</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="auth-right">
        <div style={{ maxWidth: 400, margin: '0 auto', width: '100%' }}>
          <div className="auth-form-header">
            <div className="auth-logo">
              <Shield size={22} />
              SafeRoute AI
            </div>
            <div className="auth-form-title">Welcome back</div>
            <div className="auth-form-sub">Navigate Nagpur Safely with AI</div>
          </div>

          {/* Demo hint */}
          <div style={{
            background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.2)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 11, color: 'var(--text-secondary)',
          }}>
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Admin demo:</span>{' '}
            admin@saferoute.in / Admin@123 &nbsp;|&nbsp;
            <span style={{ color: 'var(--text-muted)' }}>Or register a new account below.</span>
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

          <form className="auth-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="input-group">
              <label className="input-label">Email Address</label>
              <div className="input-icon-wrap">
                <Mail size={14} className="input-icon" />
                <input
                  className="input"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="input-label">Password</label>
              </div>
              <div className="input-icon-wrap" style={{ position: 'relative' }}>
                <Lock size={14} className="input-icon" />
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 14, borderRadius: 10 }}
              disabled={loading}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={14} style={{ animation: 'pulse 1s infinite' }} />
                  Signing In...
                </span>
              ) : 'Sign In →'}
            </button>

            <div className="auth-form-footer">
              Don't have an account? <a onClick={onRegister}>Register</a>
            </div>
          </form>

          <div className="auth-bottom-status" style={{ marginTop: 40 }}>
            Secure Neural Link Active • Nagpur Node 01
          </div>
        </div>
      </div>
    </div>
  )
}
