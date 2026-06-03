import { useState } from 'react'
import { X, AlertTriangle, MapPin, Loader } from 'lucide-react'

const HAZARD_TYPES = [
  { value: 'pothole', label: '🕳 Pothole' },
  { value: 'flood', label: '🌊 Flooding / Waterlogging' },
  { value: 'accident', label: '🚗 Accident / Crash' },
  { value: 'roadblock', label: '🚧 Road Block / Construction' },
  { value: 'debris', label: '🪨 Debris / Object on Road' },
  { value: 'signal', label: '🚦 Broken Traffic Signal' },
  { value: 'other', label: '⚠ Other Hazard' },
]

const SEVERITY_LEVELS = [
  { value: 'LOW', label: 'Low', color: 'var(--accent)' },
  { value: 'MEDIUM', label: 'Medium', color: 'var(--yellow)' },
  { value: 'HIGH', label: 'High', color: 'var(--orange)' },
  { value: 'CRITICAL', label: 'Critical', color: 'var(--red)' },
]

function getHazards() {
  try { return JSON.parse(localStorage.getItem('saferoute_hazards') || '[]') } catch { return [] }
}
function saveHazards(hazards) {
  localStorage.setItem('saferoute_hazards', JSON.stringify(hazards))
}

export default function ReportHazardModal({ onClose, onSubmit, defaultLat, defaultLng }) {
  const [type, setType] = useState('pothole')
  const [severity, setSeverity] = useState('MEDIUM')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [gettingLocation, setGettingLocation] = useState(false)
  const [coords, setCoords] = useState(
    defaultLat && defaultLng ? { lat: defaultLat, lng: defaultLng } : null
  )
  const [submitted, setSubmitted] = useState(false)

  const getGPS = () => {
    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocation(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`)
        setGettingLocation(false)
      },
      () => {
        setLocation('Location unavailable — please type your location')
        setGettingLocation(false)
      }
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const hazardType = HAZARD_TYPES.find((h) => h.value === type)
    const newHazard = {
      id: `hazard-${Date.now()}`,
      type,
      label: hazardType?.label || type,
      severity,
      risk: severity,
      location,
      description,
      lat: coords?.lat || 21.1458 + (Math.random() - 0.5) * 0.05,
      lng: coords?.lng || 79.0882 + (Math.random() - 0.5) * 0.05,
      reportedAt: new Date().toISOString(),
      userReported: true,
      detail: description || hazardType?.label,
    }
    const existing = getHazards()
    saveHazards([...existing, newHazard])
    setSubmitted(true)
    setTimeout(() => {
      onSubmit?.(newHazard)
      onClose?.()
    }, 1500)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 28, width: '100%', maxWidth: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, background: 'rgba(255,149,0,0.12)',
                border: '1px solid rgba(255,149,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <AlertTriangle size={16} color="var(--orange)" />
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>Report a Hazard</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 46 }}>Help other drivers stay safe</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
              Hazard Reported!
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Your report is now visible on the map for all users.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Hazard Type */}
            <div className="input-group">
              <label className="input-label">Hazard Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input"
                style={{ cursor: 'pointer' }}
              >
                {HAZARD_TYPES.map((h) => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </select>
            </div>

            {/* Severity */}
            <div className="input-group">
              <label className="input-label">Severity Level</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {SEVERITY_LEVELS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSeverity(s.value)}
                    style={{
                      flex: 1, padding: '8px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      border: severity === s.value ? `1.5px solid ${s.color}` : '1px solid var(--border)',
                      background: severity === s.value ? `${s.color}18` : 'var(--bg-base)',
                      color: severity === s.value ? s.color : 'var(--text-secondary)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div className="input-group">
              <label className="input-label">Location</label>
              <div style={{ position: 'relative' }}>
                <MapPin size={14} className="input-icon" />
                <input
                  className="input"
                  style={{ paddingLeft: 38, paddingRight: gettingLocation ? 120 : 140 }}
                  placeholder="Type location or use GPS"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <button
                  type="button"
                  onClick={getGPS}
                  disabled={gettingLocation}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                    color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {gettingLocation ? <Loader size={10} style={{ animation: 'spin 1s linear infinite' }} /> : '📍 Use GPS'}
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="input-group">
              <label className="input-label">Description (Optional)</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Describe the hazard to help other drivers..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ resize: 'vertical', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 14 }}>
              <AlertTriangle size={14} /> Submit Hazard Report
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
