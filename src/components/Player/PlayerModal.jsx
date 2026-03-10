import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize, Minimize, X } from 'lucide-react'
import { getMovieEmbeds, getSeriesEmbeds } from '../../lib/embeds'
import { addToHistory } from '../../lib/supabase'
import PlayerControls from './PlayerControls'

// Human-readable server labels
const SERVER_LABELS = [
  'VidSrc XYZ',
  'VidSrc Net',
  'VidSrc Me',
  'AutoEmbed',
  'MoviesAPI',
  'NontonFilm',
]

export default function PlayerModal({ isOpen, onClose, tmdbId, mediaType, title, posterPath, season, episode }) {
  const [sourceIndex, setSourceIndex] = useState(0)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showChrome, setShowChrome] = useState(true)

  const timeoutRef = useRef(null)
  const chromeTimerRef = useRef(null)
  const playerContainerRef = useRef(null)
  const iframeRef = useRef(null)

  const embeds = mediaType === 'movie'
    ? getMovieEmbeds(tmdbId)
    : getSeriesEmbeds(tmdbId, season, episode)

  const currentUrl = embeds[sourceIndex]
  const serverLabel = SERVER_LABELS[sourceIndex] || `Server ${sourceIndex + 1}`

  // ─── Ad blocking: re-focus window when iframe steals focus (ad popup) ───
  useEffect(() => {
    if (!isOpen) return
    const handleBlur = () => {
      setTimeout(() => {
        if (document.activeElement?.tagName === 'IFRAME') {
          window.focus()
        }
      }, 0)
    }
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [isOpen])

  // ─── Block window.open popups at the page level ───
  useEffect(() => {
    if (!isOpen) return
    const origOpen = window.open
    window.open = () => null
    return () => { window.open = origOpen }
  }, [isOpen])

  // ─── Auto-advance to next source after 8s timeout ───
  const startTimeout = useCallback(() => {
    clearTimeout(timeoutRef.current)
    setLoading(true)
    timeoutRef.current = setTimeout(() => {
      setLoading(false)
      if (sourceIndex < embeds.length - 1) {
        setSourceIndex(i => i + 1)
      } else {
        setError(true)
      }
    }, 8000)
  }, [sourceIndex, embeds.length])

  const handleIframeLoad = useCallback(() => {
    clearTimeout(timeoutRef.current)
    setLoading(false)
  }, [])

  // ─── Init on open ───
  useEffect(() => {
    if (isOpen) {
      setSourceIndex(0)
      setError(false)
      setLoading(true)
      setShowChrome(true)
      addToHistory({
        tmdb_id: tmdbId,
        media_type: mediaType,
        title,
        poster_path: posterPath,
        season,
        episode,
      }).catch(() => {})
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
    return () => clearTimeout(timeoutRef.current)
  }, [isOpen, tmdbId, season, episode])

  // ─── Start timeout on source change ───
  useEffect(() => {
    if (isOpen && !error) {
      startTimeout()
    }
    return () => clearTimeout(timeoutRef.current)
  }, [sourceIndex, isOpen, error])

  // ─── Fullscreen change listener ───
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // ─── Keyboard: F for fullscreen, Escape to close ───
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        toggleFullscreen()
      }
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {})
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // ─── Chrome auto-hide (show on mouse move, fade after 3s) ───
  const resetChromeTimer = useCallback(() => {
    setShowChrome(true)
    clearTimeout(chromeTimerRef.current)
    chromeTimerRef.current = setTimeout(() => setShowChrome(false), 3000)
  }, [])

  useEffect(() => {
    if (isOpen) {
      resetChromeTimer()
    }
    return () => clearTimeout(chromeTimerRef.current)
  }, [isOpen])

  // ─── Actions ───
  const toggleFullscreen = () => {
    const container = playerContainerRef.current
    if (!container) return
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  const switchSource = (i) => {
    setSourceIndex(i)
    setError(false)
    setLoading(true)
  }

  const nextSource = () => {
    if (sourceIndex < embeds.length - 1) {
      switchSource(sourceIndex + 1)
    } else {
      switchSource(0)
    }
  }

  if (!isOpen) return null

  // ─── Render via Portal to document.body ───
  return createPortal(
    <AnimatePresence>
      {/* Overlay — flexbox centered */}
      <motion.div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 9999,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        {/* Modal container */}
        <motion.div
          ref={playerContainerRef}
          style={{
            position: 'relative',
            width: isFullscreen ? '100vw' : '92vw',
            height: isFullscreen ? '100vh' : '88vh',
            maxWidth: isFullscreen ? '100vw' : 1600,
            borderRadius: isFullscreen ? 0 : 16,
            overflow: 'hidden',
            background: '#000',
            border: isFullscreen ? 'none' : '1px solid var(--border)',
            boxShadow: isFullscreen ? 'none' : '0 0 80px rgba(0,0,0,0.9)',
            display: 'flex',
            flexDirection: 'column',
          }}
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          onMouseMove={resetChromeTimer}
        >
          {/* ─── Top Bar — Source Tabs + Fullscreen + Close ─── */}
          <AnimatePresence>
            {showChrome && (
              <motion.div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  flexShrink: 0,
                  background: 'rgba(0,0,0,0.7)',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(12px)',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  zIndex: 20,
                }}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
                  {embeds.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => switchSource(i)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5"
                      style={{
                        background: i === sourceIndex ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                        color: i === sourceIndex ? '#fff' : 'rgba(255,255,255,0.5)',
                        boxShadow: i === sourceIndex ? '0 0 16px var(--accent-glow)' : 'none',
                      }}
                    >
                      {i === sourceIndex && loading && (
                        <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      )}
                      Server {i + 1}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  <button
                    onClick={toggleFullscreen}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
                    title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
                  >
                    {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                  </button>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Player Area ─── */}
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            {error ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <span className="text-4xl opacity-40">⚠</span>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  All servers exhausted. Try opening in a new tab.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => switchSource(0)}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    Retry Server 1
                  </button>
                  <a
                    href={embeds[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-2"
                    style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 0 20px var(--accent-glow)' }}
                  >
                    Open in New Tab
                  </a>
                </div>
              </div>
            ) : (
              <>
                <iframe
                  ref={iframeRef}
                  key={`${currentUrl}-${sourceIndex}`}
                  src={currentUrl}
                  allowFullScreen
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    border: 'none',
                  }}
                  onLoad={handleIframeLoad}
                  onError={() => {
                    clearTimeout(timeoutRef.current)
                    if (sourceIndex < embeds.length - 1) {
                      setSourceIndex(i => i + 1)
                    } else {
                      setError(true)
                    }
                  }}
                />

                {/* Gradient overlay to visually hide source controls at bottom */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 80,
                    background: 'linear-gradient(to top, #000000 0%, transparent 100%)',
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                />

                {/* Loading overlay */}
                {loading && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', zIndex: 5 }}>
                    <div className="flex flex-col items-center gap-3">
                      <span className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                      <span className="text-xs text-white/50 font-mono">
                        Loading {serverLabel}...
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ─── Bottom Custom Controls ─── */}
          <AnimatePresence>
            {showChrome && !error && (
              <motion.div
                style={{
                  flexShrink: 0,
                  background: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 20,
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
              >
                <PlayerControls
                  iframeRef={iframeRef}
                  serverLabel={serverLabel}
                  title={title}
                  season={season}
                  episode={episode}
                  currentUrl={currentUrl}
                  onNextSource={nextSource}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
