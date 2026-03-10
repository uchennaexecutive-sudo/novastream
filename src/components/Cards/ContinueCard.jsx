import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { imgW500 } from '../../lib/tmdb'

export default function ContinueCard({ item }) {
  const navigate = useNavigate()
  const poster = imgW500(item.poster_path)
  const progress = item.progress_seconds ? Math.min((item.progress_seconds / 5400) * 100, 95) : 0

  return (
    <motion.div
      className="w-56 h-36 rounded-2xl overflow-hidden relative cursor-pointer flex-shrink-0 group"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
      }}
      whileHover={{
        y: -4,
        boxShadow: '0 0 24px var(--accent-glow), 0 16px 48px rgba(0,0,0,0.3)',
        borderColor: 'var(--border-hover)',
      }}
      onClick={() => navigate(`/detail/${item.media_type}/${item.tmdb_id}`)}
    >
      {poster && (
        <img
          src={poster}
          alt={item.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}
      <div
        className="absolute inset-0 flex flex-col justify-end p-3"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, transparent 70%)' }}
      >
        <p className="font-display font-semibold text-xs text-white truncate">{item.title}</p>
        {item.season && (
          <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
            S{item.season} E{item.episode}
          </p>
        )}
        <div className="w-full h-1 rounded-full mt-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent-glow)' }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Hover play icon */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: 'var(--accent)',
            boxShadow: '0 0 24px var(--accent-glow-strong)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
        </div>
      </div>
    </motion.div>
  )
}
