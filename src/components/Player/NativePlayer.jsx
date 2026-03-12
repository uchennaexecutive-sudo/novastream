import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Hls from 'hls.js'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Maximize, Minimize, Pause, Play, X } from 'lucide-react'

const SERVER_NAMES = [
  ['vidsrc.xyz', 'VidSrc XYZ'],
  ['vidsrc.net', 'VidSrc Net'],
  ['vidsrc.me', 'VidSrc Me'],
  ['autoembed.cc', 'AutoEmbed'],
  ['moviesapi.club', 'MoviesAPI'],
]

function resolveServerName(embedUrl, fallback) {
  if (fallback) return fallback

  const match = SERVER_NAMES.find(([pattern]) => embedUrl?.includes(pattern))
  return match?.[1] || 'Native Player'
}

export default function NativePlayer({
  embedUrl,
  title,
  onClose,
  onFailure,
  isAnime = false,
  serverName,
}) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const autoAdvanceRef = useRef(false)
  const [status, setStatus] = useState('capturing')
  const [statusText, setStatusText] = useState('Connecting to server...')
  const [streamUrl, setStreamUrl] = useState('')
  const [error, setError] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const currentServerName = useMemo(
    () => resolveServerName(embedUrl, serverName),
    [embedUrl, serverName]
  )

  useEffect(() => {
    let mounted = true
    let unlistenCaptured = null
    let unlistenFailed = null

    autoAdvanceRef.current = false
    setStatus('capturing')
    setStatusText('Connecting to server...')
    setStreamUrl('')
    setError('')
    setIsPlaying(false)

    const timers = [
      setTimeout(() => {
        if (mounted) setStatusText('Still loading, please wait...')
      }, 5000),
      setTimeout(() => {
        if (mounted) setStatusText('Taking longer than usual...')
      }, 10000),
    ]

    const handleFailure = () => {
      if (!mounted) return
      setStatus('error')
      setError('Could not load stream')

      if (autoAdvanceRef.current) return
      autoAdvanceRef.current = true

      setTimeout(() => {
        if (!mounted || typeof onFailure !== 'function') return
        const advanced = onFailure()
        if (advanced === false) {
          autoAdvanceRef.current = false
        }
      }, 800)
    }

    Promise.all([
      listen('stream-captured', (event) => {
        if (!mounted) return
        const url = typeof event.payload === 'string' ? event.payload : event.payload?.url
        if (!url) return

        timers.forEach(clearTimeout)
        setStreamUrl(url)
        setStatus('ready')
        setError('')
      }),
      listen('stream-capture-failed', handleFailure),
    ])
      .then(([capturedCleanup, failedCleanup]) => {
        unlistenCaptured = capturedCleanup
        unlistenFailed = failedCleanup
        return invoke('capture_stream', { embedUrl })
      })
      .catch(() => {
        handleFailure()
      })

    return () => {
      mounted = false
      timers.forEach(clearTimeout)
      if (typeof unlistenCaptured === 'function') unlistenCaptured()
      if (typeof unlistenFailed === 'function') unlistenFailed()
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [embedUrl, onFailure])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !streamUrl) return

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const isHlsStream = streamUrl.includes('.m3u8')

    if (isHlsStream && Hls.isSupported()) {
      const hls = new Hls()
      hlsRef.current = hls
      hls.loadSource(streamUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data?.fatal) {
          setStatus('error')
          setError('Could not load stream')
        }
      })
      return () => {
        hls.destroy()
        hlsRef.current = null
      }
    }

    video.src = streamUrl
    const handleLoaded = () => {
      video.play().catch(() => {})
    }

    video.addEventListener('loadedmetadata', handleLoaded)
    return () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
      video.removeEventListener('loadedmetadata', handleLoaded)
    }
  }, [streamUrl])

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    const handleKeyDown = (event) => {
      if (event.key === ' ') {
        event.preventDefault()
        togglePlayback()
      }

      if (event.key === 'Escape' && !document.fullscreenElement) {
        onClose()
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }

  const toggleFullscreen = () => {
    const player = videoRef.current?.parentElement
    if (!player) return

    if (!document.fullscreenElement) {
      player.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  const tryNextServer = () => {
    if (typeof onFailure !== 'function') return
    onFailure()
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: '#000',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {status === 'ready' && (
          <>
            <video
              ref={videoRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                background: '#000',
              }}
              playsInline
              controls={false}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            <div
              style={{
                position: 'absolute',
                top: 20,
                left: 20,
                padding: '10px 16px',
                borderRadius: 16,
                background: 'rgba(12,12,16,0.65)',
                backdropFilter: 'blur(18px)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <p className="font-display text-sm font-semibold text-white">{currentServerName}</p>
              <p className="text-[11px] text-white/50">{title}</p>
            </div>

            <div
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                display: 'flex',
                gap: 10,
              }}
            >
              <button
                onClick={toggleFullscreen}
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', backdropFilter: 'blur(18px)' }}
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
              <button
                onClick={onClose}
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', backdropFilter: 'blur(18px)' }}
                title="Close player"
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: '18px 24px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(to top, rgba(0,0,0,0.72), transparent)',
                backdropFilter: 'blur(14px)',
              }}
            >
              <button
                onClick={togglePlayback}
                className="px-4 py-2 rounded-full flex items-center gap-2"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                <span className="text-sm font-medium">{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <p className="text-xs text-white/45">
                {isAnime ? 'Native anime stream playback' : 'Native stream playback'}
              </p>
            </div>
          </>
        )}

        {status === 'capturing' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#000',
            }}
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <span
                className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
              />
              <div className="space-y-1">
                <p className="font-display text-3xl text-white">Loading stream...</p>
                <p className="text-sm text-white/60">{statusText}</p>
              </div>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#000',
            }}
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="font-display text-3xl text-white">{error}</p>
              <p className="text-sm text-white/50">The current server did not expose a playable stream.</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={tryNextServer}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Try Next Server
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
