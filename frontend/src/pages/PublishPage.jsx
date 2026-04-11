import { useState, useEffect } from 'react'
import FileUpload from '../components/FileUpload'
import ThumbnailPicker from '../components/ThumbnailPicker'
import PostPreview from '../components/PostPreview'
import LogConsole from '../components/LogConsole'
import './PublishPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getAuthHeaders() {
  const token = localStorage.getItem('towblock_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const CTA_TYPES = [
  { value: 'LEARN_MORE',       label: '📖 Tìm hiểu thêm' },
  { value: 'SHOP_NOW',         label: '🛒 Mua ngay' },
  { value: 'SIGN_UP',          label: '📝 Đăng ký' },
  { value: 'DOWNLOAD',         label: '⬇️ Tải xuống' },
  { value: 'BOOK_NOW',         label: '📅 Đặt lịch' },
  { value: 'CONTACT_US',       label: '📞 Liên hệ' },
  { value: 'GET_QUOTE',        label: '💰 Nhận báo giá' },
  { value: 'GET_OFFER',        label: '🎁 Nhận ưu đãi' },
  { value: 'ORDER_NOW',        label: '📦 Đặt hàng ngay' },
  { value: 'APPLY_NOW',        label: '✅ Ứng tuyển' },
  { value: 'WATCH_MORE',       label: '▶️ Xem thêm' },
  { value: 'LISTEN_NOW',       label: '🎵 Nghe ngay' },
  { value: 'CALL_NOW',         label: '📱 Gọi ngay' },
  { value: 'PLAY_GAME',        label: '🎮 Chơi game' },
  { value: 'USE_APP',          label: '📲 Dùng ứng dụng' },
  { value: 'SEND_MESSAGE',     label: '💬 Nhắn tin' },
  { value: 'WHATSAPP_MESSAGE', label: '💚 Nhắn WhatsApp' },
  { value: 'SUBSCRIBE',        label: '🔔 Đăng ký theo dõi' },
  { value: 'NO_BUTTON',        label: '⛔ Không có nút' },
]

const DEFAULT_FORM = {
  pageId:     '',
  message:    'POV: Bạn đang cãi lộn nhưng không còn biết phải đáp trả thế nào nữa.',
  safeLink:   'https://shopee.vn',
  card1Title: 'Chi tiết sản phẩm 👉',
  card1Desc:  '',
  card1Cta:   'LEARN_MORE',
  card2Title: 'Xem thêm tại đây 👉',
  card2Desc:  '',
  card2Cta:   'LEARN_MORE',
}

export default function PublishPage() {
  const [pages, setPages]                   = useState([])
  const [form, setForm]                     = useState(DEFAULT_FORM)
  const [videoFile, setVideoFile]           = useState(null)
  const [thumbnailFile, setThumbnailFile]   = useState(null)
  const [imageFile, setImageFile]           = useState(null)
  const [logs, setLogs]                     = useState([])
  const [publishing, setPublishing]         = useState(false)
  const [done, setDone]                     = useState(false)
  const [permalink, setPermalink]           = useState(null)

  useEffect(() => {
    fetch(`${API}/api/pages`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => {
        setPages(d.pages || [])
        if (d.pages?.length > 0) setForm(f => ({ ...f, pageId: d.pages[0].page_id }))
      })
      .catch(() => setLogs([{ level: 'error', msg: 'Không thể tải danh sách pages' }]))
  }, [])

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))
  const addLog = entry => setLogs(prev => [...prev, entry])
  const currentPageName = pages.find(p => p.page_id === form.pageId)?.page_name || ''

  async function handlePublish(e) {
    e.preventDefault()
    if (!videoFile)     return alert('Vui lòng chọn video cho Card 1')
    if (!thumbnailFile) return alert('Vui lòng chọn ảnh thumbnail cho video')
    if (!imageFile)     return alert('Vui lòng chọn ảnh cho Card 2')

    setLogs([])
    setPublishing(true)
    setDone(false)
    setPermalink(null)

    const fd = new FormData()
    fd.append('page_id',        form.pageId)
    fd.append('message',        form.message)
    fd.append('safe_link',      form.safeLink)
    fd.append('card1_title',    form.card1Title)
    fd.append('card1_desc',     form.card1Desc)
    fd.append('card1_cta',      form.card1Cta)
    fd.append('card2_title',    form.card2Title)
    fd.append('card2_desc',     form.card2Desc)
    fd.append('card2_cta',      form.card2Cta)
    fd.append('video_file',     videoFile)
    fd.append('thumbnail_file', thumbnailFile)
    fd.append('image_file',     imageFile)

    try {
      const res = await fetch(`${API}/api/publish`, {
        method: 'POST',
        body: fd,
        headers: getAuthHeaders(),
      })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim()
            if (raw === '[DONE]') { setDone(true); setPublishing(false); break }
            try {
              const entry = JSON.parse(raw)
              if (entry.level === 'link') setPermalink(entry.msg)
              else addLog(entry)
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      addLog({ level: 'error', msg: `Lỗi kết nối: ${err.message}` })
    } finally {
      setPublishing(false)
    }
  }

  function handleReset() {
    setLogs([])
    setDone(false)
    setPermalink(null)
    setVideoFile(null)
    setThumbnailFile(null)
    setImageFile(null)
  }

  const showLogs = publishing || logs.length > 0 || done

  return (
    <div className="publish-page">

      {/* ── HÀNG TRÊN: Fanpage + Caption (full width) ── */}
      <div className="publish-top-row">
        {/* Chọn Fanpage */}
        <div className="section-card glass top-card-page">
          <h3 className="section-title">📄 Chọn Fanpage</h3>
          <select
            id="page-select"
            className="select-input"
            value={form.pageId}
            onChange={set('pageId')}
          >
            {pages.length === 0 && <option value="">— Chưa có page —</option>}
            {pages.map(p => (
              <option key={p.page_id} value={p.page_id}>{p.page_name}</option>
            ))}
          </select>
        </div>

        {/* Nội dung bài viết */}
        <div className="section-card glass top-card-content">
          <h3 className="section-title">✍️ Nội dung bài viết</h3>
          <div className="top-content-fields">
            <div className="field-group">
              <label>Caption</label>
              <textarea
                id="post-message"
                className="token-input caption-input"
                rows={2}
                value={form.message}
                onChange={set('message')}
              />
            </div>
            <div className="field-group">
              <label>Link đích (Safe Link)</label>
              <input
                id="safe-link"
                type="url"
                className="text-input"
                value={form.safeLink}
                onChange={set('safeLink')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── HÀNG DƯỚI: Preview | Card configs ── */}
      <div className="publish-bottom-row">

        {/* Cột trái: Preview hoặc Log */}
        <div className="publish-preview-col">
          {showLogs ? (
            <LogConsole
              logs={logs}
              done={done}
              permalink={permalink}
              onReset={handleReset}
            />
          ) : (
            <PostPreview
              form={form}
              videoFile={videoFile}
              thumbnailFile={thumbnailFile}
              imageFile={imageFile}
              pageName={currentPageName}
            />
          )}
        </div>

        {/* Cột phải: Card 1 + Card 2 */}
        <div className="publish-cards-col">
          {/* Card 1 — Video */}
          <div className="section-card glass card-config card1-config">
            <h3 className="section-title">🃏 Card 1 — Video</h3>
            <div className="field-row">
              <div className="field-group">
                <label>Tiêu đề</label>
                <input id="card1-title" type="text" className="text-input" value={form.card1Title} onChange={set('card1Title')} />
              </div>
              <div className="field-group">
                <label>Nút CTA</label>
                <select id="card1-cta" className="select-input" value={form.card1Cta} onChange={set('card1Cta')}>
                  {CTA_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field-group">
              <label>Mô tả phụ <span className="hint">(~30 ký tự, tùy chọn)</span></label>
              <input id="card1-desc" type="text" className="text-input" value={form.card1Desc} onChange={set('card1Desc')} placeholder="💥 Giảm 50% từ hôm nay" maxLength={80} />
            </div>
            <FileUpload
              id="video-upload"
              label="Video"
              accept="video/mp4,video/*"
              icon="🎬"
              file={videoFile}
              onFile={setVideoFile}
            />
            <ThumbnailPicker
              videoFile={videoFile}
              onThumbnailReady={setThumbnailFile}
            />
          </div>

          {/* Card 2 — Ảnh */}
          <div className="section-card glass card-config card2-config">
            <h3 className="section-title">🃏 Card 2 — Ảnh</h3>
            <div className="field-row">
              <div className="field-group">
                <label>Tiêu đề</label>
                <input id="card2-title" type="text" className="text-input" value={form.card2Title} onChange={set('card2Title')} />
              </div>
              <div className="field-group">
                <label>Nút CTA</label>
                <select id="card2-cta" className="select-input" value={form.card2Cta} onChange={set('card2Cta')}>
                  {CTA_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field-group">
              <label>Mô tả phụ <span className="hint">(~30 ký tự, tùy chọn)</span></label>
              <input id="card2-desc" type="text" className="text-input" value={form.card2Desc} onChange={set('card2Desc')} placeholder="🛒 shopee.vn" maxLength={80} />
            </div>
            <FileUpload
              id="image-upload"
              label="Ảnh Card 2"
              accept="image/jpeg,image/png,image/*"
              icon="🖼️"
              file={imageFile}
              onFile={setImageFile}
            />
          </div>

          {/* Nút Đăng bài */}
          <button
            id="publish-btn"
            className="btn-publish"
            onClick={handlePublish}
            disabled={publishing || !form.pageId}
          >
            {publishing
              ? <span className="btn-loading"><span className="spinner" />Đang đăng bài...</span>
              : '🚀 Đăng bài lên Facebook'}
          </button>
        </div>
      </div>
    </div>
  )
}
