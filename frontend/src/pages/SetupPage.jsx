import { useState } from 'react'
import './SetupPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getAuthHeaders() {
  const token = localStorage.getItem('towblock_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function SetupPage({ onConfigured }) {
  const [userToken, setUserToken]       = useState('')
  const [adAccountId, setAdAccountId]   = useState('')
  const [loading, setLoading]           = useState(false)
  const [result, setResult]             = useState(null)
  const [error, setError]               = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch(`${API}/api/setup`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_token: userToken.trim(),
          ad_account_id: adAccountId.trim(),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.detail || 'Có lỗi xảy ra')
      } else {
        setResult(data)
        if (data.pages?.length > 0) {
          setTimeout(() => onConfigured(), 1200)
        }
      }
    } catch (err) {
      setError('Không thể kết nối backend. Kiểm tra uvicorn đang chạy?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="setup-page">
      <div className="setup-card glass">
        <div className="setup-header">
          <div className="setup-icon">🔑</div>
          <h2>Cấu hình Token Facebook</h2>
          <p className="setup-desc">
            Nhập thông tin xác thực để hệ thống tự động lấy danh sách Fanpage bạn quản lý.
          </p>
        </div>

        <form className="setup-form" onSubmit={handleSubmit}>
          <div className="field-group">
            <label htmlFor="user-token">User Access Token</label>
            <textarea
              id="user-token"
              className="token-input"
              placeholder="EAANlR4YbDp0BR..."
              value={userToken}
              onChange={e => setUserToken(e.target.value)}
              rows={3}
              required
            />
            <span className="field-hint">
              Lấy tại <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">Graph API Explorer</a>
              &nbsp;— cần quyền: <code>ads_management</code>, <code>pages_show_list</code>
            </span>
          </div>

          <div className="field-group">
            <label htmlFor="ad-account">Ad Account ID</label>
            <input
              id="ad-account"
              type="text"
              className="text-input"
              placeholder="act_435600390407092"
              value={adAccountId}
              onChange={e => setAdAccountId(e.target.value)}
              required
            />
            <span className="field-hint">Dạng <code>act_XXXXXXXXX</code></span>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <span className="btn-loading"><span className="spinner" />Đang xác thực...</span>
            ) : (
              '✨ Xác thực & Lấy Fanpages'
            )}
          </button>
        </form>

        {error && (
          <div className="alert alert-error">
            <span>❌ {error}</span>
          </div>
        )}

        {result && (
          <div className="setup-result">
            <div className="result-user">
              <span className="user-avatar">👤</span>
              <span>{result.user.name} <small>(ID: {result.user.id})</small></span>
            </div>

            <div className="pages-list">
              <div className="pages-list-header">
                <span>📄 {result.total} Fanpage tìm thấy</span>
                {result.total > 0 && (
                  <span className="badge-success">✅ Đang chuyển sang Đăng bài...</span>
                )}
              </div>
              {result.pages.map(p => (
                <div key={p.page_id} className="page-item">
                  <div className="page-icon">📌</div>
                  <div className="page-info">
                    <strong>{p.page_name}</strong>
                    <small>ID: {p.page_id}</small>
                  </div>
                  <span className="page-check">✓</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
