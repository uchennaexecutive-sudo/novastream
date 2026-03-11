import { motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'

export default function TopBar() {
  const setSearchOpen = useAppStore(s => s.setSearchOpen)

  return (
    <div
      className="fixed right-0 flex items-center justify-end px-6"
      style={{
        top: 0,
        left: 72,
        height: 56,
        background: 'var(--topbar-bg)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15), var(--inner-glow)',
        zIndex: 40,
      }}
    >
      <motion.button
        onClick={() => setSearchOpen(true)}
        className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm"
        style={{
          background: 'var(--bg-surface)',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
          backdropFilter: 'var(--glass-blur)',
        }}
        whileHover={{
          borderColor: 'var(--border-hover)',
          boxShadow: '0 0 20px var(--accent-glow)',
        }}
        whileTap={{ scale: 0.97 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span>Search movies, series...</span>
        <kbd
          className="font-mono text-[10px] px-1.5 py-0.5 rounded-md ml-4"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
        >
          Ctrl+K
        </kbd>
      </motion.button>
    </div>
  )
}
