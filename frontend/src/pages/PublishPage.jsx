import { useState, useEffect } from 'react'
import {
  FileVideo, Image as ImageIcon, Link as LinkIcon,
  Layers, Clock, MonitorPlay, Send, Share2, LayoutList,
  CalendarDays, Settings2, FileText, Pointer, Loader2, PlaySquare, Info
} from 'lucide-react'
import FileUpload from '../components/FileUpload'
import ThumbnailPicker from '../components/ThumbnailPicker'
import PostPreview from '../components/PostPreview'
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

const DEFAULT_CAROUSEL = {
  pageId: '', message: '',
  card1Title: 'Chi tiết sản phẩm 👉', card1Desc: '', card1Link: 'https://shopee.vn', card1Cta: 'LEARN_MORE',
  card2Title: 'Xem thêm tại đây 👉', card2Desc: '', card2Link: 'https://facebook.com', card2Cta: 'LEARN_MORE',
}

export default function PublishPage() {
  const [pages, setPages]     = useState([])
  const [mode, setMode]       = useState('normal') // 'normal' | 'single' | 'carousel'
  const [pageId, setPageId]   = useState('')
  const [isScheduled, setIsScheduled]   = useState(false)
  const [scheduledTime, setScheduledTime] = useState('')
  const [publishing, setPublishing]       = useState(false)

  // Toast notification
  const [toast, setToast] = useState(null) // { type: 'success'|'error'|'publishing', msg, link }

  // Normal mode
  const [normalMediaType, setNormalMediaType] = useState('video')
  const [normalFile, setNormalFile]           = useState(null)
  const [normalThumb, setNormalThumb]         = useState(null)
  const [normalMsg, setNormalMsg]             = useState('')

  // Single (dark post + link) mode
  const [singleMediaType, setSingleMediaType] = useState('video')
  const [singleFile, setSingleFile]           = useState(null)
  const [singleThumb, setSingleThumb]         = useState(null)
  const [singleMsg, setSingleMsg]             = useState('')
  const [singleLink, setSingleLink]           = useState('https://shopee.vn')
  const [singleDisplayLink, setSingleDisplayLink] = useState('')
  const [singleCta, setSingleCta]             = useState('LEARN_MORE')

  // Carousel mode
  const [cForm, setCForm] = useState(DEFAULT_CAROUSEL)
  const [videoFile, setVideoFile]         = useState(null)
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [imageFile, setImageFile]         = useState(null)
  const [isCard2ImageManual, setIsCard2ImageManual] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/pages`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => {
        setPages(d.pages || [])
        if (d.pages?.length > 0) setPageId(d.pages[0].page_id)
      })
      .catch(() => setToast({ type: 'error', msg: 'Không thể tải danh sách pages' }))
  }, [])

  const cSet = key => e => setCForm(f => ({ ...f, [key]: e.target.value }))
  const currentPageName = pages.find(p => p.page_id === pageId)?.page_name || ''

  // Auto dùng thumbnail làm ảnh Card 2 cho tới khi user tự đổi ảnh Card 2
  useEffect(() => {
    if (!thumbnailFile) {
      if (!isCard2ImageManual) setImageFile(null)
      return
    }
    if (!isCard2ImageManual) {
      setImageFile(thumbnailFile)
    }
  }, [thumbnailFile, isCard2ImageManual])

  // Mỗi khi đổi video mới, reset về chế độ auto cho Card 2.
  useEffect(() => {
    setIsCard2ImageManual(false)
    setImageFile(null)
  }, [videoFile])

  // ── Shared SSE reader: chỉ lấy kết quả cuối ──
  async function readSSEFinal(res) {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finalResult = { type: null, msg: '', link: null }

    while (true) {
      const { done: streamDone, value } = await reader.read()
      if (streamDone) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') {
            setPublishing(false)
            if (finalResult.type) setToast(finalResult)
            return
          }
          try {
            const entry = JSON.parse(raw)
            if (entry.level === 'success') finalResult = { type: 'success', msg: entry.msg, link: finalResult.link }
            else if (entry.level === 'error') finalResult = { type: 'error', msg: entry.msg, link: finalResult.link }
            else if (entry.level === 'link') finalResult.link = entry.msg
          } catch (_) {}
        }
      }
    }
    setPublishing(false)
    if (finalResult.type) setToast(finalResult)
  }

  async function handleResponse(res) {
    const contentType = res.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json()
      setPublishing(false)
      if (data.success) {
        setToast({ type: 'success', msg: data.msg })
      } else {
        setToast({ type: 'error', msg: data.error || 'Đã xảy ra lỗi khi lưu' })
      }
    } else {
      await readSSEFinal(res)
    }
  }

  function getScheduledUnix() {
    if (!isScheduled) return ''
    if (!scheduledTime) { alert('Vui lòng chọn thời gian lên lịch'); return null }
    return Math.floor(new Date(scheduledTime).getTime() / 1000).toString()
  }

  // ── Normal publish ──
  async function handlePublishNormal(e) {
    e.preventDefault()
    if (!normalFile) return alert('Vui lòng chọn file media')
    const su = getScheduledUnix(); if (su === null) return

    setToast({ type: 'publishing', msg: 'Đang xử lý bài viết...' })
    setPublishing(true)

    const fd = new FormData()
    fd.append('page_id', pageId)
    fd.append('message', normalMsg)
    fd.append('media_type', normalMediaType)
    fd.append('media_file', normalFile)
    if (normalThumb) fd.append('thumbnail_file', normalThumb)
    if (su) fd.append('scheduled_time', su)

    try {
      const res = await fetch(`${API}/api/publish/normal`, { method: 'POST', body: fd, headers: getAuthHeaders() })
      await handleResponse(res)
    } catch (err) {
      setToast({ type: 'error', msg: `Lỗi kết nối: ${err.message}` })
      setPublishing(false)
    }
  }

  // ── Single (dark post + link) publish ──
  async function handlePublishSingle(e) {
    e.preventDefault()
    if (!singleFile) return alert('Vui lòng chọn file media')
    if (!singleLink) return alert('URL trang web là bắt buộc')
    const su = getScheduledUnix(); if (su === null) return

    setToast({ type: 'publishing', msg: 'Đang xử lý bài viết...' })
    setPublishing(true)

    const fd = new FormData()
    fd.append('page_id', pageId)
    fd.append('message', singleMsg)
    fd.append('link', singleLink)
    fd.append('display_link', singleDisplayLink)
    fd.append('cta_type', singleCta)
    fd.append('media_type', singleMediaType)
    fd.append('media_file', singleFile)
    if (singleThumb) fd.append('thumbnail_file', singleThumb)
    if (su) fd.append('scheduled_time', su)

    try {
      const res = await fetch(`${API}/api/publish/single`, { method: 'POST', body: fd, headers: getAuthHeaders() })
      await handleResponse(res)
    } catch (err) {
      setToast({ type: 'error', msg: `Lỗi kết nối: ${err.message}` })
      setPublishing(false)
    }
  }

  // ── Carousel publish ──
  async function handlePublishCarousel(e) {
    e.preventDefault()
    const effectiveCard2Image = isCard2ImageManual ? imageFile : thumbnailFile

    if (!videoFile) return alert('Vui lòng chọn video cho Card 1')
    if (!thumbnailFile) return alert('Vui lòng chọn thumbnail')
    if (!effectiveCard2Image) return alert('Vui lòng chọn ảnh cho Card 2')
    const su = getScheduledUnix(); if (su === null) return

    setToast({ type: 'publishing', msg: 'Đang xử lý bài viết...' })
    setPublishing(true)

    const fd = new FormData()
    fd.append('page_id', pageId)
    fd.append('message', cForm.message)
    fd.append('card1_link', cForm.card1Link); fd.append('card1_title', cForm.card1Title); fd.append('card1_desc', cForm.card1Desc); fd.append('card1_cta', cForm.card1Cta)
    fd.append('card2_link', cForm.card2Link); fd.append('card2_title', cForm.card2Title); fd.append('card2_desc', cForm.card2Desc); fd.append('card2_cta', cForm.card2Cta)
    fd.append('video_file', videoFile)
    fd.append('thumbnail_file', thumbnailFile)
    fd.append('image_file', effectiveCard2Image)
    if (su) fd.append('scheduled_time', su)

    try {
      const res = await fetch(`${API}/api/publish`, { method: 'POST', body: fd, headers: getAuthHeaders() })
      await handleResponse(res)
    } catch (err) {
      setToast({ type: 'error', msg: `Lỗi kết nối: ${err.message}` })
      setPublishing(false)
    }
  }

  // Get the active media file for preview (normal or single)
  const activeMediaFile = mode === 'normal' ? normalFile : mode === 'single' ? singleFile : null
  const activeMediaType = mode === 'normal' ? normalMediaType : mode === 'single' ? singleMediaType : null

  return (
    <div className="publish-page">

      {/* MODE SWITCHER */}
      <div className="mode-switcher glass">
        <button className={`mode-btn ${mode === 'normal' ? 'active' : ''}`} onClick={() => setMode('normal')}>
          <ImageIcon size={16} />
          <span>Bài thường</span>
        </button>
        <button className={`mode-btn ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>
          <LinkIcon size={16} />
          <span>Bài đơn + Link</span>
        </button>
        <button className={`mode-btn ${mode === 'carousel' ? 'active' : ''}`} onClick={() => setMode('carousel')}>
          <Layers size={16} />
          <span>Carousel</span>
        </button>
      </div>

      {/* TOP ROW: Fanpage + Scheduling */}
      <div className="publish-top-row">
        <div className="section-card glass top-card-page">
          <h3 className="section-title">
            <LayoutList size={18} />
            Chọn Fanpage
          </h3>
          <select className="select-input" value={pageId} onChange={e => setPageId(e.target.value)}>
            {pages.length === 0 && <option value="">— Chưa có page —</option>}
            {pages.map(p => <option key={p.page_id} value={p.page_id}>{p.page_name}</option>)}
          </select>
        </div>
        <div className="section-card glass top-card-content">
          <h3 className="section-title">
            <Clock size={18} />
            Tùy chọn đăng
          </h3>
          <div className="scheduling-block">
            <label className="schedule-toggle">
              <input type="checkbox" checked={isScheduled} onChange={e => setIsScheduled(e.target.checked)} />
              <CalendarDays size={18} className="schedule-icon" />
              <span>Lên lịch đăng bài</span>
            </label>
            {isScheduled && (
              <div className="schedule-input-wrapper animate-fade-in">
                 <input type="datetime-local" className="text-input schedule-datetime" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="publish-bottom-row">

        {/* LEFT: Preview + Toast overlay */}
        <div className="publish-preview-col">
          {/* Preview always visible */}
          {mode === 'carousel' ? (
            <PostPreview form={{...cForm, pageId}} videoFile={videoFile} thumbnailFile={thumbnailFile} imageFile={imageFile} pageName={currentPageName} />
          ) : (
            <div className="section-card glass single-preview-card">
              <h3 className="section-title">
                 <MonitorPlay size={18} />
                 Xem trước
              </h3>
              <div className="single-preview-body">
                <div className="single-preview-media">
                  {activeMediaFile ? (
                    activeMediaType === 'video' ? (
                      <video src={URL.createObjectURL(activeMediaFile)} controls className="single-preview-video" />
                    ) : (
                      <img src={URL.createObjectURL(activeMediaFile)} alt="" className="single-preview-img" />
                    )
                  ) : (
                    <div className="single-preview-placeholder">
                      {activeMediaType === 'video' ? <FileVideo size={32} opacity={0.5} /> : <ImageIcon size={32} opacity={0.5} />}
                      <span>{activeMediaType === 'video' ? 'Chưa có video' : 'Chưa có ảnh'}</span>
                    </div>
                  )}
                </div>
                <div className="single-preview-info">
                  {mode === 'single' && <div className="single-preview-link">{singleLink || '—'}</div>}
                  <div className="single-preview-msg">{(mode === 'normal' ? normalMsg : singleMsg) || 'Chưa có caption...'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Toast notification overlay */}
          {toast && (
            <div className={`publish-toast toast-${toast.type}`}>
              {toast.type === 'publishing' && (
                <div className="toast-body">
                  <Loader2 size={18} className="spin-icon" />
                  <span>{toast.msg}</span>
                </div>
              )}
              {toast.type === 'success' && (
                <div className="toast-body">
                  <span>{toast.msg}</span>
                  {toast.link && (
                    <a href={toast.link} target="_blank" rel="noreferrer" className="toast-link">
                      <LinkIcon size={14} /> Xem bài viết
                    </a>
                  )}
                  <button className="toast-close" onClick={() => setToast(null)}>✕</button>
                </div>
              )}
              {toast.type === 'error' && (
                <div className="toast-body">
                  <span>{toast.msg}</span>
                  <button className="toast-close" onClick={() => setToast(null)}>✕</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Form */}
        <div className="publish-cards-col">

          {/* ══════ NORMAL MODE ══════ */}
          {mode === 'normal' && (
            <div className="animate-fade-in-up">
              <div className="section-card glass card-config" style={{ borderLeft: '3px solid var(--accent)', marginBottom: '16px' }}>
                <h3 className="section-title">
                   <Settings2 size={18} />
                   Đăng ảnh / video thường
                </h3>
                <div className="field-group">
                  <label>Loại media</label>
                  <div className="media-type-toggle">
                    <button className={`mt-btn ${normalMediaType === 'video' ? 'active' : ''}`} onClick={() => { setNormalMediaType('video'); setNormalFile(null) }} type="button">
                      <FileVideo size={16} /> Video
                    </button>
                    <button className={`mt-btn ${normalMediaType === 'image' ? 'active' : ''}`} onClick={() => { setNormalMediaType('image'); setNormalFile(null) }} type="button">
                      <ImageIcon size={16} /> Ảnh
                    </button>
                  </div>
                </div>
                <FileUpload id="normal-upload" label={normalMediaType === 'video' ? 'Video' : 'Ảnh'} accept={normalMediaType === 'video' ? 'video/mp4,video/*' : 'image/*'} icon={normalMediaType === 'video' ? <FileVideo size={24}/> : <ImageIcon size={24}/>} file={normalFile} onFile={setNormalFile} />
                {normalMediaType === 'video' && <ThumbnailPicker videoFile={normalFile} onThumbnailReady={setNormalThumb} />}
                <div className="field-group">
                  <label>Caption</label>
                  <textarea className="token-input caption-input" rows={3} value={normalMsg} onChange={e => setNormalMsg(e.target.value)} placeholder="Nhập nội dung bài viết..." />
                </div>
              </div>
              <button className="btn-primary btn-publish" onClick={handlePublishNormal} disabled={publishing || !pageId}>
                {publishing ? <span className="btn-loading"><Loader2 size={18} className="spin-icon" />Đang xử lý...</span> : isScheduled ? <><CalendarDays size={18}/> ⏳ Lên lịch đăng bài</> : <><Send size={18}/> 🚀 Đăng bài</>}
              </button>
             </div>
          )}

          {/* ══════ SINGLE + LINK MODE ══════ */}
          {mode === 'single' && (
             <div className="animate-fade-in-up">
              <div className="section-card glass card-config" style={{ borderLeft: '3px solid var(--accent)', marginBottom: '12px' }}>
                <h3 className="section-title">
                  <FileText size={18} />
                  Bài đơn + Link website
                </h3>
                <div className="field-group">
                  <label>Loại media</label>
                  <div className="media-type-toggle">
                    <button className={`mt-btn ${singleMediaType === 'video' ? 'active' : ''}`} onClick={() => { setSingleMediaType('video'); setSingleFile(null) }} type="button">
                      <FileVideo size={16} /> Video
                    </button>
                    <button className={`mt-btn ${singleMediaType === 'image' ? 'active' : ''}`} onClick={() => { setSingleMediaType('image'); setSingleFile(null) }} type="button">
                      <ImageIcon size={16} /> Ảnh
                    </button>
                  </div>
                </div>
                <FileUpload id="single-upload" label={singleMediaType === 'video' ? 'Video' : 'Ảnh'} accept={singleMediaType === 'video' ? 'video/mp4,video/*' : 'image/*'} icon={singleMediaType === 'video' ? <FileVideo size={24}/> : <ImageIcon size={24} />} file={singleFile} onFile={setSingleFile} />
                {singleMediaType === 'video' && <ThumbnailPicker videoFile={singleFile} onThumbnailReady={setSingleThumb} />}
                <div className="field-group">
                  <label>Caption</label>
                  <textarea className="token-input caption-input" rows={2} value={singleMsg} onChange={e => setSingleMsg(e.target.value)} placeholder="Nhập nội dung..." />
                </div>
              </div>
              <div className="section-card glass card-config" style={{ borderLeft: '3px solid var(--accent-2)', marginBottom: '16px' }}>
                <h3 className="section-title">
                  <LinkIcon size={18} />
                  Chuyển đến trang web
                </h3>
                <div className="field-row">
                  <div className="field-group">
                    <label>URL trang web <span className="hint">(bắt buộc)</span></label>
                    <input type="url" className="text-input" value={singleLink} onChange={e => setSingleLink(e.target.value)} placeholder="https://example.com" />
                  </div>
                  <div className="field-group">
                    <label>Liên kết hiển thị <span className="hint">(tùy chọn)</span></label>
                    <input type="text" className="text-input" value={singleDisplayLink} onChange={e => setSingleDisplayLink(e.target.value)} placeholder="shopee.vn/deal" />
                  </div>
                </div>
                <div className="field-group mt-2">
                  <label>Nút CTA</label>
                  <select className="select-input" value={singleCta} onChange={e => setSingleCta(e.target.value)}>
                    {CTA_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <button className="btn-primary btn-publish" onClick={handlePublishSingle} disabled={publishing || !pageId}>
                 {publishing ? <span className="btn-loading"><Loader2 size={18} className="spin-icon"/>Đang xử lý...</span> : isScheduled ? <><CalendarDays size={18}/> ⏳ Lên lịch đăng bài</> : <><Send size={18}/> 🚀 Đăng bài</>}
              </button>
            </div>
          )}

          {/* ══════ CAROUSEL MODE ══════ */}
          {mode === 'carousel' && (
            <div className="animate-fade-in-up">
              <div className="section-card glass card-config" style={{ borderLeft: '3px solid var(--accent)', marginBottom: '12px' }}>
                <h3 className="section-title">
                   <Pointer size={18} />
                   Nội dung Carousel
                </h3>
                <div className="field-group"><label>Caption</label><textarea className="token-input caption-input" rows={2} value={cForm.message} onChange={cSet('message')} /></div>
              </div>
              <div className="section-card glass card-config card1-config" style={{marginBottom: '12px'}}>
                <h3 className="section-title"><PlaySquare size={18}/> Card 1 — Video</h3>
                <div className="field-row">
                  <div className="field-group"><label>Tiêu đề</label><input type="text" className="text-input" value={cForm.card1Title} onChange={cSet('card1Title')} /></div>
                  <div className="field-group"><label>CTA</label><select className="select-input" value={cForm.card1Cta} onChange={cSet('card1Cta')}>{CTA_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
                </div>
                <div className="field-row" style={{marginTop: '10px'}}>
                  <div className="field-group"><label>Link đích</label><input type="url" className="text-input" value={cForm.card1Link} onChange={cSet('card1Link')} /></div>
                  <div className="field-group"><label>Mô tả (tùy chọn)</label><input type="text" className="text-input" value={cForm.card1Desc} onChange={cSet('card1Desc')} maxLength={80} /></div>
                </div>
                <div style={{marginTop: '12px'}}>
                  <FileUpload id="c-video" label="Video" accept="video/mp4,video/*" icon={<FileVideo size={24}/>} file={videoFile} onFile={setVideoFile} />
                  <ThumbnailPicker videoFile={videoFile} onThumbnailReady={setThumbnailFile} />
                </div>
              </div>
              <div className="section-card glass card-config card2-config" style={{marginBottom: '16px'}}>
                <h3 className="section-title"><ImageIcon size={18}/> Card 2 — Ảnh</h3>
                <div className="field-row">
                  <div className="field-group"><label>Tiêu đề</label><input type="text" className="text-input" value={cForm.card2Title} onChange={cSet('card2Title')} /></div>
                  <div className="field-group"><label>CTA</label><select className="select-input" value={cForm.card2Cta} onChange={cSet('card2Cta')}>{CTA_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
                </div>
                <div className="field-row" style={{marginTop: '10px'}}>
                  <div className="field-group"><label>Link đích</label><input type="url" className="text-input" value={cForm.card2Link} onChange={cSet('card2Link')} /></div>
                  <div className="field-group"><label>Mô tả (tùy chọn)</label><input type="text" className="text-input" value={cForm.card2Desc} onChange={cSet('card2Desc')} maxLength={80} /></div>
                </div>
                <div style={{marginTop: '12px'}}>
                  <FileUpload
                    id="c-image"
                    label="Ảnh Card 2"
                    accept="image/*"
                    icon={<ImageIcon size={24}/>}
                    file={imageFile}
                    onFile={(f) => {
                      if (f) {
                        setImageFile(f)
                        setIsCard2ImageManual(true)
                        return
                      }

                      // Nếu bỏ chọn ảnh custom thì quay về auto theo thumbnail.
                      setIsCard2ImageManual(false)
                      setImageFile(thumbnailFile)
                    }}
                  />
                </div>
              </div>
              <button className="btn-primary btn-publish" onClick={handlePublishCarousel} disabled={publishing || !pageId}>
                 {publishing ? <span className="btn-loading"><Loader2 size={18} className="spin-icon"/>Đang xử lý...</span> : isScheduled ? <><CalendarDays size={18}/> ⏳ Lên lịch đăng bài</> : <><Send size={18}/> 🚀 Đăng bài</>}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
