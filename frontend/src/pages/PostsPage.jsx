import { useState, useEffect } from 'react'
import {
  Search, RefreshCw, Trash2, CheckCircle2, Clock, CheckSquare,
  AlertCircle, LayoutList, Calendar, ExternalLink, Inbox, Check
} from 'lucide-react'
import './PostsPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getAuthHeaders() {
  const token = localStorage.getItem('autopost_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function PostsPage() {
  const [posts, setPosts] = useState([])
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPageId, setFilterPageId] = useState('')

  // Load pages list for filter
  useEffect(() => {
    fetch(`${API}/api/pages`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => setPages(d.pages || []))
      .catch(() => {})
  }, [])

  async function fetchPosts() {
    setLoading(true)
    try {
      const qs = filterPageId ? `?page_id=${filterPageId}` : ''
      const res = await fetch(`${API}/api/posts${qs}`, { headers: getAuthHeaders() })
      const data = await res.json()
      setPosts(data.posts || [])
    } catch (err) {
      console.error('Failed to fetch posts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPosts() }, [filterPageId])

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
      const itemsToDelete = Array.from(selected).map(id => {
        const post = posts.find(p => p.post_id === id)
        return { post_id: id, page_id: post?.page_id || '' }
      })

      const res = await fetch(`${API}/api/posts/bulk`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToDelete }),
      })
      await res.json()
      setSelected(new Set())
      await fetchPosts()
    } catch (err) {
      alert('Xóa thất bại: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleDeleteSingle(postId, pageId) {
    if (!confirm('Xóa bài viết này?')) return
    try {
      await fetch(`${API}/api/posts/${encodeURIComponent(postId)}?page_id=${encodeURIComponent(pageId)}`, {
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

  function renderStatus(status) {
    if (status === 'published') return <span className="status-badge status-published"><CheckCircle2 size={12}/> Đã đăng</span>
    if (status === 'scheduled') return <span className="status-badge status-scheduled"><Clock size={12}/> Đã lên lịch</span>
    return <span className="status-badge status-failed"><AlertCircle size={12}/> Lỗi</span>
  }

  return (
    <div className="posts-page animate-fade-in-up">
      {/* Header bar */}
      <div className="posts-header glass">
        <div className="posts-header-left">
          <div className="posts-header-icon"><LayoutList size={20}/></div>
          <h2 className="posts-title">Quản lý bài viết</h2>
          <span className="posts-count badge badge-accent">{posts.length} bài viết</span>
        </div>
        <div className="posts-header-right">
          {/* Page filter */}
          <div className="posts-filter-box">
            <select
              className="select-input posts-filter-select"
              value={filterPageId}
              onChange={e => { setFilterPageId(e.target.value); setSelected(new Set()) }}
            >
              <option value="">Tất cả Fanpage</option>
              {pages.map(p => (
                <option key={p.page_id} value={p.page_id}>{p.page_name}</option>
              ))}
            </select>
          </div>
          <div className="posts-search-box">
            <Search size={16} className="search-icon text-muted" />
            <input
              type="text"
              className="posts-search"
              placeholder="Tìm kiếm bài viết..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            className="btn-icon"
            onClick={fetchPosts}
            disabled={loading}
            title="Tải lại"
          >
            <RefreshCw size={18} className={loading ? 'spin-icon' : ''} />
          </button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="posts-bulk-bar">
          <span className="bulk-count">
            <CheckSquare size={16} /> Đã chọn {selected.size} bài viết
          </span>
          <div className="bulk-actions">
            <button className="btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
              Bỏ chọn tất cả
            </button>
            <button
              className="btn-danger btn-sm"
              onClick={handleBulkDelete}
              disabled={deleting}
              style={{display: 'inline-flex', alignItems: 'center', gap: '6px'}}
            >
              {deleting ? (
                <span className="btn-loading"><span className="spinner" />Đang xóa...</span>
              ) : (
                <><Trash2 size={14}/> Xóa đã chọn</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Posts list */}
      {loading ? (
        <div className="posts-loading">
          <span className="spinner spinner-lg" style={{ color: 'var(--accent)' }}/>
          <span>Đang tải dữ liệu...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="posts-empty glass">
          <div className="posts-empty-icon">
            {searchTerm ? <Search size={48} strokeWidth={1.5} /> : <Inbox size={48} strokeWidth={1.5} />}
          </div>
          <span className="posts-empty-text">
            {searchTerm ? 'Không tìm thấy bài viết phù hợp' : 'Chưa có bài viết nào được đăng'}
          </span>
          {!searchTerm && (
            <span className="posts-empty-hint">
              Bài đăng từ công cụ sẽ được hiển thị và quản lý ở đây.
            </span>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="posts-table-wrap glass desktop-view">
            <table className="posts-table">
              <thead>
                <tr>
                  <th className="th-check">
                    <label className="custom-checkbox">
                        <input
                            type="checkbox"
                            checked={selected.size === filtered.length && filtered.length > 0}
                            onChange={toggleSelectAll}
                        />
                        <span className="checkmark"><Check size={12}/></span>
                    </label>
                  </th>
                  <th>Bài viết</th>
                  <th>Fanpage</th>
                  <th>Trạng thái</th>
                  <th>Ngày đăng</th>
                  <th className="th-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(post => (
                  <tr
                    key={post.post_id}
                    className={selected.has(post.post_id) ? 'row-selected' : ''}
                  >
                    <td className="td-check">
                        <label className="custom-checkbox">
                            <input
                                type="checkbox"
                                checked={selected.has(post.post_id)}
                                onChange={() => toggleSelect(post.post_id)}
                            />
                            <span className="checkmark"><Check size={12}/></span>
                        </label>
                    </td>
                    <td className="td-message">
                      <div className="post-message-preview">
                        {post.message
                          ? post.message.length > 80
                            ? post.message.slice(0, 80) + '...'
                            : post.message
                          : <span className="text-muted italic">(Không có caption)</span>}
                      </div>
                      <div className="post-id-small">ID: {post.post_id}</div>
                    </td>
                    <td>
                      <span className="page-name-badge">{post.page_name || 'N/A'}</span>
                    </td>
                    <td>
                      {renderStatus(post.status)}
                    </td>
                    <td className="td-date">
                      <Calendar size={12}/> {formatDate(post.created_at)}
                    </td>
                    <td className="td-actions">
                      {post.permalink && (
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-icon-action"
                          title="Xem trên Facebook"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                      <button
                        className="btn-icon-action danger"
                        onClick={() => handleDeleteSingle(post.post_id, post.page_id)}
                        title="Xóa bài viết"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="posts-mobile-wrap mobile-view">
             {filtered.map(post => (
                <div key={post.post_id} className={`post-mobile-card glass ${selected.has(post.post_id) ? 'selected' : ''}`}>
                   <div className="post-mobile-header">
                      <label className="custom-checkbox">
                          <input
                              type="checkbox"
                              checked={selected.has(post.post_id)}
                              onChange={() => toggleSelect(post.post_id)}
                          />
                          <span className="checkmark"><Check size={12}/></span>
                      </label>
                      <span className="page-name-badge">{post.page_name || 'N/A'}</span>
                      {renderStatus(post.status)}
                   </div>
                   <div className="post-mobile-body">
                      <div className="post-message-preview">
                        {post.message
                          ? post.message.length > 100
                            ? post.message.slice(0, 100) + '...'
                            : post.message
                          : <span className="text-muted italic">(Không có caption)</span>}
                      </div>
                      <div className="post-mobile-meta">
                         <span className="post-id-small">ID: {post.post_id.slice(0, 15)}...</span>
                         <span className="td-date"><Calendar size={12}/> {formatDate(post.created_at)}</span>
                      </div>
                   </div>
                   <div className="post-mobile-footer">
                      {post.permalink && (
                        <a href={post.permalink} target="_blank" rel="noreferrer" className="btn-ghost btn-sm" style={{flex: 1}}>
                          <ExternalLink size={14} /> Xem bài
                        </a>
                      )}
                      <button className="btn-danger btn-sm" onClick={() => handleDeleteSingle(post.post_id, post.page_id)}>
                        <Trash2 size={14} />
                      </button>
                   </div>
                </div>
             ))}
          </div>
        </>
      )}
    </div>
  )
}
