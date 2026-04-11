import { useState, useEffect } from 'react'
import FileUpload from '../components/FileUpload'
import ThumbnailPicker from '../components/ThumbnailPicker'
import PostPreview from '../components/PostPreview'
import LogConsole from '../components/LogConsole'
import './PublishPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getAuthHeaders() {
  const token = localStorage.getItem('autopost_token')
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
  const [mode, setMode]                     = useState('single') // 'single' | 'carousel'
  const [form, setForm]                     = useState(DEFAULT_FORM)
  const [videoFile, setVideoFile]           = useState(null)
  const [thumbnailFile, setThumbnailFile]   = useState(null)
  const [imageFile, setImageFile]           = useState(null)
  const [logs, setLogs]                     = useState([])
  const [publishing, setPublishing]         = useState(false)
  const [done, setDone]                     = useState(false)
  const [permalink, setPermalink]           = useState(null)
  const [isScheduled, setIsScheduled]       = useState(false)
  const [scheduledTime, setScheduledTime]   = useState('')

  // Single mode state
  const [singleMediaType, setSingleMediaType] = useState('video') // 'video' | 'image'
  const [singleMediaFile, setSingleMediaFile] = useState(null)
  const [singleThumbFile, setSingleThumbFile] = useState(null)
  const [singleLink, setSingleLink]           = useState('https://shopee.vn')
  const [singleDisplayLink, setSingleDisplayLink] = useState('')
  const [singleCta, setSingleCta]             = useState('LEARN_MORE')
  const [singleMessage, setSingleMessage]     = useState('')

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

  // ── Shared SSE reader ──
  async function readSSE(res) {
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
            else if (entry.level !== 'post_id') addLog(entry)
          } catch (_) {}
        }
      }
    }
  }

  // ── Carousel publish ──
  async function handlePublishCarousel(e) {
    e.preventDefault()
    if (!videoFile)     return alert('Vui lòng chọn video cho Card 1')
    if (!thumbnailFile) return alert('Vui lòng chọn ảnh thumbnail cho video')
    if (!imageFile)     return alert('Vui lòng chọn ảnh cho Card 2')

    setLogs([]); setPublishing(true); setDone(false); setPermalink(null)

    let scheduledUnix = ''
    if (isScheduled) {
      if (!scheduledTime) { setPublishing(false); return alert('Vui lòng chọn thời gian lên lịch') }
      scheduledUnix = Math.floor(new Date(scheduledTime).getTime() / 1000).toString()
    }

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
    if (isScheduled && scheduledUnix) fd.append('scheduled_time', scheduledUnix)

    try {
      const res = await fetch(`${API}/api/publish`, {
        method: 'POST', body: fd, headers: getAuthHeaders(),
      })
      await readSSE(res)
    } catch (err) {
      addLog({ level: 'error', msg: `Lỗi kết nối: ${err.message}` })
    } finally {
      setPublishing(false)
    }
  }

  // ── Single media publish ──
  async function handlePublishSingle(e) {
    e.preventDefault()
    if (!singleMediaFile) return alert('Vui lòng chọn file media')
    if (!singleLink)      return alert('URL trang web là bắt buộc')

    setLogs([]); setPublishing(true); setDone(false); setPermalink(null)

    let scheduledUnix = ''
    if (isScheduled) {
      if (!scheduledTime) { setPublishing(false); return alert('Vui lòng chọn thời gian lên lịch') }
      scheduledUnix = Math.floor(new Date(scheduledTime).getTime() / 1000).toString()
    }

    const fd = new FormData()
    fd.append('page_id',      form.pageId)
    fd.append('message',      singleMessage)
    fd.append('link',         singleLink)
    fd.append('display_link', singleDisplayLink)
    fd.append('cta_type',     singleCta)
    fd.append('media_type',   singleMediaType)
    fd.append('media_file',   singleMediaFile)
    if (singleThumbFile) fd.append('thumbnail_file', singleThumbFile)
    if (isScheduled && scheduledUnix) fd.append('scheduled_time', scheduledUnix)

    try {
      const res = await fetch(`${API}/api/publish/single`, {
        method: 'POST', body: fd, headers: getAuthHeaders(),
      })
      await readSSE(res)
    } catch (err) {
      addLog({ level: 'error', msg: `Lỗi kết nối: ${err.message}` })
    } finally {
      setPublishing(false)
    }
  }

  function handleReset() {
    setLogs([]); setDone(false); setPermalink(null)
    setVideoFile(null); setThumbnailFile(null); setImageFile(null)
    setSingleMediaFile(null); setSingleThumbFile(null)
  }

  const showLogs = publishing || logs.length > 0 || done

  return (
    <div className="publish-page">

      {/* ── MODE SWITCHER ── */}
      <div className="mode-switcher glass">
        <button
          className={`mode-btn ${mode === 'single' ? 'active' : ''}`}
          onClick={() => setMode('single')}
        >
          🖼️ Bài đơn (Video/Ảnh + Link)
        </button>
        <button
          className={`mode-btn ${mode === 'carousel' ? 'active' : ''}`}
          onClick={() => setMode('carousel')}
        >
          🃏 Carousel Dark Post
        </button>
      </div>

      {/* ── HÀNG TRÊN: Fanpage + Scheduling ── */}
      <div className="publish-top-row">
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

        <div className="section-card glass top-card-content">
          <h3 className="section-title">⏰ Tùy chọn đăng</h3>
          <div className="scheduling-block">
            <label className="schedule-toggle">
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={e => setIsScheduled(e.target.checked)}
              />
              <span>⏳ Lên lịch đăng bài</span>
            </label>
            {isScheduled && (
              <input
                type="datetime-local"
                className="text-input schedule-datetime"
                value={scheduledTime}
                onChange={e => setScheduledTime(e.target.value)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── HÀNG DƯỚI ── */}
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
          ) : mode === 'carousel' ? (
            <PostPreview
              form={form}
              videoFile={videoFile}
              thumbnailFile={thumbnailFile}
              imageFile={imageFile}
              pageName={currentPageName}
            />
          ) : (
            <div className="section-card glass single-preview-card">
              <h3 className="section-title">👁️ Xem trước</h3>
              <div className="single-preview-body">
                <div className="single-preview-media">
                  {singleMediaFile ? (
                    singleMediaType === 'video' ? (
                      <video src={URL.createObjectURL(singleMediaFile)} controls className="single-preview-video" />
                    ) : (
                      <img src={URL.createObjectURL(singleMediaFile)} alt="preview" className="single-preview-img" />
                    )
                  ) : (
                    <div className="single-preview-placeholder">
                      {singleMediaType === 'video' ? '🎬 Chưa có video' : '🖼️ Chưa có ảnh'}
                    </div>
                  )}
                </div>
                <div className="single-preview-info">
                  <div className="single-preview-link">{singleLink || 'Chưa nhập link'}</div>
                  <div className="single-preview-msg">{singleMessage || 'Chưa có caption...'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cột phải: Form */}
        <div className="publish-cards-col">

          {mode === 'single' ? (
            /* ══ SINGLE MODE ══ */
            <>
              <div className="section-card glass card-config" style={{ borderLeft: '3px solid var(--accent)' }}>
                <h3 className="section-title">📝 Nội dung bài đơn</h3>

                {/* Media type toggle */}
                <div className="field-group">
                  <label>Loại media</label>
                  <div className="media-type-toggle">
                    <button
                      className={`mt-btn ${singleMediaType === 'video' ? 'active' : ''}`}
                      onClick={() => { setSingleMediaType('video'); setSingleMediaFile(null) }}
                      type="button"
                    >
                      🎬 Video
                    </button>
                    <button
                      className={`mt-btn ${singleMediaType === 'image' ? 'active' : ''}`}
                      onClick={() => { setSingleMediaType('image'); setSingleMediaFile(null) }}
                      type="button"
                    >
                      🖼️ Ảnh
                    </button>
                  </div>
                </div>

                <FileUpload
                  id="single-media-upload"
                  label={singleMediaType === 'video' ? 'Video' : 'Ảnh'}
                  accept={singleMediaType === 'video' ? 'video/mp4,video/*' : 'image/jpeg,image/png,image/*'}
                  icon={singleMediaType === 'video' ? '🎬' : '🖼️'}
                  file={singleMediaFile}
                  onFile={setSingleMediaFile}
                />

                {singleMediaType === 'video' && (
                  <ThumbnailPicker
                    videoFile={singleMediaFile}
                    onThumbnailReady={setSingleThumbFile}
                  />
                )}

                <div className="field-group">
                  <label>Caption</label>
                  <textarea
                    className="token-input caption-input"
                    rows={2}
                    value={singleMessage}
                    onChange={e => setSingleMessage(e.target.value)}
                    placeholder="Nhập nội dung bài viết..."
                  />
                </div>
              </div>

              <div className="section-card glass card-config" style={{ borderLeft: '3px solid var(--accent-2)' }}>
                <h3 className="section-title">🔗 Chuyển đến trang web</h3>

                <div className="field-group">
                  <label>URL trang web <span className="hint">(bắt buộc)</span></label>
                  <input
                    type="url"
                    className="text-input"
                    value={singleLink}
                    onChange={e => setSingleLink(e.target.value)}
                    placeholder="https://www.example.com/page"
                  />
                </div>

                <div className="field-group">
                  <label>Liên kết hiển thị <span className="hint">(tùy chọn)</span></label>
                  <input
                    type="text"
                    className="text-input"
                    value={singleDisplayLink}
                    onChange={e => setSingleDisplayLink(e.target.value)}
                    placeholder="shopee.vn/deal-hot"
                  />
                </div>

                <div className="field-group">
                  <label>Nút CTA</label>
                  <select className="select-input" value={singleCta} onChange={e => setSingleCta(e.target.value)}>
                    {CTA_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <button
                id="publish-btn"
                className="btn-publish"
                onClick={handlePublishSingle}
                disabled={publishing || !form.pageId}
              >
                {publishing
                  ? <span className="btn-loading"><span className="spinner" />Đang đăng bài...</span>
                  : isScheduled ? '⏳ Lên lịch đăng bài' : '🚀 Đăng bài lên Facebook'}
              </button>
            </>
          ) : (
            /* ══ CAROUSEL MODE ══ */
            <>
              <div className="section-card glass card-config" style={{ borderLeft: '3px solid var(--accent)' }}>
                <h3 className="section-title">✍️ Nội dung bài viết</h3>
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
                onClick={handlePublishCarousel}
                disabled={publishing || !form.pageId}
              >
                {publishing
                  ? <span className="btn-loading"><span className="spinner" />Đang đăng bài...</span>
                  : isScheduled ? '⏳ Lên lịch đăng bài' : '🚀 Đăng bài lên Facebook'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
