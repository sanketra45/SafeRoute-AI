import { useEffect, useState } from 'react'
import { AlertTriangle, X, Navigation } from 'lucide-react'

export default function ProximityAlertBanner({ nearbyHazards, onDismiss }) {
  const [dismissed, setDismissed] = useState([])
  const [visible, setVisible] = useState([])

  useEffect(() => {
    if (!nearbyHazards?.length) return
    setVisible(nearbyHazards.filter((x) => !dismissed.includes(x.hazard.id)))
  }, [nearbyHazards, dismissed])

  const dismiss = (id) => {
    setDismissed((d) => [...d, id])
  }

  if (!visible?.length) return null

  const top = visible[0]
  const riskColor =
    top.hazard.risk === 'CRITICAL' ? 'var(--red)' :
    top.hazard.risk === 'HIGH' ? 'var(--orange)' :
    top.hazard.risk === 'MEDIUM' ? 'var(--yellow)' : 'var(--accent)'

  return (
    <div style={{
      position: 'fixed',
      top: 64,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      width: '90%',
      maxWidth: 600,
      animation: 'slideDown 0.35s ease',
    }}>
      {visible.slice(0, 3).map(({ hazard, distanceMeters }) => (
        <div key={hazard.id} style={{
          background: 'rgba(8,12,14,0.97)',
          border: `1.5px solid ${riskColor}`,
          borderRadius: 12,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxShadow: `0 0 24px ${riskColor}40`,
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: `${riskColor}18`,
            border: `1px solid ${riskColor}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={18} color={riskColor} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: riskColor, letterSpacing: 1, textTransform: 'uppercase' }}>
                ⚠ {hazard.risk} ZONE AHEAD
              </span>
              <span style={{ fontSize: 10, background: `${riskColor}20`, border: `1px solid ${riskColor}40`, color: riskColor, padding: '1px 6px', borderRadius: 4 }}>
                {distanceMeters}m
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {hazard.label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              <Navigation size={10} style={{ display: 'inline', marginRight: 4 }} />
              {hazard.detail || hazard.description || 'Proceed with caution'}
            </div>
          </div>
          <button
            onClick={() => dismiss(hazard.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
