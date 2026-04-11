import { useState } from 'react'
import {
  KeyRound, FileText, CheckCircle2, ChevronRight,
  UserCircle2, AppWindow, Loader2, AlertCircle, CopyCheck
} from 'lucide-react'
import './SetupPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getAuthHeaders() {
  const token = localStorage.getItem('autopost_token')
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
          setTimeout(() => onConfigured(), 1500)
        }
      }
    } catch (err) {
      setError('Không thể kết nối backend. Kiểm tra uvicorn đang chạy?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="setup-page animate-fade-in-up">
      <div className="setup-card glass-elevated">
        <div className="setup-header">
          <div className="setup-icon-wrap">
            <KeyRound size={32} strokeWidth={2} />
          </div>
          <h2>Cấu hình Token Facebook</h2>
          <p className="setup-desc">
            Vui lòng cung cấp User Access Token và Ad Account ID để hệ thống có thể đăng bài dưới dạng Dark Post trên các Fanpage của bạn.
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
              {' '}— đảm bảo tick các quyền: <code>ads_management</code>, <code>pages_show_list</code>
            </span>
          </div>

          <div className="field-group">
            <label htmlFor="ad-account">Ad Account ID</label>
            <input
              id="ad-account"
              type="text"
              className="text-input"
              placeholder="act_123456789012345"
              value={adAccountId}
              onChange={e => setAdAccountId(e.target.value)}
              required
            />
            <span className="field-hint">Bắt buộc phải có tiền tố <code>act_</code></span>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <span className="btn-loading"><Loader2 size={18} className="spin-icon" />Đang xác thực & đồng bộ...</span>
            ) : (
              <><CheckCircle2 size={18}/> Xác thực & Lấy danh sách Fanpage</>
            )}
          </button>
        </form>

        {error && (
          <div className="alert alert-error mt-3">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="setup-result mt-4">
            <h3 className="result-title">Kết quả kết nối</h3>
            
            <div className="result-user">
              <div className="user-icon"><UserCircle2 size={24} /></div>
              <div className="user-info">
                <strong>{result.user.name}</strong>
                <span>ID: {result.user.id}</span>
              </div>
              <div className="status-success"><CheckCircle2 size={18} /> Kết nối thành công</div>
            </div>

            <div className="pages-list-container">
              <div className="pages-list-header">
                <span className="pages-count">
                  <AppWindow size={16} /> Tìm thấy {result.total} Fanpage
                </span>
                {result.total > 0 && (
                  <span className="badge badge-success slide-in-text">
                    <Loader2 size={12} className="spin-icon"/> Đang chuyển hướng...
                  </span>
                )}
              </div>
              
              <div className="pages-list">
                {result.pages.map(p => (
                  <div key={p.page_id} className="page-item">
                    <div className="page-icon"><FileText size={18} /></div>
                    <div className="page-info">
                      <strong>{p.page_name}</strong>
                      <small>ID: {p.page_id}</small>
                    </div>
                    <CopyCheck size={18} className="page-check" />
                  </div>
                ))}
                {result.pages.length === 0 && (
                   <div className="empty-pages">
                     <AlertCircle size={24} opacity={0.5}/>
                     <p>Không có Fanpage nào được tìm thấy. Vui lòng kiểm tra lại quyền của Token.</p>
                   </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
