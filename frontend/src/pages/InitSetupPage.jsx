import { useState } from 'react'
import './InitSetupPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function InitSetupPage({ onComplete }) {
  const [appId, setAppId] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [appName, setAppName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API}/api/bootstrap/app`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: appId.trim(),
          app_secret: appSecret.trim(),
          app_name: appName.trim(),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.detail || 'Có lỗi xảy ra')
      } else {
        setSuccess(true)
        setTimeout(() => onComplete(), 1500)
      }
    } catch (err) {
      setError('Không thể kết nối backend. Kiểm tra uvicorn?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="init-page">
      <div className="init-card glass">
        <div className="init-header">
          <span className="init-icon">🚀</span>
          <h1>Cài đặt ban đầu</h1>
          <p className="init-subtitle">
            Chào mừng bạn đến với TowBlock Publisher!<br />
            Để bắt đầu, hãy thêm thông tin Facebook App.
          </p>
        </div>

        <div className="init-steps">
          <div className="init-step">
            <span className="step-num">1</span>
            <div>
              <strong>Tạo Facebook App</strong>
              <p>Truy cập <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">Meta for Developers</a> → Create App → Business → Configure</p>
            </div>
          </div>
          <div className="init-step">
            <span className="step-num">2</span>
            <div>
              <strong>Thêm Facebook Login product</strong>
              <p>Trong App settings → Add Product → Facebook Login → Web</p>
            </div>
          </div>
          <div className="init-step">
            <span className="step-num">3</span>
            <div>
              <strong>Cấu hình OAuth Redirect URI</strong>
              <p>Thêm vào Valid OAuth Redirect URIs:</p>
              <code className="redirect-uri">{API}/api/auth/callback</code>
            </div>
          </div>
        </div>

        <form className="init-form" onSubmit={handleSubmit}>
          <div className="field-group">
            <label>App ID</label>
            <input
              type="text"
              className="text-input"
              placeholder="123456789012345"
              value={appId}
              onChange={e => setAppId(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="field-group">
            <label>App Secret</label>
            <input
              type="password"
              className="text-input"
              placeholder="abc123def456ghi789..."
              value={appSecret}
              onChange={e => setAppSecret(e.target.value)}
              required
            />
            <span className="field-hint">
              Tìm tại App Settings → Basic → App Secret
            </span>
          </div>

          <div className="field-group">
            <label>Tên hiển thị <small>(tùy chọn)</small></label>
            <input
              type="text"
              className="text-input"
              placeholder="My Facebook App"
              value={appName}
              onChange={e => setAppName(e.target.value)}
            />
          </div>

          {error && (
            <div className="alert alert-error">❌ {error}</div>
          )}

          {success && (
            <div className="alert alert-success">
              ✅ Facebook App đã được thêm! Đang chuyển sang trang đăng nhập...
            </div>
          )}

          <button type="submit" className="btn-primary btn-lg" disabled={loading || success}>
            {loading ? (
              <span className="btn-loading"><span className="spinner" />Đang lưu...</span>
            ) : success ? (
              '✅ Đã hoàn tất!'
            ) : (
              '💾 Lưu và tiếp tục'
            )}
          </button>
        </form>

        <div className="init-footer">
          <span>🔒 Thông tin App Secret được lưu an toàn trong database nội bộ</span>
        </div>
      </div>
    </div>
  )
}
