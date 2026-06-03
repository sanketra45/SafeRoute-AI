import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

// Simple hash (btoa) for demo — not for production
const hashPassword = (pw) => btoa(pw + '_saferoute_salt')

// Hardcoded admin seed
const ADMIN_SEED = {
  id: 'admin-001',
  name: 'System Admin',
  email: 'admin@saferoute.in',
  passwordHash: hashPassword('Admin@123'),
  role: 'admin',
  createdAt: new Date().toISOString(),
  score: 100,
}

function getUsers() {
  try {
    const raw = localStorage.getItem('saferoute_users')
    const users = raw ? JSON.parse(raw) : []
    // Ensure admin seed always exists
    if (!users.find((u) => u.email === ADMIN_SEED.email)) {
      users.push(ADMIN_SEED)
      localStorage.setItem('saferoute_users', JSON.stringify(users))
    }
    return users
  } catch {
    return [ADMIN_SEED]
  }
}

function saveUsers(users) {
  localStorage.setItem('saferoute_users', JSON.stringify(users))
}

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
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSession())
  const [error, setError] = useState(null)

  // Initialize users store with admin seed on first load
  useEffect(() => { getUsers() }, [])

  const login = (email, password) => {
    setError(null)
    const users = getUsers()
    const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase())
    if (!found) {
      setError('No account found with this email.')
      return false
    }
    if (found.passwordHash !== hashPassword(password)) {
      setError('Incorrect password.')
      return false
    }
    const session = { id: found.id, name: found.name, email: found.email, role: found.role, score: found.score }
    setUser(session)
    saveSession(session)
    return true
  }

  const register = (name, email, password) => {
    setError(null)
    const users = getUsers()
    if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      setError('An account with this email already exists.')
      return false
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return false
    }
    const newUser = {
      id: `user-${Date.now()}`,
      name,
      email,
      passwordHash: hashPassword(password),
      role: 'user',
      createdAt: new Date().toISOString(),
      score: 75,
    }
    users.push(newUser)
    saveUsers(users)
    const session = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, score: newUser.score }
    setUser(session)
    saveSession(session)
    return true
  }

  const logout = () => {
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
