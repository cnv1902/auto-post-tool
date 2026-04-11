import { useState, useEffect } from 'react'
import './PostsPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getAuthHeaders() {
  const token = localStorage.getItem('autopost_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function PostsPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  async function fetchPosts() {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/posts`, { headers: getAuthHeaders() })
      const data = await res.json()
      setPosts(data.posts || [])
    } catch (err) {
      console.error('Failed to fetch posts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPosts() }, [])

  // Filter posts by search term
  const filtered = posts.filter(p => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      p.message?.toLowerCase().includes(term) ||
      p.page_name?.toLowerCase().includes(term) ||
      p.post_id?.toLowerCase().includes(term)
    )
  })

  function toggleSelect(postId) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(p => p.post_id)))
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`Bạn có chắc muốn xóa ${selected.size} bài viết?`)) return

    setDeleting(true)
    try {
      const res = await fetch(`${API}/api/posts/bulk`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_ids: Array.from(selected) }),
      })
      const data = await res.json()
      console.log('Bulk delete result:', data)
      setSelected(new Set())
      await fetchPosts()
    } catch (err) {
      console.error('Bulk delete failed:', err)
      alert('Xóa thất bại: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleDeleteSingle(postId) {
    if (!confirm('Xóa bài viết này?')) return
    try {
      await fetch(`${API}/api/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      setSelected(prev => { const n = new Set(prev); n.delete(postId); return n })
      await fetchPosts()
    } catch (err) {
      alert('Xóa thất bại: ' + err.message)
    }
  }

  function formatDate(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="posts-page">
      {/* Header bar */}
      <div className="posts-header glass">
        <div className="posts-header-left">
          <h2 className="posts-title">📋 Quản lý bài viết</h2>
          <span className="posts-count">{posts.length} bài viết</span>
        </div>
        <div className="posts-header-right">
          <div className="posts-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="posts-search"
              placeholder="Tìm kiếm bài viết..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            className="btn-refresh"
            onClick={fetchPosts}
            disabled={loading}
            title="Tải lại"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="posts-bulk-bar">
          <span className="bulk-count">✓ Đã chọn {selected.size} bài viết</span>
          <button
            className="btn-bulk-delete"
            onClick={handleBulkDelete}
            disabled={deleting}
          >
            {deleting ? (
              <span className="btn-loading"><span className="spinner" />Đang xóa...</span>
            ) : (
              '🗑️ Xóa đã chọn'
            )}
          </button>
          <button className="btn-bulk-cancel" onClick={() => setSelected(new Set())}>
            Bỏ chọn tất cả
          </button>
        </div>
      )}

      {/* Posts list */}
      {loading ? (
        <div className="posts-loading">
          <span className="spinner" />
          <span>Đang tải...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="posts-empty glass">
          <span className="posts-empty-icon">{searchTerm ? '🔍' : '📭'}</span>
          <span className="posts-empty-text">
            {searchTerm ? 'Không tìm thấy bài viết phù hợp' : 'Chưa có bài viết nào được đăng'}
          </span>
          {!searchTerm && (
            <span className="posts-empty-hint">
              Bài viết sẽ xuất hiện ở đây sau khi bạn đăng bài thành công.
            </span>
          )}
        </div>
      ) : (
        <div className="posts-table-wrap glass">
          <table className="posts-table">
            <thead>
              <tr>
                <th className="th-check">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="posts-checkbox"
                  />
                </th>
                <th>Bài viết</th>
                <th>Fanpage</th>
                <th>Trạng thái</th>
                <th>Ngày đăng</th>
                <th className="th-actions">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(post => (
                <tr
                  key={post.post_id}
                  className={selected.has(post.post_id) ? 'row-selected' : ''}
                >
                  <td className="td-check">
                    <input
                      type="checkbox"
                      checked={selected.has(post.post_id)}
                      onChange={() => toggleSelect(post.post_id)}
                      className="posts-checkbox"
                    />
                  </td>
                  <td className="td-message">
                    <div className="post-message-preview">
                      {post.message
                        ? post.message.length > 80
                          ? post.message.slice(0, 80) + '...'
                          : post.message
                        : '(Không có caption)'}
                    </div>
                    <div className="post-id-small">ID: {post.post_id}</div>
                  </td>
                  <td>
                    <span className="page-name-badge">{post.page_name || 'N/A'}</span>
                  </td>
                  <td>
                    <span className={`status-badge status-${post.status}`}>
                      {post.status === 'published' ? '✅ Đã đăng' : post.status}
                    </span>
                  </td>
                  <td className="td-date">{formatDate(post.created_at)}</td>
                  <td className="td-actions">
                    {post.permalink && (
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-view"
                        title="Xem trên Facebook"
                      >
                        🔗
                      </a>
                    )}
                    <button
                      className="btn-delete-single"
                      onClick={() => handleDeleteSingle(post.post_id)}
                      title="Xóa bài viết"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
