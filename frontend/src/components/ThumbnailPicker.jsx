import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Images, Loader2, Maximize } from 'lucide-react'
import './ThumbnailPicker.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function ThumbnailPicker({ videoFile, onThumbnailReady }) {
  const [frames, setFrames] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const [customThumb, setCustomThumb] = useState(null)
  
  // Ref for the hidden file input (for custom thumbnail)
  const customInputRef = useRef(null)

  useEffect(() => {
    if (!videoFile) {
      setFrames([])
      setSelectedIdx(0)
      setCustomThumb(null)
      onThumbnailReady(null)
      return
    }

    setLoading(true)
    const fd = new FormData()
    fd.append('video_file', videoFile)

    fetch(`${API}/api/tools/extract-frames`, {
      method: 'POST',
      body: fd
    })
      .then(res => res.json())
      .then(data => {
        if (data.frames) {
          setFrames(data.frames)
          setSelectedIdx(0) // Mặc định chọn frame 0
        }
      })
      .catch(err => console.error('Lỗi khi extract frames:', err))
      .finally(() => setLoading(false))
  }, [videoFile])

  // Convert frame b64 / custom file => File object để gửi lên server
  useEffect(() => {
    if (customThumb) {
      onThumbnailReady(customThumb)
      return
    }

    if (frames.length > 0) {
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
      <div className="thumb-picker-header">
        <label className="thumb-picker-title"><Images size={16}/> Chọn Thumbnail</label>
        {loading && <span className="thumb-loading"><Loader2 size={12} className="spin-icon" /> Đang trích xuất...</span>}
      </div>

      <div className="thumb-list">
        {/* Nút Upload Custom Thumbnail */}
        <div
          className={`thumb-item custom-thumb-btn ${selectedIdx === -1 && customThumb ? 'active' : ''}`}
          onClick={() => customInputRef.current?.click()}
        >
          {customThumb ? (
            <img src={URL.createObjectURL(customThumb)} alt="Custom" className="thumb-img" />
          ) : (
             <>
               <input
                 type="file"
                 ref={customInputRef}
                 accept="image/*"
                 style={{ display: 'none' }}
                 onChange={handleCustomThumbChange}
               />
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
