import { useState, useEffect, useCallback } from 'react'
import {
  Megaphone, Settings, PenSquare, LayoutList, Lock,
  LogOut, Wrench, ArrowLeft, ShieldCheck, Loader2,
  KeyRound, ArrowRight
} from 'lucide-react'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import PublishPage from './pages/PublishPage'
import PostsPage from './pages/PostsPage'
import AdminPage from './pages/AdminPage'
import './App.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * Routing:
 *   /       → UserApp  (login Facebook → publish/manage)
 *   /admin  → AdminApp (login password → admin panel)
 */
export default function App() {
  const isAdminRoute = window.location.pathname === '/admin'
  if (isAdminRoute) return <AdminApp />
  return <UserApp />
}


// ═══════════════════════════════════════════════════
//  USER APP — Trang chính: Facebook OAuth
//  JWT lưu trong localStorage, chỉ xóa khi backend trả lỗi
// ═══════════════════════════════════════════════════
function UserApp() {
  const [currentUser, setCurrentUser] = useState(null) // null=loading, false=not logged in
  const [tab, setTab] = useState('publish')
  const [configured, setConfigured] = useState(false)
  const [pagesCount, setPagesCount] = useState(0)

  // Helper: lấy token từ localStorage
  const getToken = () => localStorage.getItem('autopost_token')
  const getHeaders = () => {
    const t = getToken()
    return t ? { Authorization: `Bearer ${t}` } : {}
  }

  // Check auth — chỉ xóa session khi backend TRẢ LỖI (401)
  const checkAuth = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setCurrentUser(false)
      return
    }
    try {
      const res = await fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        setCurrentUser(await res.json())
      } else {
        // Backend trả lỗi → xóa phiên
        localStorage.removeItem('autopost_token')
        setCurrentUser(false)
      }
    } catch {
      // Network error → giữ nguyên session, thử lại sau
      if (token) setCurrentUser(false)
    }
  }, [])

  useEffect(() => {
    // Check return from OAuth callback
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      localStorage.setItem('autopost_token', token)
      window.history.replaceState({}, '', '/')
    }
    const authError = params.get('auth_error')
    if (authError) {
      window.history.replaceState({}, '', '/')
    }
    checkAuth()
  }, [checkAuth])

  const checkConfig = useCallback(async () => {
    if (!currentUser) return
    try {
      const res = await fetch(`${API}/api/config`, { headers: getHeaders() })
      if (res.ok) {
        const d = await res.json()
        setConfigured(d.has_token && d.pages_count > 0)
        setPagesCount(d.pages_count || 0)
      }
    } catch {}
  }, [currentUser])

  useEffect(() => { checkConfig() }, [checkConfig])

  const handleLogout = () => {
    localStorage.removeItem('autopost_token')
    setCurrentUser(false)
  }

  useEffect(() => {
    if (configured && tab === 'setup') setTab('publish')
  }, [configured])

  // Loading
  if (currentUser === null) {
    return (
      <div className="app">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
          <Loader2 size={28} className="spin-icon" style={{ color: 'var(--accent)' }} />
        </div>
      </div>
    )
  }

  // Not logged in → Facebook login
  if (currentUser === false) return <LoginPage />

  // Logged in
  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <Megaphone size={20} />
          </div>
          <span className="logo-text">Auto Post Tool</span>
        </div>
        <nav className="tabs">
          <button className={`tab-btn ${tab === 'setup' ? 'active' : ''}`} onClick={() => setTab('setup')}>
            <Settings size={16} />
            <span>Cấu hình</span>
          </button>
          <button
            className={`tab-btn ${tab === 'publish' ? 'active' : ''}`}
            onClick={() => setTab('publish')}
            disabled={!configured}
          >
            <PenSquare size={16} />
            <span>Đăng bài</span>
            {!configured && <Lock size={12} className="tab-lock" />}
          </button>
          <button
            className={`tab-btn ${tab === 'posts' ? 'active' : ''}`}
            onClick={() => setTab('posts')}
            disabled={!configured}
          >
            <LayoutList size={16} />
            <span>Quản lý</span>
            {!configured && <Lock size={12} className="tab-lock" />}
          </button>
        </nav>
        <div className="header-user">
          <img
            src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.name}`}
            alt=""
            className="header-avatar"
          />
          <span className="header-name">{currentUser.name}</span>
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={14} />
            <span>Thoát</span>
          </button>
        </div>
      </header>
      <main className="app-main">
        {tab === 'setup' && <SetupPage onConfigured={() => { setConfigured(true); setTab('publish') }} onRefresh={checkConfig} />}
        {tab === 'publish' && configured && <PublishPage />}
        {tab === 'posts' && configured && <PostsPage />}
      </main>
      <footer className="app-footer">
        <span>Auto Post Tool v2.0 • Multi-User Facebook Publisher</span>
      </footer>
    </div>
  )
}


// ═══════════════════════════════════════════════════
//  ADMIN APP — Trang /admin: Login bằng password
//  Hoàn toàn độc lập, KHÔNG cần Facebook OAuth
// ═══════════════════════════════════════════════════
function AdminApp() {
  const [state, setState] = useState('loading') // 'loading' | 'login' | 'authenticated'
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [logging, setLogging] = useState(false)

  const getAdminToken = () => localStorage.getItem('autopost_admin_token')

  useEffect(() => {
    // Verify existing admin token
    const token = getAdminToken()
    if (!token) { setState('login'); return }
    fetch(`${API}/api/admin/verify`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.ok) setState('authenticated')
        else { localStorage.removeItem('autopost_admin_token'); setState('login') }
      })
      .catch(() => setState('login'))
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLogging(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (res.ok && data.token) {
        localStorage.setItem('autopost_admin_token', data.token)
        setState('authenticated')
      } else {
        setError(data.detail || 'Sai mật khẩu')
      }
    } catch {
      setError('Không thể kết nối backend')
    } finally {
      setLogging(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('autopost_admin_token')
    setState('login')
  }

  if (state === 'loading') {
    return (
      <div className="app">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <Loader2 size={28} className="spin-icon" style={{ color: 'var(--accent)' }} />
        </div>
      </div>
    )
  }

  if (state === 'login') {
    return (
      <div className="login-page">
        <div className="login-bg">
          <div className="login-orb login-orb-1" />
          <div className="login-orb login-orb-2" />
          <div className="login-grid-overlay" />
        </div>
        <div className="login-container">
          <div className="login-card glass-elevated">
            <div className="login-logo">
              <div className="login-logo-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                <Wrench size={28} />
              </div>
              <h1 className="login-title">Admin Panel</h1>
              <p className="login-subtitle">Quản trị hệ thống</p>
            </div>
            <form className="login-body" onSubmit={handleLogin}>
              <div className="field-group">
                <label htmlFor="admin-pw">Mật khẩu quản trị</label>
                <input
                  id="admin-pw"
                  type="password"
                  className="text-input"
                  placeholder="Nhập mật khẩu..."
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              {error && (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              )}
              <button type="submit" className="btn-primary" disabled={logging}>
                {logging ? (
                  <span className="btn-loading"><Loader2 size={18} className="spin-icon" />Đang xác thực...</span>
                ) : (
                  <><KeyRound size={18} /> Đăng nhập</>
                )}
              </button>
              <div style={{ textAlign: 'center' }}>
                <a href="/" className="login-back-link">
                  <ArrowLeft size={14} />
                  <span>Về trang chính</span>
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Authenticated admin
  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
            <Wrench size={20} />
          </div>
          <span className="logo-text">Admin Panel</span>
        </div>
        <nav className="tabs">
          <a href="/" className="tab-btn">
            <ArrowLeft size={16} />
            <span>Trang chính</span>
          </a>
        </nav>
        <div className="header-user">
          <span className="header-admin-badge">
            <ShieldCheck size={12} />
            Admin
          </span>
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={14} />
            <span>Thoát</span>
          </button>
        </div>
      </header>
      <main className="app-main">
        <AdminPage />
      </main>
      <footer className="app-footer">
        <span>Auto Post Tool v2.0 • Admin Dashboard</span>
      </footer>
    </div>
  )
}
