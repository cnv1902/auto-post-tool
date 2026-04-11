import { useState, useEffect, useCallback } from 'react'
import {
  Users, Smartphone, Plus, Settings2, Trash2, Edit3, Shield, UserCircle2,
  CalendarDays, Activity, Globe, RefreshCcw, Lock
} from 'lucide-react'
import './AdminPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getAuthHeaders() {
  const token = localStorage.getItem('autopost_admin_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function AdminPage() {
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(false)

  // App form state
  const [appForm, setAppForm] = useState({ app_id: '', app_secret: '', app_name: '' })
  const [editingApp, setEditingApp] = useState(null)

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/users`, { headers: getAuthHeaders() })
      if (res.ok) {
        const d = await res.json()
        setUsers(d.users)
      }
    } catch {}
  }, [])

  const fetchApps = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/apps`, { headers: getAuthHeaders() })
      if (res.ok) {
        const d = await res.json()
        setApps(d.apps)
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchApps()
  }, [fetchUsers, fetchApps])

  // ── User actions ──

  const deleteUser = async (userId, name) => {
    if (!confirm(`Xóa user "${name}" và tất cả dữ liệu liên quan?`)) return
    await fetch(`${API}/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    fetchUsers()
  }

  // ── App actions ──
  const saveApp = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (editingApp) {
        await fetch(`${API}/api/admin/apps/${editingApp}`, {
          method: 'PUT',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(appForm),
        })
      } else {
        await fetch(`${API}/api/admin/apps`, {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(appForm),
        })
      }
      setAppForm({ app_id: '', app_secret: '', app_name: '' })
      setEditingApp(null)
      fetchApps()
    } finally {
      setLoading(false)
    }
  }

  const deleteApp = async (appDbId, name) => {
    if (!confirm(`Xóa Facebook App "${name}"?`)) return
    await fetch(`${API}/api/admin/apps/${appDbId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    fetchApps()
  }

  const startEditApp = (app) => {
    setEditingApp(app.id)
    setAppForm({ app_id: app.app_id, app_secret: '', app_name: app.app_name })
  }

  return (
    <div className="admin-page animate-fade-in-up">
      <div className="admin-header glass-elevated">
        <div className="admin-header-title">
           <Settings2 size={24} className="text-accent"/>
           <h2>Quản trị hệ thống</h2>
        </div>
        <div className="admin-tabs">
          <button
            className={`admin-tab ${tab === 'users' ? 'active' : ''}`}
            onClick={() => setTab('users')}
          >
            <Users size={16} />
            Người dùng <span className="tab-badge">{users.length}</span>
          </button>
          <button
            className={`admin-tab ${tab === 'apps' ? 'active' : ''}`}
            onClick={() => setTab('apps')}
          >
            <Smartphone size={16} />
            Facebook Apps <span className="tab-badge">{apps.length}</span>
          </button>
        </div>
      </div>

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <div className="admin-section animate-fade-in">
          <div className="admin-table-wrapper glass">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Facebook ID</th>
                  <th>Ad Account</th>
                  <th><Globe size={14}/> Pages</th>
                  <th><Activity size={14}/> Bài đăng</th>
                  <th>Phân quyền</th>
                  <th><CalendarDays size={14}/> Đăng ký lúc</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <img src={u.avatar_url || 'https://ui-avatars.com/api/?name=' + u.name} alt="" className="user-avatar-sm" />
                        <strong>{u.name}</strong>
                      </div>
                    </td>
                    <td><code className="text-muted">{u.fb_user_id}</code></td>
                    <td>
                      {u.can_use_ads
                        ? <span className="badge badge-success"><CheckCircle2 size={12}/> {u.ad_account_id}</span>
                        : <span className="badge badge-muted">—</span>
                      }
                    </td>
                    <td><strong>{u.pages_count}</strong></td>
                    <td><strong>{u.posts_count}</strong></td>
                    <td>
                      <span className={`badge ${u.is_admin ? 'badge-admin' : 'badge-user'}`}>
                        {u.is_admin ? <><Shield size={12}/> Admin</> : <><UserCircle2 size={12}/> User</>}
                      </span>
                    </td>
                    <td className="text-muted">{u.created_at?.split('T')[0]}</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-icon-action danger" onClick={() => deleteUser(u.id, u.name)} title="Xóa người dùng">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={8} className="empty-row">Chưa có người dùng nào (ngoài admin mặc định)</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── APPS TAB ── */}
      {tab === 'apps' && (
        <div className="admin-section animate-fade-in">
          {/* Form thêm/sửa App */}
          <form className="app-form section-card glass" onSubmit={saveApp}>
            <h3 className="section-title">
                {editingApp ? <Edit3 size={18}/> : <Plus size={18}/>}
                <span>{editingApp ? 'Sửa thông tin Facebook App' : 'Thêm Facebook App mới'}</span>
            </h3>
            <div className="app-form-fields">
              <div className="field-group">
                <label>App ID</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="Ví dụ: 1234567890123"
                  value={appForm.app_id}
                  onChange={e => setAppForm(f => ({ ...f, app_id: e.target.value }))}
                  required
                  disabled={!!editingApp}
                />
              </div>
              <div className="field-group">
                <label>App Secret</label>
                <input
                  type="password"
                  className="text-input"
                  placeholder="Ví dụ: abc123def456..."
                  value={appForm.app_secret}
                  onChange={e => setAppForm(f => ({ ...f, app_secret: e.target.value }))}
                  required={!editingApp}
                />
              </div>
              <div className="field-group">
                <label>Tên hiển thị (Tùy chọn)</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="Ví dụ: Công cụ Đăng Bài"
                  value={appForm.app_name}
                  onChange={e => setAppForm(f => ({ ...f, app_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="app-form-actions">
              <button type="submit" className="btn-primary" disabled={loading} style={{width: 'auto'}}>
                {loading ? <RefreshCcw size={16} className="spin-icon"/> : editingApp ? <Edit3 size={16}/> : <Plus size={16}/>}
                <span>{editingApp ? 'Cập nhật App' : 'Thêm App Mới'}</span>
              </button>
              {editingApp && (
                <button type="button" className="btn-ghost" onClick={() => { setEditingApp(null); setAppForm({ app_id: '', app_secret: '', app_name: '' }) }}>
                  Hủy thao tác
                </button>
              )}
            </div>
          </form>

          {/* Danh sách Apps */}
          <div className="admin-table-wrapper glass">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tên Facebook App</th>
                  <th>App ID</th>
                  <th>App Secret</th>
                  <th>Cấp phép API</th>
                  <th>Ngày tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {apps.map(a => (
                  <tr key={a.id}>
                    <td>
                        <div className="user-cell">
                            <div className="app-icon-placeholder"><Smartphone size={16} /></div>
                            <strong>{a.app_name || '—'}</strong>
                        </div>
                    </td>
                    <td><code className="text-muted">{a.app_id}</code></td>
                    <td>
                        <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
                            <Lock size={12} className="text-muted"/>
                            <code className="text-muted" style={{filter: 'blur(3px)', transition: 'filter 0.2s', cursor: 'pointer'}} onMouseOver={e=>e.currentTarget.style.filter='none'} onMouseOut={e=>e.currentTarget.style.filter='blur(3px)'}>
                                {a.app_secret}
                            </code>
                        </div>
                    </td>
                    <td>
                      <span className={`badge ${a.is_active ? 'badge-success' : 'badge-muted'}`}>
                        {a.is_active ? 'Đã kích hoạt' : 'Chưa kích hoạt'}
                      </span>
                    </td>
                    <td className="text-muted">{a.created_at?.split('T')[0]}</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-icon-action" onClick={() => startEditApp(a)} title="Sửa thông tin">
                          <Edit3 size={16} />
                        </button>
                        <button className="btn-icon-action danger" onClick={() => deleteApp(a.id, a.app_name)} title="Xóa Facebook App">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {apps.length === 0 && (
                  <tr>
                      <td colSpan={6} className="empty-row" style={{padding: '40px 20px !important'}}>
                          <Smartphone size={32} opacity={0.3} style={{marginBottom: 10}}/>
                          <div>Hệ thống chưa có kết nối Facebook App nào.</div>
                      </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function CheckCircle2(props) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
}
