import { useRef } from 'react'
import './FileUpload.css'

export default function FileUpload({ id, label, accept, icon, file, onFile }) {
  const inputRef = useRef(null)

  function handleChange(e) {
    onFile(e.target.files[0] || null)
  }

  function handleDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div
      className={`file-drop ${file ? 'has-file' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      id={id}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      <div className="file-icon">{file ? '✅' : icon}</div>
      <div className="file-label">{label}</div>

      {file ? (
        <div className="file-info">
          <span className="file-name">{file.name}</span>
          <span className="file-size">{formatSize(file.size)}</span>
        </div>
      ) : (
        <div className="file-placeholder">Kéo thả hoặc click để chọn</div>
      )}
    </div>
  )
}
