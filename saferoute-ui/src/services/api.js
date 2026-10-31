/**
 * SafeRoute AI — API Service
 * /api/* → Spring Boot (port 8080) via Vite proxy in development
 * /ml/*  → Python ML service (port 5001) via Vite proxy
 */

// Production builds must receive the backend origin and add Spring Boot's /api
// prefix exactly once. Never fall back to a relative URL in production: that
// would send requests to the Vercel host instead of the Spring Boot service.
const configuredBackendUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')
const API_BASE = configuredBackendUrl
  ? `${configuredBackendUrl.replace(/\/api$/, '')}/api`
  : import.meta.env.DEV ? 'http://localhost:8080/api' : null
// Apply the same rule to the separately deployed Flask ML service.
const configuredMlUrl = import.meta.env.VITE_ML_BASE_URL?.replace(/\/$/, '')
const ML_BASE = configuredMlUrl || (import.meta.env.DEV ? 'http://localhost:5001' : null)

function springApiUrl(path) {
  if (!API_BASE) {
    throw new Error('Missing VITE_API_BASE_URL. Configure the deployed Spring Boot backend URL before building for production.')
  }
  return `${API_BASE}${path}`
}

function mlApiUrl(path) {
  if (!ML_BASE) {
    throw new Error('Missing VITE_ML_BASE_URL. Configure the deployed ML service URL before building for production.')
  }
  return `${ML_BASE}${path}`
}

// ─── Helpers ──────────────────────────────────────────────

function getToken() {
  const directToken = localStorage.getItem('saferoute_token')
  if (directToken) return directToken

  // Keep protected API calls authenticated if an older/session-restored client has
  // the token only inside the persisted application session.
  try {
    return JSON.parse(localStorage.getItem('saferoute_session') || 'null')?.token || null
  } catch {
    return null
  }
}

async function request(url, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }
  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    const text = await res.text()
    try {
      const json = JSON.parse(text)
      const msg = json?.error || json?.message || json?.detail || `HTTP ${res.status}`
      throw new Error(msg)
    } catch (parseErr) {
      if (parseErr instanceof SyntaxError) {
        throw new Error(text || `HTTP ${res.status}`)
      }
      throw parseErr
    }
  }
  // Handle empty response (e.g. 204 No Content)
  const contentType = res.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) return {}
  return res.json()
}

// ─── Auth (Spring Boot /api/auth) ──────────────────────────

export async function login(email, password) {
  const data = await request(springApiUrl('/auth/login'), {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (data.token) localStorage.setItem('saferoute_token', data.token)
  return data
}

export async function register({ name, email, password }) {
  return request(springApiUrl('/auth/register'), {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
}

export function logout() {
  localStorage.removeItem('saferoute_token')
}

// ─── Risk Prediction (ML service → /ml/predict-risk) ───────

export async function predictRisk(params) {
  return request(mlApiUrl('/predict-risk'), {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ─── Route Planning (ML service → /ml/safe-route) ──────────

export async function getSafeRoute(params) {
  return request(mlApiUrl('/safe-route'), {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ─── OSRM Fallback Route (public OSRM demo server) ─────────

export async function getOsrmRoute(fromLat, fromLng, toLat, toLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=false`
  const res = await fetch(url)
  if (!res.ok) throw new Error('OSRM routing failed')
  const data = await res.json()
  if (!data.routes || data.routes.length === 0) throw new Error('No route found')
  const route = data.routes[0]
  const coords = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
  const distM = route.distance
  return {
    safeRoute: coords,
    fastRoute: coords,
    safeDistance: distM,
    fastDistance: distM,
    safeRiskScore: 0.3,
    fastRiskScore: 0.3,
    message: `Route via OSRM fallback (ML service offline). Distance: ${(distM / 1000).toFixed(2)} km.`,
    comparison: {
      extra_distance_km: 0,
      risk_reduction_pct: 0,
      recommendation: 'ML service unavailable — showing basic route',
    },
    isFallback: true,
  }
}

// ─── Geocoding (ML service → /ml/geocode) ──────────────────

export async function geocode(query, limit = 8) {
  const params = new URLSearchParams({ q: query, limit })
  return request(mlApiUrl(`/geocode?${params}`))
}

// ─── ML Health Check ────────────────────────────────────────

export async function mlHealth() {
  return request(mlApiUrl('/health'))
}

// ─── Hazards (Spring Boot /api/hazards) ─────────────────────

export async function getHotspots() {
  return request(springApiUrl('/hazards'))
}

export async function reportHazard({ latitude, longitude, hazardType, severity, description }) {
  return request(springApiUrl('/hazards'), {
    method: 'POST',
    body: JSON.stringify({ latitude, longitude, hazardType, severity, description }),
  })
}

// ─── Accident Blackspots (ML service → /ml/blackspots) ──────

export async function getBlackspots(riskFilter = null) {
  const params = riskFilter ? `?risk=${riskFilter}` : ''
  return request(mlApiUrl(`/blackspots${params}`))
}

// ─── Admin Stats (Spring Boot /api/admin) ────────────────────

export async function getAdminStats() {
  return request(springApiUrl('/admin/stats'))
}

// ─── Admin: Users ────────────────────────────────────────────

export async function adminGetUsers() {
  return request(springApiUrl('/admin/users'))
}

export async function adminActivateUser(id) {
  return request(springApiUrl(`/admin/users/${id}/activate`), { method: 'PUT' })
}

export async function adminDeactivateUser(id) {
  return request(springApiUrl(`/admin/users/${id}/deactivate`), { method: 'PUT' })
}

export async function adminDeleteUser(id) {
  return request(springApiUrl(`/admin/users/${id}`), { method: 'DELETE' })
}

// ─── Admin: Blackspots ───────────────────────────────────────

export async function adminGetBlackspots() {
  return request(springApiUrl('/admin/blackspots'))
}

export async function adminAddBlackspot(data) {
  return request(springApiUrl('/admin/blackspots'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function adminUpdateBlackspot(id, data) {
  return request(springApiUrl(`/admin/blackspots/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function adminDeleteBlackspot(id) {
  return request(springApiUrl(`/admin/blackspots/${id}`), { method: 'DELETE' })
}

// ─── Admin: Hazards ──────────────────────────────────────────

export async function adminGetHazards() {
  return request(springApiUrl('/admin/hazards'))
}

export async function adminAddHazard(data) {
  return request(springApiUrl('/admin/hazards'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function adminUpdateHazard(id, data) {
  return request(springApiUrl(`/admin/hazards/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function adminDeleteHazard(id) {
  return request(springApiUrl(`/admin/hazards/${id}`), { method: 'DELETE' })
}

export async function adminResolveHazard(id) {
  return request(springApiUrl(`/admin/hazards/${id}/resolve`), { method: 'PUT' })
}
