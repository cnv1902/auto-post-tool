import { useState, useEffect } from 'react'
import './LoginPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function LoginPage({ subtitle }) {
  const [appReady, setAppReady] = useState(null) // null=loading, true=has app, false=no backend or no app
  const [noApp, setNoApp] = useState(false) // specifically no FB app configured
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
      <div className="login-card glass">
        <div className="login-logo">
          <span className="login-icon">📣</span>
          <h1>TowBlock Publisher</h1>
          <p className="login-subtitle">{subtitle || 'Facebook Dark Post & Carousel Publisher'}</p>
        </div>

        <div className="login-body">
          <p className="login-desc">
            Đăng nhập bằng tài khoản Facebook để bắt đầu sử dụng.
            Hệ thống sẽ tự động lấy danh sách Fanpage bạn quản lý.
          </p>

          {error && (
            <div className="alert alert-error">
              <span>❌ {error}</span>
            </div>
          )}

          <button
            className="btn-facebook"
            onClick={handleLogin}
            disabled={!appReady}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white" style={{marginRight: 10}}>
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Đăng nhập bằng Facebook
          </button>

          {appReady === false && !noApp && (
            <p className="login-warning">
              ⚠️ Không thể kết nối backend. Kiểm tra uvicorn đang chạy.
            </p>
          )}

          {noApp && (
            <p className="login-warning">
              ⚠️ Chưa cấu hình Facebook App. Admin cần truy cập <a href="/admin" style={{color: 'var(--accent)'}}>/admin</a> để thiết lập.
            </p>
          )}
        </div>

        <div className="login-footer">
          <span>Bảo mật bởi OAuth 2.0</span>
          <span>•</span>
          <span>Token không lưu plaintext</span>
        </div>
      </div>

      <div className="login-bg-decor"></div>
    </div>
  )
}
