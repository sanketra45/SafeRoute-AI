/**
 * SafeRoute AI — API Service
 * /api/* → Spring Boot (port 8080) via Vite proxy
 * /ml/*  → Python ML service (port 5001) via Vite proxy
 */

const API_BASE = '/api'
const ML_BASE  = '/ml'

// ─── Helpers ──────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('saferoute_token')
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
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── Auth (Spring Boot /api/auth) ──────────────────────────

export async function login(email, password) {
  const data = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (data.token) localStorage.setItem('saferoute_token', data.token)
  return data
}

export async function register({ name, email, password }) {
  const data = await request(`${API_BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
  if (data.token) localStorage.setItem('saferoute_token', data.token)
  return data
}

export function logout() {
  localStorage.removeItem('saferoute_token')
}

// ─── Risk Prediction (ML service → /ml/predict-risk) ───────

/**
 * @param {Object} params
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {string} params.timeOfDay   - MORNING_PEAK | DAY | EVENING_PEAK | NIGHT
 * @param {string} params.weatherCondition - CLEAR | RAIN | FOG | CLOUDY | HAZE
 * @param {string} params.trafficDensity   - LOW | MEDIUM | HIGH
 * @param {string} params.roadType         - MAIN_ROAD | HIGHWAY | JUNCTION | FLYOVER | RING_ROAD | URBAN
 * @returns {{ riskLevel: string, confidence: number, message: string }}
 */
export async function predictRisk(params) {
  return request(`${ML_BASE}/predict-risk`, {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ─── Route Planning (Spring Boot → ML service) ─────────────
// Spring Boot enriches the request with TomTom/OpenWeather data, keeping both
// provider keys off the client.

/**
 * @param {{ originLat, originLon, destLat, destLon }} params
 * @returns {{ safeRoute, fastRoute, safeDistance, fastDistance, safeRiskScore, fastRiskScore, message }}
 */
export async function getSafeRoute(params) {
  return request(`${API_BASE}/safe-route`, {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ─── Geocoding (ML service → /ml/geocode) ──────────────────

export async function geocode(query, limit = 8) {
  const params = new URLSearchParams({ q: query, limit })
  return request(`${ML_BASE}/geocode?${params}`)
}

// ─── ML Health Check ────────────────────────────────────────

export async function mlHealth() {
  return request(`${ML_BASE}/health`)
}

// ─── Leaderboard (Spring Boot /api/leaderboard) ─────────────

export async function getLeaderboard() {
  return request(`${API_BASE}/leaderboard`)
}

// ─── Driver Profile (Spring Boot /api/profile) ──────────────

export async function getProfile() {
  return request(`${API_BASE}/profile`)
}

export async function updateProfile(data) {
  return request(`${API_BASE}/profile`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// ─── Admin Stats (Spring Boot /api/admin) ────────────────────

export async function getAdminStats() {
  return request(`${API_BASE}/admin/stats`)
}

export async function getHotspots() {
  return request(`${API_BASE}/admin/hotspots`)
}

// ─── Shared hazard map (Spring Boot + WebSocket) ─────────────

export async function getHazards() {
  return request(`${API_BASE}/hazards`)
}

export async function reportHazard(params) {
  return request(`${API_BASE}/hazards`, { method: 'POST', body: JSON.stringify(params) })
}

export async function deleteHazard(id) {
  const token = getToken()
  const res = await fetch(`${API_BASE}/hazards/${id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`)
}
