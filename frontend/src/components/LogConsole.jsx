import { useEffect, useRef } from 'react'
import './LogConsole.css'

const LEVEL_ICON = {
  info:    '→',
  success: '✓',
  error:   '✕',
  link:    '🔗',
}

const LEVEL_CLASS = {
  info:    'log-info',
  success: 'log-success',
  error:   'log-error',
  link:    'log-link',
}

export default function LogConsole({ logs, done, permalink, onReset }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const isEmpty = logs.length === 0 && !done

  return (
    <div className="log-console glass">
      <div className="log-header">
        <span className="log-title">
          <span className={`status-dot ${done ? 'done' : logs.length > 0 ? 'active' : 'idle'}`} />
          Console Log
        </span>
        {(done || logs.length > 0) && (
          <button className="btn-reset" onClick={onReset}>↺ Reset</button>
        )}
      </div>

      <div className="log-body">
        {isEmpty ? (
          <div className="log-empty">
            <span className="log-empty-icon">📋</span>
            <span>Log sẽ xuất hiện ở đây khi bắt đầu đăng bài...</span>
          </div>
        ) : (
          logs.map((entry, i) => (
            <div key={i} className={`log-line ${LEVEL_CLASS[entry.level] || 'log-info'}`}>
              <span className="log-icon">{LEVEL_ICON[entry.level] || '·'}</span>
              <span className="log-msg">{entry.msg}</span>
            </div>
          ))
        )}

        {done && permalink && (
          <div className="log-permalink">
            <span>🎉 Bài đã được đăng thành công!</span>
            <a href={permalink} target="_blank" rel="noreferrer" className="permalink-link">
              🔗 Xem bài trên Facebook
            </a>
          </div>
        )}

        {done && !permalink && logs.some(l => l.level === 'error') && (
          <div className="log-line log-error">
            <span className="log-icon">✕</span>
            <span className="log-msg">Quá trình kết thúc với lỗi.</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
