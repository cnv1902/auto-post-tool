import { useState, useEffect, useRef } from 'react'
import './ThumbnailPicker.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function ThumbnailPicker({ videoFile, onThumbnailReady }) {
  const [frames, setFrames] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const [extracting, setExtracting] = useState(false)
  const [customFile, setCustomFile] = useState(null)
  const [customPreview, setCustomPreview] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  // Khi videoFile thay đổi → extract frames
  useEffect(() => {
    if (!videoFile) {
      setFrames([])
      setSelectedIdx(-1)
      setCustomFile(null)
      setCustomPreview(null)
      setError(null)
      return
    }

    let cancelled = false

    async function extract() {
      setExtracting(true)
      setError(null)
      setFrames([])
      setSelectedIdx(-1)
      setCustomFile(null)
      setCustomPreview(null)

      try {
        const fd = new FormData()
        fd.append('video', videoFile)

        const res = await fetch(`${API}/api/video/extract-frames`, {
          method: 'POST',
          body: fd,
        })

        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.detail || 'Không thể trích xuất frame')
        }

        const data = await res.json()
        if (!cancelled) {
          setFrames(data.frames || [])
          // Tự chọn frame giữa làm mặc định
          if (data.frames?.length > 0) {
            const mid = Math.floor(data.frames.length / 2)
            setSelectedIdx(mid)
            // Convert base64 to File object
            const blob = await (await fetch(data.frames[mid])).blob()
            const file = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' })
            onThumbnailReady(file)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
        }
      } finally {
        if (!cancelled) setExtracting(false)
      }
    }

    extract()
    return () => { cancelled = true }
  }, [videoFile])

  // Chọn 1 frame
  async function selectFrame(idx) {
    setSelectedIdx(idx)
    setCustomFile(null)
    setCustomPreview(null)
    // Convert base64 frame to File
    try {
      const blob = await (await fetch(frames[idx])).blob()
      const file = new File([blob], `frame_${idx}.jpg`, { type: 'image/jpeg' })
      onThumbnailReady(file)
    } catch (e) {
      console.error('Failed to convert frame:', e)
    }
  }

  // Upload ảnh tùy chọn
  function handleCustomUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setCustomFile(file)
    setSelectedIdx(-1)
    setCustomPreview(URL.createObjectURL(file))
    onThumbnailReady(file)
  }

  if (!videoFile) return null

  return (
    <div className="thumb-picker">
      <div className="thumb-picker-header">
        <span className="thumb-picker-title">🖼️ Chọn Thumbnail</span>
        {extracting && (
          <span className="thumb-extracting">
            <span className="spinner-sm" />
            Đang trích xuất...
          </span>
        )}
      </div>

      {error && (
        <div className="thumb-error">⚠️ {error}</div>
      )}

      {frames.length > 0 && (
        <div className="thumb-grid">
          {frames.map((src, i) => (
            <div
              key={i}
              className={`thumb-frame ${selectedIdx === i ? 'selected' : ''}`}
              onClick={() => selectFrame(i)}
            >
              <img src={src} alt={`Frame ${i + 1}`} />
              <span className="thumb-frame-num">#{i + 1}</span>
              {selectedIdx === i && <span className="thumb-check">✓</span>}
            </div>
          ))}
        </div>
      )}

      <div className="thumb-custom-row">
        <button
          className="thumb-custom-btn"
          onClick={() => fileRef.current?.click()}
          type="button"
        >
          📁 Tải ảnh khác
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/*"
          style={{ display: 'none' }}
          onChange={handleCustomUpload}
        />
        {customPreview && (
          <div className={`thumb-frame custom-thumb selected`}>
            <img src={customPreview} alt="Custom" />
            <span className="thumb-frame-num">Tùy chọn</span>
            <span className="thumb-check">✓</span>
          </div>
        )}
      </div>
    </div>
  )
}
