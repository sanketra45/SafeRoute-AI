import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import MainLayout from './components/MainLayout'
import MapPage from './pages/MapPage'
import NavigatePage from './pages/NavigatePage'
import RiskAnalysisPage from './pages/RiskAnalysisPage'
import LeaderboardPage from './pages/LeaderboardPage'
import AdminPage from './pages/AdminPage'

function AppInner() {
  const { user, logout } = useAuth()
  const [page, setPage] = useState('login')
  const [activePage, setActivePage] = useState('map')

  const handleLogin = () => { setPage('app'); setActivePage('map') }
  const handleRegister = () => { setPage('app'); setActivePage('map') }
  const handleLogout = () => { logout(); setPage('login') }

  if (!user) {
    if (page === 'register') {
      return <RegisterPage onRegister={handleRegister} onLogin={() => setPage('login')} />
    }
    return <LoginPage onLogin={handleLogin} onRegister={() => setPage('register')} />
  }

  // Role-based page guard
  const safeActivePage = activePage === 'admin' && user.role !== 'admin' ? 'map' : activePage

  const pageMap = {
    map: <MapPage />,
    navigate: <NavigatePage />,
    risk: <RiskAnalysisPage />,
    leaderboard: <LeaderboardPage />,
    admin: user.role === 'admin' ? <AdminPage /> : <MapPage />,
  }

  return (
    <MainLayout activePage={safeActivePage} setActivePage={setActivePage} onLogout={handleLogout}>
      {pageMap[safeActivePage] || <MapPage />}
    </MainLayout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
