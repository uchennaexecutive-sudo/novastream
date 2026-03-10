import { motion } from 'framer-motion'
import useAppStore from '../store/useAppStore'
import { THEMES } from '../themes'
import ThemeCard from '../components/UI/ThemeCard'

function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        className="w-12 h-6 rounded-full relative transition-all duration-300"
        style={{
          background: value ? 'var(--accent)' : 'var(--bg-elevated)',
          boxShadow: value ? '0 0 16px var(--accent-glow)' : 'none',
        }}
      >
        <motion.div
          className="w-5 h-5 rounded-full absolute top-0.5"
          style={{ background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
          animate={{ left: value ? 26 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  )
}

export default function Settings() {
  const preferences = useAppStore(s => s.preferences)
  const setPreference = useAppStore(s => s.setPreference)

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="font-display font-bold text-3xl mb-1" style={{ color: 'var(--text-primary)' }}>
        ⚙ Settings
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>Customize your experience</p>

      {/* Theme Switcher */}
      <section className="mb-10">
        <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          🎨 Choose Your Theme
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {THEMES.map(theme => <ThemeCard key={theme.id} theme={theme} />)}
        </div>
      </section>

      {/* Playback */}
      <section className="mb-10">
        <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          ▶ Playback
        </h2>
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(20px)',
            boxShadow: 'var(--card-shadow), var(--inner-glow)',
          }}
        >
          <div className="flex items-center justify-between py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Default Stream Source</span>
            <div className="flex gap-2">
              {['vidsrc', 'embed.su'].map(s => (
                <button
                  key={s}
                  onClick={() => setPreference('defaultEmbed', s)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: preferences.defaultEmbed === s ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: preferences.defaultEmbed === s ? '#fff' : 'var(--text-secondary)',
                    boxShadow: preferences.defaultEmbed === s ? '0 0 16px var(--accent-glow)' : 'none',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            label="Autoplay Next Episode"
            value={preferences.autoplayNext}
            onChange={v => setPreference('autoplayNext', v)}
          />
          <Toggle
            label="Remember Watch Position"
            value={preferences.rememberPosition}
            onChange={v => setPreference('rememberPosition', v)}
          />
        </div>
      </section>

      {/* About */}
      <section>
        <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          ℹ About
        </h2>
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(20px)',
            boxShadow: 'var(--card-shadow), var(--inner-glow)',
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold"
              style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 0 16px var(--accent-glow)' }}
            >
              N
            </div>
            <div>
              <p className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                NOVA STREAM
              </p>
              <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>v1.0.0</p>
            </div>
          </div>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            Your Universe of Stories
          </p>
          <div className="h-px my-3" style={{ background: 'var(--border)' }} />
          <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
          <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Anime data provided by AniList.
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Built for personal use only.
          </p>
        </div>
      </section>
    </div>
  )
}
