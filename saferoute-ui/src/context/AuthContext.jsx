import { createContext, useContext, useState, useEffect } from 'react'
import * as api from '../services/api'

const AuthContext = createContext(null)

function getSession() {
  try {
    const raw = localStorage.getItem('saferoute_session')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(user) {
  if (user) {
    localStorage.setItem('saferoute_session', JSON.stringify(user))
  } else {
    localStorage.removeItem('saferoute_session')
    localStorage.removeItem('saferoute_token')
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSession())
  const [error, setError] = useState(null)

  // On mount, validate existing session still has a valid token
  useEffect(() => {
    const token = localStorage.getItem('saferoute_token') || user?.token
    if (!token && user) {
      // Session without token — clear it
      setUser(null)
      saveSession(null)
    } else if (token && !localStorage.getItem('saferoute_token')) {
      localStorage.setItem('saferoute_token', token)
    }
  }, [user])

  const login = async (email, password) => {
    setError(null)
    try {
      const data = await api.login(email, password)
      // Normalize role: backend returns "ROLE_ADMIN" or "ROLE_USER"
      const role = data.role === 'ROLE_ADMIN' ? 'admin' : 'user'
      const session = {
        id: data.userId,
        name: data.name,
        email: data.email,
        role,
        token: data.token,
      }
      setUser(session)
      saveSession(session)
      return true
    } catch (err) {
      setError(err.message || 'Login failed.')
      return false
    }
  }

  const register = async (name, email, password) => {
    setError(null)
    try {
      await api.register({ name, email, password })
      // After registration, log in automatically
      return await login(email, password)
    } catch (err) {
      setError(err.message || 'Registration failed.')
      return false
    }
  }

  const logout = () => {
    api.logout()
    setUser(null)
    saveSession(null)
    setError(null)
  }

  const clearError = () => setError(null)

  return (
    <AuthContext.Provider value={{ user, login, register, logout, error, clearError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
