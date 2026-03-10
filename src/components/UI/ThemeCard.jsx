import { motion } from 'framer-motion'
import useAppStore from '../../store/useAppStore'

export default function ThemeCard({ theme }) {
  const currentTheme = useAppStore(s => s.theme)
  const setTheme = useAppStore(s => s.setTheme)
  const isActive = currentTheme === theme.id

  return (
    <motion.button
      onClick={() => setTheme(theme.id)}
      className="relative p-4 rounded-2xl text-left"
      style={{
        background: 'var(--bg-glass)',
        border: isActive ? '2px solid var(--accent)' : '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        boxShadow: isActive
          ? '0 0 32px var(--accent-glow), var(--inner-glow)'
          : 'var(--card-shadow), var(--inner-glow)',
      }}
      whileHover={{
        y: -4,
        boxShadow: '0 0 40px var(--accent-glow), 0 16px 48px rgba(0,0,0,0.3)',
      }}
      transition={{ duration: 0.2 }}
    >
      {isActive && (
        <motion.div
          className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            boxShadow: '0 0 12px var(--accent-glow)',
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          ✓
        </motion.div>
      )}

      {/* Mini preview */}
      <div
        data-theme={theme.id}
        className="w-full h-24 rounded-xl mb-3 overflow-hidden relative"
        style={{ background: theme.swatches[0], border: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-6" style={{ background: theme.swatches[0], borderRight: `1px solid ${theme.swatches[1]}30` }} />
        <div className="absolute top-3 left-10 flex gap-2">
          <div className="w-8 h-12 rounded" style={{ background: `${theme.swatches[1]}40` }} />
          <div className="w-8 h-12 rounded" style={{ background: `${theme.swatches[2]}40` }} />
          <div className="w-8 h-12 rounded" style={{ background: `${theme.swatches[1]}20` }} />
        </div>
      </div>

      <div className="text-2xl mb-1">{theme.icon}</div>
      <div className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{theme.name}</div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{theme.desc}</div>

      <div className="flex gap-1.5 mt-3">
        {theme.swatches.map((c, i) => (
          <div
            key={i}
            className="w-5 h-5 rounded-full"
            style={{
              background: c,
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: `0 0 8px ${c}40`,
            }}
          />
        ))}
      </div>
    </motion.button>
  )
}
