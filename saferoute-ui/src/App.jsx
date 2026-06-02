import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import MainLayout from './components/MainLayout'
import MapPage from './pages/MapPage'
import NavigatePage from './pages/NavigatePage'
import RiskAnalysisPage from './pages/RiskAnalysisPage'
import LeaderboardPage from './pages/LeaderboardPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  const [page, setPage] = useState('login')
  const [activePage, setActivePage] = useState('map')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const handleLogin = () => { setIsLoggedIn(true); setPage('app') }
  const handleRegister = () => { setIsLoggedIn(true); setPage('app') }
  const handleLogout = () => { setIsLoggedIn(false); setPage('login') }

  if (page === 'login') {
    return <LoginPage onLogin={handleLogin} onRegister={() => setPage('register')} />
  }
  if (page === 'register') {
    return <RegisterPage onRegister={handleRegister} onLogin={() => setPage('login')} />
  }

  const pageMap = {
    map: <MapPage />,
    navigate: <NavigatePage />,
    risk: <RiskAnalysisPage />,
    leaderboard: <LeaderboardPage />,
    admin: <AdminPage />,
  }

  return (
    <MainLayout activePage={activePage} setActivePage={setActivePage} onLogout={handleLogout}>
      {pageMap[activePage] || <MapPage />}
    </MainLayout>
  )
}
