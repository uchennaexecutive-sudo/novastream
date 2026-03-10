import { Minus, Square, X } from 'lucide-react'

const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__

async function invokeCmd(cmd) {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core')
    invoke(cmd)
  }
}

export default function TitleBar() {
  if (!isTauri) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 flex items-center select-none"
      style={{
        height: 32,
        zIndex: 99999,
        background: 'var(--sidebar-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center px-4 flex-shrink-0">
        <span className="font-display text-sm font-bold tracking-wide">
          <span style={{ color: 'var(--text-primary)' }}>NOVA</span>
          <span style={{ color: 'var(--accent)' }}> STREAM</span>
        </span>
      </div>

      {/* Draggable area */}
      <div className="flex-1 h-full" style={{ WebkitAppRegion: 'drag' }} />

      {/* Window controls */}
      <div className="flex items-center flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={() => invokeCmd('minimize_window')}
          className="flex items-center justify-center transition-colors"
          style={{ width: 46, height: 32, color: 'var(--text-secondary)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => invokeCmd('toggle_maximize')}
          className="flex items-center justify-center transition-colors"
          style={{ width: 46, height: 32, color: 'var(--text-secondary)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => invokeCmd('close_window')}
          className="flex items-center justify-center transition-colors"
          style={{ width: 46, height: 32, color: 'var(--text-secondary)' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#e81123'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
