import { useMemo, useState, useRef } from 'react'
import './PostPreview.css'

export default function PostPreview({ form, videoFile, thumbnailFile, imageFile, pageName }) {
  const [activeCard, setActiveCard] = useState(0)
  const trackRef = useRef(null)

  const videoUrl = useMemo(() => videoFile ? URL.createObjectURL(videoFile) : null, [videoFile])
  const thumbUrl = useMemo(() => thumbnailFile ? URL.createObjectURL(thumbnailFile) : null, [thumbnailFile])
  const imageUrl = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : null, [imageFile])

  const getCtaLabel = (val) => {
    const map = {
      'LEARN_MORE': 'Tìm hiểu thêm', 'SHOP_NOW': 'Mua ngay', 'SIGN_UP': 'Đăng ký',
      'DOWNLOAD': 'Tải xuống', 'BOOK_NOW': 'Đặt lịch', 'CONTACT_US': 'Liên hệ',
      'GET_QUOTE': 'Nhận báo giá', 'GET_OFFER': 'Nhận ưu đãi', 'ORDER_NOW': 'Đặt hàng ngay',
      'APPLY_NOW': 'Ứng tuyển', 'WATCH_MORE': 'Xem thêm', 'LISTEN_NOW': 'Nghe ngay',
      'CALL_NOW': 'Gọi ngay', 'PLAY_GAME': 'Chơi game', 'USE_APP': 'Dùng ứng dụng',
      'SEND_MESSAGE': 'Gửi tin nhắn', 'WHATSAPP_MESSAGE': 'Nhắn tin WhatsApp',
      'SUBSCRIBE': 'Đăng ký', 'NO_BUTTON': null
    }
    return map[val] || 'Mở liên kết'
  }

  const cards = [
    {
      media: videoFile ? (
        <video
          src={videoUrl}
          poster={thumbUrl || undefined}
          muted loop playsInline
          onMouseEnter={e => e.target.play()}
          onMouseLeave={e => { e.target.pause(); e.target.currentTime = 0 }}
        />
      ) : thumbUrl ? (
        <img src={thumbUrl} alt="Thumbnail" />
      ) : (
        <div className="fb-card-empty"><span>🎬</span><small>Video Card 1</small></div>
      ),
      showPlay: !!(videoFile || thumbUrl),
      title: form.card1Title || 'Chi tiết sản phẩm 👉',
      desc: form.card1Desc,
      cta: form.card1Cta,
    },
    {
      media: imageUrl ? (
        <img src={imageUrl} alt="Card 2" />
      ) : (
        <div className="fb-card-empty"><span>🖼️</span><small>Ảnh Card 2</small></div>
      ),
      showPlay: false,
      title: form.card2Title || 'Xem thêm tại đây 👉',
      desc: form.card2Desc,
      cta: form.card2Cta,
    },
  ]

  const goTo = (idx) => setActiveCard(Math.max(0, Math.min(cards.length - 1, idx)))

  return (
    <div className="post-preview">
      <div className="preview-label">👁 Xem trước bài viết</div>

      <div className="fb-mock">

        {/* ── Header ── */}
        <div className="fb-header">
          <div className="fb-avatar">
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(pageName || 'P')}&background=4267B2&color=fff&bold=true`}
              alt="avatar"
            />
          </div>
          <div className="fb-header-info">
            <div className="fb-page-name">{pageName || 'Tên Fanpage'}</div>
            <div className="fb-post-meta">8 giờ · <span>🌐</span></div>
          </div>
          <div className="fb-dots">···</div>
        </div>

        {/* ── Caption ── */}
        <div className="fb-caption">
          {form.message || <span className="fb-caption-empty">Nội dung caption sẽ hiển thị ở đây...</span>}
        </div>

        {/* ── Carousel ── */}
        <div className="fb-carousel-shell">
          {/* Cards track natively horizontally scrollable */}
          <div
            className="fb-cards-track"
            ref={trackRef}
            onScroll={(e) => {
              // Update dot on manual scroll
              const scrollLeft = e.target.scrollLeft;
              const width = e.target.clientWidth;
              const idx = Math.round(scrollLeft / width);
              if (idx !== activeCard && idx >= 0 && idx < cards.length) {
                setActiveCard(idx);
              }
            }}
          >
            {cards.map((card, i) => (
              <div key={i} className="fb-card">
                {/* Media */}
                <div className="fb-card-media">
                  {card.media}
                  {card.showPlay && (
                    <div className="fb-play-overlay">
                      <div className="fb-play-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer: title+desc LEFT, button RIGHT */}
                <div className="fb-card-footer">
                  <div className="fb-card-text">
                    <div className="fb-card-title">{card.title}</div>
                    {card.desc && <div className="fb-card-desc">{card.desc}</div>}
                  </div>
                  {card.cta !== 'NO_BUTTON' && (
                    <button className="fb-cta-btn" tabIndex={-1}>{getCtaLabel(card.cta)}</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Next button */}
          {activeCard < cards.length - 1 && (
            <button className="fb-nav-btn fb-nav-next" onClick={() => {
              const el = trackRef.current;
              if (el) el.scrollBy({ left: el.clientWidth * 0.85, behavior: 'smooth' });
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#333">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
              </svg>
            </button>
          )}

          {/* Prev button */}
          {activeCard > 0 && (
            <button className="fb-nav-btn fb-nav-prev" onClick={() => {
              const el = trackRef.current;
              if (el) el.scrollBy({ left: -el.clientWidth * 0.85, behavior: 'smooth' });
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#333">
                <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/>
              </svg>
            </button>
          )}

          {/* Dot indicators */}
          <div className="fb-dots-indicator">
            {cards.map((_, i) => (
              <button
                key={i}
                className={`fb-dot ${i === activeCard ? 'fb-dot-active' : ''}`}
                onClick={() => {
                  const el = trackRef.current;
                  if (el) {
                    const cardNodes = el.children;
                    if (cardNodes[i]) cardNodes[i].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
                  }
                }}
              />
            ))}
          </div>
        </div>

        {/* ── Reaction stats ── */}
        <div className="fb-stats-bar">
          <div className="fb-reactions">
            <span className="fb-react-emoji">👍</span>
            <span className="fb-react-emoji">❤️</span>
            <span className="fb-react-emoji">😮</span>
            <span className="fb-react-count">58</span>
          </div>
          <div className="fb-comment-count">1 bình luận</div>
        </div>

        {/* ── Action buttons ── */}
        <div className="fb-action-bar">
          <button className="fb-action-btn">👍  Thích</button>
          <button className="fb-action-btn">💬  Bình luận</button>
          <button className="fb-action-btn">↗  Chia sẻ</button>
        </div>

      </div>
    </div>
  )
}
