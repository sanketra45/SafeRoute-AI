import { createContext, useContext, useState, useEffect } from 'react'
import { login as apiLogin, register as apiRegister, logout as clearApiToken } from '../services/api'

const AuthContext = createContext(null)

function getSession() {
  try {
    const raw = localStorage.getItem('saferoute_session')
    return raw && localStorage.getItem('saferoute_token') ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(user) {
  if (user) {
    localStorage.setItem('saferoute_session', JSON.stringify(user))
  } else {
    localStorage.removeItem('saferoute_session')
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSession())
  const [error, setError] = useState(null)

  const login = async (email, password) => {
    setError(null)
    try {
      const result = await apiLogin(email, password)
      const session = { id: result.userId, name: result.name, email: result.email,
        role: result.role === 'ROLE_ADMIN' ? 'admin' : 'user', score: result.drivingScore }
      setUser(session); saveSession(session)
      return true
    } catch {
      setError('Email or password is incorrect.')
      return false
    }
  }

  const register = async (name, email, password) => {
    setError(null)
    try {
      await apiRegister({ name, email, password })
      return login(email, password)
    } catch (error) {
      setError(error.message || 'Could not create account.')
      return false
    }
  }

  const logout = () => {
    setUser(null)
    saveSession(null)
    clearApiToken()
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
