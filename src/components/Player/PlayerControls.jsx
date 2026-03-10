import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play, Pause, Volume2, VolumeX, Subtitles, Settings,
  SkipForward, ExternalLink,
} from 'lucide-react'

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const QUALITIES = ['Auto', '1080p', '720p', '480p']
const SUBTITLE_OPTS = ['Off', 'English', 'Auto']

export default function PlayerControls({
  iframeRef,
  serverLabel,
  title,
  season,
  episode,
  currentUrl,
  onNextSource,
}) {
  const [playing, setPlaying] = useState(true)
  const [muted, setMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState('0:00')
  const [duration, setDuration] = useState('0:00')
  const [showSettings, setShowSettings] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [quality, setQuality] = useState('Auto')
  const [subtitle, setSubtitle] = useState('Off')
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  const seekBarRef = useRef(null)

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }, [])

  const sendMessage = useCallback((data) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(data, '*')
    } catch {
      // cross-origin — expected
    }
  }, [iframeRef])

  const tryControl = useCallback((action, data) => {
    sendMessage(data)
    showToast('Use the video controls directly for this server')
  }, [sendMessage, showToast])

  const togglePlay = () => {
    const next = !playing
    setPlaying(next)
    tryControl('play', { event: next ? 'play' : 'pause' })
  }

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    tryControl('volume', { event: 'volume', volume: next ? 0 : 1 })
  }

  const handleSeek = (e) => {
    if (!seekBarRef.current) return
    const rect = seekBarRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setProgress(pct * 100)
    tryControl('seek', { event: 'seek', time: pct })
  }

  const handleSpeed = (s) => {
    setSpeed(s)
    sendMessage({ event: 'speed', speed: s })
    showToast(`Speed: ${s}x`)
  }

  const handleQuality = (q) => {
    setQuality(q)
    showToast(`Quality: ${q}`)
  }

  const handleSubtitle = (s) => {
    setSubtitle(s)
    sendMessage({ event: 'subtitles', enabled: s !== 'Off', language: s })
    showToast(`Subtitles: ${s}`)
  }

  return (
    <>
      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            style={{
              position: 'absolute',
              top: 60,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 30,
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: '8px 16px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 12,
              fontFamily: "'DM Sans', sans-serif",
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings popup */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            style={{
              position: 'absolute',
              bottom: 64,
              right: 16,
              zIndex: 25,
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14,
              padding: 16,
              width: 280,
            }}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Speed */}
            <SettingsSection label="Playback Speed">
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {SPEEDS.map(s => (
                  <ChipButton key={s} active={speed === s} onClick={() => handleSpeed(s)} mono>
                    {s}x
                  </ChipButton>
                ))}
              </div>
            </SettingsSection>

            {/* Quality */}
            <SettingsSection label="Quality">
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {QUALITIES.map(q => (
                  <ChipButton key={q} active={quality === q} onClick={() => handleQuality(q)}>
                    {q}
                  </ChipButton>
                ))}
              </div>
            </SettingsSection>

            {/* Subtitles */}
            <SettingsSection label="Subtitles" last>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {SUBTITLE_OPTS.map(s => (
                  <ChipButton key={s} active={subtitle === s} onClick={() => handleSubtitle(s)}>
                    {s}
                  </ChipButton>
                ))}
              </div>
            </SettingsSection>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Control Bar ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Seek bar */}
        <div
          ref={seekBarRef}
          onClick={handleSeek}
          style={{
            height: 4,
            background: 'rgba(255,255,255,0.12)',
            cursor: 'pointer',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'var(--accent)',
              borderRadius: 2,
              boxShadow: '0 0 8px var(--accent-glow)',
              transition: 'width 0.1s linear',
            }}
          />
        </div>

        {/* Main controls row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            height: 52,
          }}
        >
          {/* Left controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ControlBtn onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </ControlBtn>

            <ControlBtn onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </ControlBtn>

            <span
              style={{
                fontFamily: "'JetBrains Mono Variable', monospace",
                fontSize: 11,
                color: 'rgba(255,255,255,0.45)',
                marginLeft: 4,
                userSelect: 'none',
              }}
            >
              {currentTime} / {duration}
            </span>
          </div>

          {/* Center: title */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minWidth: 0,
              padding: '0 12px',
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontFamily: "'JetBrains Mono Variable', monospace",
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 6,
                background: 'var(--accent)',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {serverLabel}
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.35)',
                fontFamily: "'Clash Display', sans-serif",
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title} {season ? `• S${season}E${episode}` : ''}
            </span>
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ControlBtn
              onClick={() => sendMessage({ event: 'subtitles', toggle: true })}
              title="Subtitles"
            >
              <Subtitles size={16} />
            </ControlBtn>

            <ControlBtn
              onClick={() => setShowSettings(v => !v)}
              title="Settings"
              active={showSettings}
            >
              <Settings size={16} />
            </ControlBtn>

            <ControlBtn onClick={onNextSource} title="Next Server">
              <SkipForward size={16} />
            </ControlBtn>

            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                borderRadius: '50%',
                color: 'rgba(255,255,255,0.5)',
                transition: 'all 0.15s',
                textDecoration: 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.background = 'transparent' }}
              title="Open in new tab"
            >
              <ExternalLink size={15} />
            </a>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Sub-components ─── */

function ControlBtn({ children, onClick, title, active }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 34,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        color: active ? 'var(--accent)' : 'rgba(255,255,255,0.5)',
        background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = active ? 'var(--accent)' : '#fff'
        e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = active ? 'var(--accent)' : 'rgba(255,255,255,0.5)'
        e.currentTarget.style.background = active ? 'rgba(255,255,255,0.1)' : 'transparent'
      }}
    >
      {children}
    </button>
  )
}

function SettingsSection({ label, children, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 14 }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function ChipButton({ children, active, onClick, mono }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 10px',
        borderRadius: 8,
        fontSize: 11,
        fontFamily: mono ? "'JetBrains Mono Variable', monospace" : "'DM Sans', sans-serif",
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        background: active ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
        color: active ? '#fff' : 'rgba(255,255,255,0.5)',
        boxShadow: active ? '0 0 12px var(--accent-glow)' : 'none',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}
