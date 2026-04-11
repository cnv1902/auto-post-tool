import { useState, useEffect } from 'react'
import { Shield, Key, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import './LoginPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function FacebookIcon({ size = 24, className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
  )
}

export default function LoginPage({ subtitle }) {
  const [appReady, setAppReady] = useState(null)
  const [noApp, setNoApp] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API}/api/bootstrap/status`)
      .then(r => r.json())
      .then(d => {
        if (d.needs_setup) {
          setAppReady(false)
          setNoApp(true)
        } else {
          setAppReady(true)
        }
      })
      .catch(() => setAppReady(false))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authError = params.get('auth_error')
    if (authError) {
      const messages = {
        'no_code': 'Facebook không trả về mã xác thực. Vui lòng thử lại.',
        'token_exchange_failed': 'Không thể đổi code → token. Kiểm tra App ID/Secret.',
        'invalid_token': 'Token không hợp lệ. Kiểm tra Facebook App settings.',
        'access_denied': 'Bạn đã từ chối quyền truy cập.',
      }
      setError(messages[authError] || `Đăng nhập thất bại: ${authError}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleLogin = () => {
    const next = encodeURIComponent(window.location.pathname)
    window.location.href = `${API}/api/auth/login?next=${next}`
  }

  return (
    <div className="login-page">
      {/* Animated background */}
      <div className="login-bg">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
        <div className="login-grid-overlay" />
      </div>

      <div className="login-container">
        <div className="login-card glass-elevated">
          {/* Logo */}
          <div className="login-logo">
            <div className="login-logo-icon">
              <ArrowRight size={28} strokeWidth={2.5} />
            </div>
            <h1 className="login-title">Auto Post Tool</h1>
            <p className="login-subtitle">
              {subtitle || 'Facebook Publisher & Scheduler'}
            </p>
          </div>

          {/* Body */}
          <div className="login-body">
            <p className="login-desc">
              Đăng nhập bằng tài khoản Facebook để bắt đầu sử dụng.
              Hệ thống sẽ tự động lấy danh sách Fanpage bạn quản lý.
            </p>

            {error && (
              <div className="alert alert-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <button
              className="btn-facebook"
              onClick={handleLogin}
              disabled={!appReady}
            >
              {appReady === null ? (
                <span className="btn-loading">
                  <Loader2 size={20} className="spin-icon" />
                  Đang kiểm tra...
                </span>
              ) : (
                <>
                  <FacebookIcon size={20} />
                  <span>Đăng nhập bằng Facebook</span>
                </>
              )}
            </button>

            {appReady === false && !noApp && (
              <div className="alert alert-warning">
                <AlertCircle size={18} />
                <span>Không thể kết nối backend. Kiểm tra server đang chạy.</span>
              </div>
            )}

            {noApp && (
              <div className="alert alert-warning">
                <AlertCircle size={18} />
                <span>
                  Chưa cấu hình Facebook App. Admin cần truy cập{' '}
                  <a href="/admin">/admin</a> để thiết lập.
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="login-footer">
            <div className="login-trust-item">
              <Shield size={14} />
              <span>OAuth 2.0</span>
            </div>
            <div className="login-trust-divider" />
            <div className="login-trust-item">
              <Key size={14} />
              <span>Token mã hóa</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
