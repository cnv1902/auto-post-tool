import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Images, Loader2, Maximize } from 'lucide-react'
import './ThumbnailPicker.css'

export default function ThumbnailPicker({ videoFile, onThumbnailReady }) {
  const [frames, setFrames] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const [customThumb, setCustomThumb] = useState(null)
  const [extractError, setExtractError] = useState('')
  const customThumbUrl = useObjectUrl(customThumb)
  
  // Ref for the hidden file input (for custom thumbnail)
  const customInputRef = useRef(null)

  useEffect(() => {
    if (!videoFile) {
      setFrames([])
      setSelectedIdx(0)
      setCustomThumb(null)
      setExtractError('')
      onThumbnailReady(null)
      return
    }

    setLoading(true)
    setExtractError('')
    extractFramesClientSide(videoFile, 10)
      .then((localFrames) => {
        if (localFrames.length > 0) {
          setFrames(localFrames)
          setSelectedIdx(0)
          setExtractError('')
          return
        }

        setFrames([])
        onThumbnailReady(null)
        setExtractError('Không thể trích xuất thumbnail từ video này trên trình duyệt')
      })
      .catch((err) => {
        console.error('Lỗi khi extract frames client-side:', err)
        setFrames([])
        onThumbnailReady(null)
        setExtractError(err?.message || 'Trích xuất frame thất bại')
      })
      .finally(() => setLoading(false))

    return () => {}
  }, [videoFile])

  // Convert frame b64 / custom file => File object để gửi lên server
  useEffect(() => {
    if (customThumb) {
      onThumbnailReady(customThumb)
      return
    }

    if (frames.length > 0 && selectedIdx >= 0 && selectedIdx < frames.length) {
      const b64Data = frames[selectedIdx].split(',')[1]
      const byteCharacters = atob(b64Data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'image/jpeg' })
      const thumbFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' })
      onThumbnailReady(thumbFile)
    }
  }, [frames, selectedIdx, customThumb, onThumbnailReady])

  function handleCustomThumbChange(e) {
    const f = e.target.files[0]
    if (f) {
      setCustomThumb(f)
      setSelectedIdx(-1) // Bỏ chọn frame auto
    }
  }

  if (!videoFile) return null

  return (
    <div className="thumb-picker animate-fade-in">
      <input
        type="file"
        ref={customInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleCustomThumbChange}
      />

      <div className="thumb-picker-header">
        <label className="thumb-picker-title"><Images size={16}/> Chọn Thumbnail</label>
        {loading && <span className="thumb-loading"><Loader2 size={12} className="spin-icon" /> Đang trích xuất...</span>}
      </div>

      {!!extractError && <div className="thumb-error">{extractError}</div>}

      <div className="thumb-list">
        {/* Nút Upload Custom Thumbnail */}
        <div
          className={`thumb-item custom-thumb-btn ${selectedIdx === -1 && customThumb ? 'active' : ''}`}
          onClick={() => customInputRef.current?.click()}
        >
          {customThumb ? (
            <img src={customThumbUrl || undefined} alt="Custom" className="thumb-img" />
          ) : (
             <>
               <ImagePlus size={20} className="text-muted"/>
               <span style={{fontSize: '0.65rem', color: 'var(--text-muted)'}}>Tải ảnh lên</span>
             </>
          )}
          <div className="thumb-overlay">
            <Maximize size={16}/>
          </div>
        </div>

        {/* Danh sách 10 frames tự động */}
        {!loading && frames.map((b64, idx) => (
          <div
            key={idx}
            className={`thumb-item ${selectedIdx === idx ? 'active' : ''}`}
            onClick={() => {
              setSelectedIdx(idx)
              setCustomThumb(null)
            }}
          >
            <img src={b64} alt={`Frame ${idx}`} className="thumb-img" />
            <div className="thumb-overlay">
               {selectedIdx === idx ? <CheckCircle2 size={16} color="var(--success)"/> : <Maximize size={16}/>}
            </div>
          </div>
        ))}
        
        {/* Placeholder khi đang loading */}
        {loading && Array(5).fill(0).map((_, i) => (
          <div key={i} className="thumb-item skeleton" />
        ))}
      </div>
    </div>
  )
}

function CheckCircle2(props) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
}

function useObjectUrl(file) {
  const url = useMemo(() => {
    if (!file) return ''
    return URL.createObjectURL(file)
  }, [file])

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  return url
}

async function extractFramesClientSide(file, count = 5) {
  if (!file) return []

  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true
  video.src = url

  const waitLoaded = () => new Promise((resolve, reject) => {
    const onLoaded = () => resolve()
    const onError = () => reject(new Error('Không thể đọc metadata video trên trình duyệt'))
    video.addEventListener('loadedmetadata', onLoaded, { once: true })
    video.addEventListener('error', onError, { once: true })
  })

  const seekTo = (time) => new Promise((resolve, reject) => {
    const onSeeked = () => resolve()
    const onError = () => reject(new Error('Seek video thất bại'))
    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.currentTime = time
  })

  try {
    await waitLoaded()

    const duration = Number.isFinite(video.duration) ? video.duration : 0
    if (duration <= 0) return []

    const canvas = document.createElement('canvas')
    const maxWidth = 640
    const srcW = video.videoWidth || 1280
    const srcH = video.videoHeight || 720
    const outW = srcW > maxWidth ? maxWidth : srcW
    const outH = Math.max(1, Math.round((srcH * outW) / srcW))
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return []

    const frames = []
    for (let i = 0; i < count; i++) {
      const t = (duration * (i + 1)) / (count + 1)
      await seekTo(Math.max(0, Math.min(t, duration - 0.05)))
      ctx.drawImage(video, 0, 0, outW, outH)
      frames.push(canvas.toDataURL('image/jpeg', 0.85))
    }

    return frames
  } finally {
    URL.revokeObjectURL(url)
    video.removeAttribute('src')
    video.load()
  }
}
