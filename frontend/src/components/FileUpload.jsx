import { useRef, useState } from 'react'
import { UploadCloud, CheckCircle2 } from 'lucide-react'
import './FileUpload.css'

export default function FileUpload({ id, label, accept, icon, file, onFile }) {
  const inputRef = useRef(null)
  const [isDragOver, setIsDragOver] = useState(false)

  function handleChange(e) {
    onFile(e.target.files[0] || null)
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  function handleDragOver(e) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div
      className={`file-drop ${file ? 'has-file' : ''} ${isDragOver ? 'drag-over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      id={id}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      <div className="file-icon-container">
        {file ? (
          <CheckCircle2 size={36} className="text-success" />
        ) : (
          <div className="icon-wrapper">
             {icon || <UploadCloud size={32} />}
          </div>
        )}
      </div>

      <div className="file-content">
        <div className="file-label-text">{label}</div>

        {file ? (
          <div className="file-info-box border-success">
            <span className="file-name">{file.name}</span>
            <span className="file-size badge badge-success">{formatSize(file.size)}</span>
          </div>
        ) : (
          <div className="file-placeholder">
            <span>Kéo thả file vào đây hoặc</span>
            <span className="browse-text">duyệt qua máy tính</span>
          </div>
        )}
      </div>
    </div>
  )
}
