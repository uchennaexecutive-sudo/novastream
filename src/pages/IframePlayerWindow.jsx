import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize, Minimize, X } from 'lucide-react'
import { getEmbedsForMediaType, isMovieLikeMediaType } from '../lib/embeds'
import { addToHistory } from '../lib/supabase'
import { saveProgress } from '../lib/progress'
import { imgOriginal, imgW500 } from '../lib/tmdb'
import {
  buildResumeMessages,
  DEFAULT_SERVER_LABELS,
  parseMessagePayload,
  withResumeParams,
} from '../components/Player/iframePlayerShared'

const readPositiveInteger = (value, fallback = null) => {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : fallback
}

const readNonNegativeInteger = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback
}

const readHost = (value) => {
  try {
    return new URL(value).host.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export default function IframePlayerWindow() {
  const isTauri = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const tmdbId = searchParams.get('tmdbId') || ''
  const mediaType = searchParams.get('mediaType') || 'movie'
  const title = searchParams.get('title') || 'NOVA STREAM'
  const posterPath = searchParams.get('posterPath') || ''
  const backdropPath = searchParams.get('backdropPath') || ''
  const season = readPositiveInteger(searchParams.get('season'), 1)
  const episode = readPositiveInteger(searchParams.get('episode'), 1)
  const resumeAt = readNonNegativeInteger(searchParams.get('resumeAt'), 0)
  const durationHintSeconds = readNonNegativeInteger(searchParams.get('durationHintSeconds'), 0)
  const [sourceIndex, setSourceIndex] = useState(0)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showChrome, setShowChrome] = useState(true)
  const timeoutRef = useRef(null)
  const chromeTimerRef = useRef(null)
  const iframeRef = useRef(null)
  const playbackLoadedAtRef = useRef(0)
  const lastProgressRef = useRef({
    progressSeconds: resumeAt,
    durationSeconds: durationHintSeconds,
  })
  const resumeTimersRef = useRef([])

  const embeds = getEmbedsForMediaType(mediaType, tmdbId, season, episode)

  const resumeSeconds = Math.max(
    0,
    Math.floor(lastProgressRef.current.progressSeconds || 0),
    resumeAt
  )
  const currentUrl = withResumeParams(embeds[sourceIndex], resumeSeconds)
  const serverLabel = DEFAULT_SERVER_LABELS[sourceIndex] || `Server ${sourceIndex + 1}`
  const normalizedSeason = isMovieLikeMediaType(mediaType) ? null : season
  const normalizedEpisode = isMovieLikeMediaType(mediaType) ? null : episode
  const poster = posterPath?.startsWith?.('http') ? posterPath : imgW500(posterPath)
  const backdrop = backdropPath?.startsWith?.('http') ? backdropPath : imgOriginal(backdropPath)
  const providerHost = readHost(currentUrl)
  const footerMeta = isMovieLikeMediaType(mediaType)
    ? `${serverLabel} | ${providerHost || 'embedded provider'}`
    : `Season ${season} Episode ${episode} | ${serverLabel} | ${providerHost || 'embedded provider'}`

  const clearResumeTimers = useCallback(() => {
    resumeTimersRef.current.forEach(timer => window.clearTimeout(timer))
    resumeTimersRef.current = []
  }, [])

  const persistProgress = useCallback((overrides = {}) => {
    const progressSeconds = Math.max(
      0,
      Math.floor(
        overrides.progressSeconds
        ?? lastProgressRef.current.progressSeconds
        ?? 0
      )
    )

    if (!tmdbId || progressSeconds <= 0) return Promise.resolve(null)

    const durationSeconds = Math.max(
      0,
      Math.floor(
        overrides.durationSeconds
        ?? lastProgressRef.current.durationSeconds
        ?? durationHintSeconds
        ?? 0
      )
    )

    lastProgressRef.current = { progressSeconds, durationSeconds }

    return saveProgress({
      contentId: String(tmdbId),
      contentType: mediaType,
      title,
      poster,
      backdrop,
      season: normalizedSeason,
      episode: normalizedEpisode,
      progressSeconds,
      durationSeconds,
    })
  }, [backdrop, durationHintSeconds, mediaType, normalizedEpisode, normalizedSeason, poster, title, tmdbId])

  const persistBestGuessProgress = useCallback(() => {
    const elapsedSeconds = playbackLoadedAtRef.current
      ? Math.max(0, Math.floor((Date.now() - playbackLoadedAtRef.current) / 1000))
      : 0

    const guessedProgress = Math.max(
      lastProgressRef.current.progressSeconds || 0,
      resumeAt + elapsedSeconds
    )

    return persistProgress({
      progressSeconds: guessedProgress,
      durationSeconds: lastProgressRef.current.durationSeconds || 0,
    })
  }, [persistProgress, resumeAt])

  const sendResumeMessages = useCallback(() => {
    const targetWindow = iframeRef.current?.contentWindow
    if (!targetWindow || resumeSeconds <= 0) return

    clearResumeTimers()

    const messages = buildResumeMessages(resumeSeconds)
    const delays = [300, 1000, 2500]

    delays.forEach((delay) => {
      const timer = window.setTimeout(() => {
        messages.forEach(message => targetWindow.postMessage(message, '*'))
      }, delay)

      resumeTimersRef.current.push(timer)
    })
  }, [clearResumeTimers, resumeSeconds])

  const startTimeout = useCallback(() => {
    window.clearTimeout(timeoutRef.current)
    setLoading(true)
    timeoutRef.current = window.setTimeout(() => {
      setLoading(false)
      if (sourceIndex < embeds.length - 1) {
        setSourceIndex(index => index + 1)
      } else {
        setError(true)
      }
    }, 8000)
  }, [embeds.length, sourceIndex])

  const handleIframeLoad = useCallback(() => {
    window.clearTimeout(timeoutRef.current)
    if (!playbackLoadedAtRef.current) playbackLoadedAtRef.current = Date.now()
    setLoading(false)
    sendResumeMessages()
  }, [sendResumeMessages])

  const resetChromeTimer = useCallback(() => {
    setShowChrome(true)
    window.clearTimeout(chromeTimerRef.current)
    chromeTimerRef.current = window.setTimeout(() => setShowChrome(false), 3000)
  }, [])

  const handleClose = useCallback(() => {
    persistBestGuessProgress().catch(() => {})
    if (isTauri) {
      getCurrentWindow().close().catch(() => {})
      return
    }
    window.close()
  }, [isTauri, persistBestGuessProgress])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.().catch(() => {})
      setIsFullscreen(false)
    }
  }, [])

  const switchSource = useCallback((nextIndex) => {
    persistBestGuessProgress().catch(() => {})
    clearResumeTimers()
    playbackLoadedAtRef.current = 0
    setSourceIndex(nextIndex)
    setError(false)
    setLoading(true)
  }, [clearResumeTimers, persistBestGuessProgress])

  useEffect(() => {
    document.title = `${title} - NOVA STREAM`
  }, [title])

  useEffect(() => {
    addToHistory({
      tmdb_id: tmdbId,
      media_type: mediaType,
      title,
      poster_path: posterPath || null,
      season: normalizedSeason,
      episode: normalizedEpisode,
    }).catch(() => {})
  }, [episode, mediaType, normalizedEpisode, normalizedSeason, posterPath, season, title, tmdbId])

  useEffect(() => {
    const originalOpen = window.open
    window.open = () => null

    return () => {
      window.open = originalOpen
    }
  }, [])

  useEffect(() => {
    resetChromeTimer()
    startTimeout()

    return () => {
      window.clearTimeout(timeoutRef.current)
      window.clearTimeout(chromeTimerRef.current)
      clearResumeTimers()
      persistBestGuessProgress().catch(() => {})
    }
  }, [clearResumeTimers, persistBestGuessProgress, resetChromeTimer, startTimeout])

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    const handleMessage = (event) => {
      const iframeWindow = iframeRef.current?.contentWindow
      if (!iframeWindow || event.source !== iframeWindow) return

      const progressUpdate = parseMessagePayload(event.data)
      if (!progressUpdate) return

      if (!playbackLoadedAtRef.current) playbackLoadedAtRef.current = Date.now()

      lastProgressRef.current = {
        progressSeconds: progressUpdate.progressSeconds,
        durationSeconds: progressUpdate.durationSeconds || lastProgressRef.current.durationSeconds || durationHintSeconds,
      }

      persistProgress(progressUpdate).catch(() => {})
    }
    const handlePageHide = () => {
      persistBestGuessProgress().catch(() => {})
    }
    const handleKeyDown = (event) => {
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault()
        toggleFullscreen()
      }

      if (event.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {})
          return
        }

        handleClose()
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    window.addEventListener('message', handleMessage)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handlePageHide)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      window.removeEventListener('message', handleMessage)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handlePageHide)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [durationHintSeconds, handleClose, persistBestGuessProgress, persistProgress, toggleFullscreen])

  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseMove={resetChromeTimer}
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose()
      }}
    >
      {backdrop && (
        <img
          src={backdrop}
          alt={title}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(28px)',
            opacity: 0.18,
            transform: 'scale(1.06)',
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at top, rgba(139,92,246,0.18), transparent 38%), rgba(0,0,0,0.55)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          width: isFullscreen ? '100vw' : '92vw',
          height: isFullscreen ? '100vh' : '88vh',
          maxWidth: isFullscreen ? '100vw' : 1600,
          borderRadius: isFullscreen ? 0 : 16,
          overflow: 'hidden',
          border: isFullscreen ? 'none' : '1px solid var(--border)',
          boxShadow: isFullscreen ? 'none' : '0 0 80px rgba(0,0,0,0.9)',
          background: '#000',
          cursor: showChrome ? 'default' : 'none',
        }}
      >
      {backdrop && (
        <img
          src={backdrop}
          alt={title}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(24px)',
            opacity: 0.12,
            transform: 'scale(1.04)',
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.48), rgba(0,0,0,0.2) 20%, rgba(0,0,0,0.82))',
          pointerEvents: 'none',
        }}
      />
      <AnimatePresence>
        {showChrome && (
          <motion.div
            className="absolute top-0 left-0 right-0 z-20"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0.24), transparent)',
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
              {embeds.map((_, index) => (
                <button
                  key={index}
                  onClick={() => switchSource(index)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5"
                  type="button"
                  style={{
                    background: index === sourceIndex ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                    color: index === sourceIndex ? '#fff' : 'rgba(255,255,255,0.78)',
                    boxShadow: index === sourceIndex ? '0 0 16px var(--accent-glow)' : 'none',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {index === sourceIndex && loading && (
                    <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  )}
                  {DEFAULT_SERVER_LABELS[index] || `Server ${index + 1}`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
              <button
                onClick={toggleFullscreen}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
                type="button"
                title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
              >
                {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
              </button>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
                type="button"
                title="Close player"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
          <span className="text-4xl opacity-40">!</span>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            All servers exhausted. Try opening in a browser.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => switchSource(0)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              Retry {DEFAULT_SERVER_LABELS[0] || 'Server 1'}
            </button>
            <a
              href={withResumeParams(embeds[0], resumeSeconds)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-2"
              style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 0 20px var(--accent-glow)' }}
            >
              Open in Browser
            </a>
          </div>
        </div>
          ) : (
        <>
          <iframe
            ref={iframeRef}
            key={`${currentUrl}-${sourceIndex}-${resumeSeconds}`}
            src={currentUrl}
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            referrerPolicy="no-referrer"
            loading="eager"
            style={{
              position: 'absolute',
              top: isFullscreen ? 0 : 52,
              left: 0,
              width: '100%',
              height: isFullscreen ? '100%' : 'calc(100% - 120px)',
              border: 'none',
              background: '#000',
            }}
            onLoad={handleIframeLoad}
            onError={() => {
              window.clearTimeout(timeoutRef.current)
              if (sourceIndex < embeds.length - 1) {
                setSourceIndex(index => index + 1)
              } else {
                setError(true)
              }
            }}
          />

          {loading && (
            <div
              style={{
                position: 'absolute',
                top: isFullscreen ? 0 : 52,
                left: 0,
                right: 0,
                bottom: isFullscreen ? 0 : 68,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.28)',
                zIndex: 12,
              }}
            >
              <div className="flex flex-col items-center gap-3">
                <span className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                <span className="text-sm text-white/60 font-mono">
                  Loading {serverLabel}...
                </span>
                <span className="text-xs text-white/40">{providerHost || 'embedded player'}</span>
              </div>
            </div>
          )}
        </>
      )}
      {!error && showChrome && !isFullscreen && (
        <motion.div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            padding: '16px 18px 14px',
            background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.78) 18%, rgba(0,0,0,0.92))',
            backdropFilter: 'blur(14px)',
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">{title}</div>
              <div className="text-xs text-white/50 truncate">
                {isMovieLikeMediaType(mediaType)
                  ? `${mediaType === 'animation' ? 'Animation' : 'Movie'} playback via embedded provider`
                  : `Embedded playback for Season ${season} Episode ${episode}`}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={withResumeParams(embeds[sourceIndex], resumeSeconds)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 h-10 rounded-xl inline-flex items-center text-xs font-semibold text-white whitespace-nowrap"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                Open in Browser
              </a>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-white/55">
            <span>{footerMeta}</span>
            <span>Provider controls stay inside the player frame</span>
          </div>
        </motion.div>
      )}
      </div>
    </div>
  )
}

