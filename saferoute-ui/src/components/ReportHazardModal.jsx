import { useState, useRef, useEffect } from 'react'
import { X, AlertTriangle, MapPin, Loader, Search, Crosshair } from 'lucide-react'
import { reportHazard } from '../services/api'

const HAZARD_TYPES = [
  { value: 'pothole',    label: '🕳 Pothole' },
  { value: 'flood',      label: '🌊 Flooding / Waterlogging' },
  { value: 'accident',   label: '🚗 Accident / Crash' },
  { value: 'roadblock',  label: '🚧 Road Block / Construction' },
  { value: 'debris',     label: '🪨 Debris on Road' },
  { value: 'signal',     label: '🚦 Broken Traffic Signal' },
  { value: 'other',      label: '⚠ Other Hazard' },
]

const SEVERITY_LEVELS = [
  { value: 'LOW',      label: 'Low',      color: 'var(--accent)' },
  { value: 'MEDIUM',   label: 'Medium',   color: 'var(--orange)' },
  { value: 'HIGH',     label: 'High',     color: '#ef4444' },
  { value: 'CRITICAL', label: 'Critical', color: '#b91c1c' },
]

const API_HAZARD_TYPES = {
  pothole: 'POTHOLE',
  flood: 'FLOODING',
  accident: 'ACCIDENT',
  roadblock: 'ROAD_CLOSURE',
  debris: 'DEBRIS',
  signal: 'OTHER',
  other: 'OTHER',
}

// Location autocomplete using Nominatim
async function searchLocation(query) {
  if (!query || query.length < 3) return []
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Nagpur, India')}&limit=5&addressdetails=1&namedetails=1`,
    { headers: { 'Accept-Language': 'en' } }
  )
  const data = await res.json()
  return data.map(d => ({
    label: d.display_name,
    shortLabel: d.namedetails?.name || d.display_name.split(',')[0],
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
  }))
}

function LocationSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const debounceRef = useRef(null)

  const handleChange = (e) => {
    const q = e.target.value
    setQuery(q)
    setSelected(null)
    onSelect(null)
    clearTimeout(debounceRef.current)
    if (q.length < 3) { setSuggestions([]); setOpen(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchLocation(q)
        setSuggestions(results)
        setOpen(results.length > 0)
      } catch { setSuggestions([]) }
      finally { setSearching(false) }
    }, 400)
  }

  const handleSelect = (s) => {
    setQuery(s.shortLabel)
    setSelected(s)
    setSuggestions([])
    setOpen(false)
    onSelect(s)
  }

  const handleGPS = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const label = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`
        setQuery(label)
        const s = { shortLabel: label, lat: pos.coords.latitude, lng: pos.coords.longitude }
        setSelected(s)
        onSelect(s)
      },
      () => {}
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="input-icon-wrap">
        <Search size={13} className="input-icon" />
        <input
          className="input"
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search location in Nagpur…"
          autoComplete="off"
          style={{ paddingRight: 40 }}
        />
        {searching && (
          <Loader size={12} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', animation:'spin 1s linear infinite' }} />
        )}
      </div>

      {/* GPS button */}
      <button type="button" onClick={handleGPS} style={{
        display:'flex', alignItems:'center', gap:4,
        marginTop:6, fontSize:11, color:'var(--accent)',
        background:'none', border:'none', cursor:'pointer', padding:0,
      }}>
        <MapPin size={11} /> Use my GPS location
      </button>

      {/* Selected indicator */}
      {selected && (
        <div style={{ fontSize:10, color:'var(--accent)', marginTop:4, display:'flex', alignItems:'center', gap:4 }}>
          ✓ {selected.lat?.toFixed(5)}, {selected.lng?.toFixed(5)}
        </div>
      )}

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div style={{
          position:'absolute', top:'100%', left:0, right:0, zIndex:10000,
          background:'var(--bg-card)', border:'1px solid var(--border)',
          borderRadius:10, boxShadow:'0 12px 30px rgba(0,0,0,0.5)',
          marginTop:4, overflow:'hidden',
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onMouseDown={() => handleSelect(s)}
              style={{
                padding:'9px 14px', cursor:'pointer', fontSize:12,
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight:600, color:'var(--text-primary)' }}>{s.shortLabel}</div>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ReportHazardModal({ onClose, onSubmit, onSelectOnMap, onCancelSelection, onClearMapSelection, selectedLocation, selectingOnMap, pickerOpen }) {
  const [type, setType]             = useState('pothole')
  const [severity, setSeverity]     = useState('MEDIUM')
  const [description, setDescription] = useState('')
  const [coords, setCoords]         = useState(null)
  const [locationLabel, setLocationLabel] = useState('')
  const [submitted, setSubmitted]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (selectedLocation) {
      setCoords(selectedLocation)
      setLocationLabel('Selected on map')
    }
  }, [selectedLocation])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!coords) {
      setError('Choose a location using search, GPS, or Select on Map before submitting.')
      return
    }
    setSubmitting(true)
    const hazardType = HAZARD_TYPES.find((h) => h.value === type)
    try {
      const saved = await reportHazard({
        latitude: coords.lat,
        longitude: coords.lng,
        hazardType: API_HAZARD_TYPES[type],
        severity,
        description,
      })
      setSubmitted(true)
      setTimeout(() => {
        onSubmit?.(saved)
        onClose?.()
      }, 1400)
    } catch (submitError) {
      setError(submitError.message || 'Unable to report this hazard.')
    } finally {
      setSubmitting(false)
    }
  }

  // Keep this component mounted while the dedicated map picker is displayed so its form draft survives the round trip.
  if (pickerOpen) return null

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9998,
      background:'rgba(0,0,0,0.72)', backdropFilter:'blur(6px)',
      display:'flex', alignItems: selectingOnMap ? 'flex-end' : 'center', justifyContent:'center',
      padding:20, animation:'fadeIn 0.2s ease', pointerEvents:'none',
    }}>
      <div style={{
        background:'var(--bg-card)', border:'1px solid var(--border)',
        borderRadius:16, padding:28, width:'100%', maxWidth:500,
        boxShadow:'0 20px 60px rgba(0,0,0,0.55)',
        maxHeight: selectingOnMap ? '52vh' : '90vh', overflowY:'auto', pointerEvents:'auto',
      }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:'rgba(255,149,0,0.12)', border:'1px solid rgba(255,149,0,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <AlertTriangle size={17} color="var(--orange)" />
            </div>
            <div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:17, fontWeight:700 }}>Report a Hazard</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:1 }}>Help other drivers stay safe</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div style={{ textAlign:'center', padding:'32px 0' }}>
            <div style={{ fontSize:52, marginBottom:12 }}>✅</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--accent)', marginBottom:8 }}>Hazard Reported!</div>
            <div style={{ fontSize:13, color:'var(--text-secondary)' }}>Your report is now visible on the map for all users.</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Hazard Type */}
            <div className="input-group">
              <label className="input-label">Hazard Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="input" style={{ cursor:'pointer' }}>
                {HAZARD_TYPES.map((h) => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </select>
            </div>

            {/* Severity */}
            <div className="input-group">
              <label className="input-label">Severity Level</label>
              <div style={{ display:'flex', gap:6 }}>
                {SEVERITY_LEVELS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSeverity(s.value)}
                    style={{
                      flex:1, padding:'8px 4px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600,
                      border: severity === s.value ? `1.5px solid ${s.color}` : '1px solid var(--border)',
                      background: severity === s.value ? `${s.color}18` : 'var(--bg-base)',
                      color: severity === s.value ? s.color : 'var(--text-secondary)',
                      transition:'all 0.15s',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Location Search (autocomplete) */}
            <div className="input-group">
              <label className="input-label">Location <span style={{ color:'var(--text-muted)' }}>(search or use GPS)</span></label>
              <LocationSearch
                onSelect={(s) => {
                  onClearMapSelection?.()
                  if (s) {
                    setCoords({ lat: s.lat, lng: s.lng })
                    setLocationLabel(s.shortLabel || s.label || '')
                  } else {
                    setCoords(null)
                    setLocationLabel('')
                  }
                }}
              />
            </div>

            <button type="button" className="btn btn-outline" onClick={onSelectOnMap}
              style={{ justifyContent:'center', borderColor: selectingOnMap ? 'var(--accent)' : undefined }}>
              <Crosshair size={13} /> {selectingOnMap ? 'Click a position on the map…' : 'Select on Map'}
            </button>
            {selectingOnMap && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, border:'1px solid var(--accent)', background:'rgba(0,229,160,0.08)', borderRadius:8, padding:'8px 10px', color:'var(--accent)', fontSize:12 }}>
                <span>Click anywhere on the map to place or move the marker.</span>
                <button type="button" onClick={onCancelSelection} className="btn btn-outline" style={{ padding:'5px 8px', fontSize:11 }}>Cancel</button>
              </div>
            )}
            {selectedLocation && (
              <div style={{ fontSize:12, color:'var(--accent)' }}>
                Selected on map: {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
              </div>
            )}

            {/* Description */}
            <div className="input-group">
              <label className="input-label">Description <span style={{ color:'var(--text-muted)' }}>(optional)</span></label>
              <textarea
                className="input"
                rows={3}
                maxLength={500}
                placeholder="Describe the hazard to help other drivers…"
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{ resize:'vertical', fontFamily:'var(--font-mono)' }}
              />
              <div style={{ fontSize:10, color:'var(--text-muted)', textAlign:'right' }}>{description.length}/500</div>
            </div>

            {error && (
              <div role="alert" style={{ color:'var(--red)', fontSize:12 }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width:'100%', justifyContent:'center', padding:14 }}>
              <AlertTriangle size={13} /> {submitting ? 'Submitting…' : 'Submit Hazard Report'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
