import { useState, useRef, useEffect, useMemo } from 'react'
import { MoreHorizontal, X, ThumbsUp, MessageCircle, Share, Globe, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import './PostPreview.css'

export default function PostPreview({ form, videoFile, thumbnailFile, imageFile, pageName }) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const videoRef = useRef(null)
  const videoUrl = useObjectUrl(videoFile)
  const thumbnailUrl = useObjectUrl(thumbnailFile)
  const imageUrl = useObjectUrl(imageFile)

  // Auto-play / pause video in carousel based on visibility
  useEffect(() => {
    if (currentSlide === 0 && videoRef.current) {
      videoRef.current.play().catch(() => {})
    } else if (currentSlide !== 0 && videoRef.current) {
      videoRef.current.pause()
    }
  }, [currentSlide])

  // Get CTA text properly
  const getCtaLabel = (type) => {
    if (!type || type === 'NO_BUTTON') return ''
    const map = {
      LEARN_MORE: 'Tìm hiểu thêm',
      SHOP_NOW: 'Mua ngay',
      SIGN_UP: 'Đăng ký',
      DOWNLOAD: 'Tải xuống',
      BOOK_NOW: 'Đặt lịch ngay',
      CONTACT_US: 'Liên hệ chúng tôi',
      SEND_MESSAGE: 'Gửi tin nhắn',
      WATCH_MORE: 'Xem thêm',
      LISTEN_NOW: 'Nghe ngay',
      USE_APP: 'Sử dụng ứng dụng',
      PLAY_GAME: 'Chơi trò chơi',
      GET_QUOTE: 'Nhận báo giá',
      GET_OFFER: 'Nhận ưu đãi',
      ORDER_NOW: 'Đặt hàng ngay',
      APPLY_NOW: 'Ứng tuyển ngay',
      CALL_NOW: 'Gọi ngay',
      WHATSAPP_MESSAGE: 'Gửi tin nhắn WhatsApp',
      SUBSCRIBE: 'Đăng ký theo dõi',
    }
    return map[type] || 'Tìm hiểu thêm'
  }

  const handleNext = () => setCurrentSlide(1)
  const handlePrev = () => setCurrentSlide(0)

  // Determine hostname for links
  const getDomain = (url) => {
    if (!url) return ''
    try {
      return new URL(url).hostname.replace('www.', '').toUpperCase()
    } catch {
      return 'TRANG WEB'
    }
  }

  return (
    <div className="fb-preview-card animate-fade-in">
      {/* ── HEADER ── */}
      <div className="fb-header">
        <div className="fb-avatar">
            <span className="fb-avatar-text">{pageName ? pageName.charAt(0) : 'F'}</span>
        </div>
        <div className="fb-meta">
          <div className="fb-name">{pageName || 'Tên Fanpage của bạn'}</div>
          <div className="fb-time">
            Được tài trợ <Globe size={12} className="fb-icon-small" />
          </div>
        </div>
        <div className="fb-options">
          <MoreHorizontal size={20} />
          <X size={20} className="close-icon" />
        </div>
      </div>

      {/* ── CAPTION ── */}
      <div className="fb-caption">
        {form.message ? (
          form.message.split('\n').map((line, i) => (
            <span key={i}>
              {line}
              <br />
            </span>
          ))
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>Nhập nội dung bài viết...</span>
        )}
      </div>

      {/* ── CONTENT AREA (CAROUSEL) ── */}
      <div className="fb-carousel-container">
        <div
          className="fb-carousel-track"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {/* Card 1: Video */}
          <div className="fb-carousel-slide">
            <div className="fb-card">
              <div className="fb-card-media-wrapper">
                  {videoFile ? (
                    <video
                      ref={videoRef}
                      className="fb-card-media"
                      src={videoUrl || undefined}
                      muted
                      loop
                      playsInline
                    />
                  ) : thumbnailFile ? (
                    <img className="fb-card-media" src={thumbnailUrl || undefined} alt="" />
                  ) : (
                    <div className="fb-card-placeholder">
                      <Play size={48} opacity={0.2} />
                    </div>
                  )}
              </div>
              <div className="fb-card-info">
                <div className="fb-card-text">
                  <div className="fb-domain">{getDomain(form.card1Link)}</div>
                  <div className="fb-title">{form.card1Title || 'Tiêu đề thẻ 1'}</div>
                  {form.card1Desc && <div className="fb-desc">{form.card1Desc}</div>}
                </div>
                {form.card1Cta && form.card1Cta !== 'NO_BUTTON' && (
                  <button className="fb-cta-btn">{getCtaLabel(form.card1Cta)}</button>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Image */}
          <div className="fb-carousel-slide">
            <div className="fb-card">
               <div className="fb-card-media-wrapper">
                  {imageFile ? (
                    <img className="fb-card-media" src={imageUrl || undefined} alt="" />
                  ) : (
                    <div className="fb-card-placeholder">
                       <span style={{color: 'var(--text-muted)'}}>Hình ảnh</span>
                    </div>
                  )}
              </div>
              <div className="fb-card-info">
                <div className="fb-card-text">
                  <div className="fb-domain">{getDomain(form.card2Link)}</div>
                  <div className="fb-title">{form.card2Title || 'Tiêu đề thẻ 2'}</div>
                  {form.card2Desc && <div className="fb-desc">{form.card2Desc}</div>}
                </div>
                {form.card2Cta && form.card2Cta !== 'NO_BUTTON' && (
                  <button className="fb-cta-btn">{getCtaLabel(form.card2Cta)}</button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation arrows (only show if valid) */}
        {currentSlide > 0 && (
          <button className="fb-nav-btn fb-nav-prev" onClick={handlePrev}>
             <ChevronLeft size={24} />
          </button>
        )}
        {currentSlide === 0 && (
          <button className="fb-nav-btn fb-nav-next" onClick={handleNext}>
             <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* ── ENGAGEMENT BAR ── */}
      <div className="fb-footer">
        <div className="fb-stats">
          <div className="fb-reactions">
            <div className="fb-reac-icon thumb-icon">👍</div>
            <div className="fb-reac-icon heart-icon">❤️</div>
            <span style={{marginLeft: 4}}>1,2k</span>
          </div>
          <div className="fb-comments">12 bình luận • 8 lượt chia sẻ</div>
        </div>
        <div className="fb-actions">
          <button className="fb-action-btn"><ThumbsUp size={18} /> Thích</button>
          <button className="fb-action-btn"><MessageCircle size={18} /> Bình luận</button>
          <button className="fb-action-btn"><Share size={18} /> Chia sẻ</button>
        </div>
      </div>
    </div>
  )
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
