import { useState, useEffect, useCallback } from 'react'
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
    <div className="admin-page">
      <div className="admin-header">
        <h2>🔧 Admin Dashboard</h2>
        <div className="admin-tabs">
          <button
            className={`admin-tab ${tab === 'users' ? 'active' : ''}`}
            onClick={() => setTab('users')}
          >
            👥 Users ({users.length})
          </button>
          <button
            className={`admin-tab ${tab === 'apps' ? 'active' : ''}`}
            onClick={() => setTab('apps')}
          >
            📱 Facebook Apps ({apps.length})
          </button>
        </div>
      </div>

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <div className="admin-section">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>FB ID</th>
                  <th>Ad Account</th>
                  <th>Pages</th>
                  <th>Posts</th>
                  <th>Role</th>
                  <th>Ngày tạo</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <img src={u.avatar_url || 'https://ui-avatars.com/api/?name=' + u.name} alt="" className="user-avatar-sm" />
                        <span>{u.name}</span>
                      </div>
                    </td>
                    <td><code className="text-muted">{u.fb_user_id}</code></td>
                    <td>
                      {u.can_use_ads
                        ? <span className="badge badge-success">✅ {u.ad_account_id}</span>
                        : <span className="badge badge-muted">—</span>
                      }
                    </td>
                    <td>{u.pages_count}</td>
                    <td>{u.posts_count}</td>
                    <td>
                      <span className={`badge ${u.is_admin ? 'badge-admin' : 'badge-user'}`}>
                        {u.is_admin ? '👑 Admin' : '👤 User'}
                      </span>
                    </td>
                    <td className="text-muted">{u.created_at?.split('T')[0]}</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-sm btn-danger" onClick={() => deleteUser(u.id, u.name)}>
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={8} className="empty-row">Chưa có user nào</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── APPS TAB ── */}
      {tab === 'apps' && (
        <div className="admin-section">
          {/* Form thêm/sửa App */}
          <form className="app-form section-card" onSubmit={saveApp}>
            <h3>{editingApp ? '✏️ Sửa Facebook App' : '➕ Thêm Facebook App mới'}</h3>
            <div className="app-form-fields">
              <div className="field-group">
                <label>App ID</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="123456789..."
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
                  placeholder="abc123def456..."
                  value={appForm.app_secret}
                  onChange={e => setAppForm(f => ({ ...f, app_secret: e.target.value }))}
                  required={!editingApp}
                />
              </div>
              <div className="field-group">
                <label>Tên hiển thị</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="My FB App"
                  value={appForm.app_name}
                  onChange={e => setAppForm(f => ({ ...f, app_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="app-form-actions">
              <button type="submit" className="btn-primary" disabled={loading}>
                {editingApp ? '💾 Cập nhật' : '➕ Thêm'}
              </button>
              {editingApp && (
                <button type="button" className="btn-outline" onClick={() => { setEditingApp(null); setAppForm({ app_id: '', app_secret: '', app_name: '' }) }}>
                  Hủy
                </button>
              )}
            </div>
          </form>

          {/* Danh sách Apps */}
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>App Name</th>
                  <th>App ID</th>
                  <th>App Secret</th>
                  <th>Status</th>
                  <th>Ngày tạo</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apps.map(a => (
                  <tr key={a.id}>
                    <td><strong>{a.app_name}</strong></td>
                    <td><code>{a.app_id}</code></td>
                    <td><code className="text-muted">{a.app_secret}</code></td>
                    <td>
                      <span className={`badge ${a.is_active ? 'badge-success' : 'badge-muted'}`}>
                        {a.is_active ? '🟢 Active' : '⏸ Inactive'}
                      </span>
                    </td>
                    <td className="text-muted">{a.created_at?.split('T')[0]}</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-sm btn-outline" onClick={() => startEditApp(a)}>
                          Sửa
                        </button>
                        <button className="btn-sm btn-danger" onClick={() => deleteApp(a.id, a.app_name)}>
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {apps.length === 0 && (
                  <tr><td colSpan={6} className="empty-row">Chưa có Facebook App nào. Hãy thêm App để user có thể đăng nhập.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
