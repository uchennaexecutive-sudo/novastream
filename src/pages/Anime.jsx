import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { getTrendingAnime, getPopularAnime, getTopRatedAnime } from '../lib/anilist'
import { searchMulti } from '../lib/tmdb'

const TABS = ['Trending', 'Popular', 'Top Rated']
const GENRES = ['Action', 'Romance', 'Comedy', 'Horror', 'Fantasy', 'Sci-Fi', 'Slice of Life', 'Sports']
const PER_PAGE = 28

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 filter-chip"
      style={{
        background: active ? 'var(--accent)' : 'var(--bg-surface)',
        color: active ? '#fff' : 'var(--text-secondary)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        boxShadow: active ? '0 0 16px var(--accent-glow)' : 'none',
      }}
    >
      {children}
    </button>
  )
}

export default function Anime() {
  const [tab, setTab] = useState('Trending')
  const [allAnime, setAllAnime] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [genre, setGenre] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const navigate = useNavigate()
  const observer = useRef(null)

  const getFetcher = useCallback(() => {
    if (tab === 'Trending') return getTrendingAnime
    if (tab === 'Popular') return getPopularAnime
    return getTopRatedAnime
  }, [tab])

  // Fetch a page of results
  const fetchPage = useCallback(async (pageNum, append = false) => {
    const isFirst = pageNum === 1
    if (isFirst) setLoading(true)
    else setLoadingMore(true)

    try {
      const fetcher = getFetcher()
      const results = await fetcher(pageNum, PER_PAGE)
      console.log(`[Anime] ${tab} page ${pageNum}:`, results.length, 'results')
      setAllAnime(prev => append ? [...prev, ...results] : results)
      setHasMore(results.length >= PER_PAGE)
    } catch (err) {
      console.error('[Anime] Fetch error:', err)
      if (!append) setAllAnime([])
      setHasMore(false)
    } finally {
      if (isFirst) setLoading(false)
      else setLoadingMore(false)
    }
  }, [tab, getFetcher])

  // Reset on tab change
  useEffect(() => {
    setPage(1)
    setGenre(null)
    setHasMore(true)
    fetchPage(1, false)
  }, [tab, fetchPage])

  // Infinite scroll observer
  const lastCardRef = useCallback(node => {
    if (loading || loadingMore) return
    if (observer.current) observer.current.disconnect()
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        const nextPage = page + 1
        setPage(nextPage)
        fetchPage(nextPage, true)
      }
    })
    if (node) observer.current.observe(node)
  }, [loading, loadingMore, hasMore, page, fetchPage])

  // Client-side genre filtering
  const displayAnime = genre
    ? allAnime.filter(item => item.genres?.includes(genre))
    : allAnime

  const handlePlay = async (item) => {
    const title = item.title.english || item.title.romaji
    try {
      const results = await searchMulti(title)
      const match = results?.find(r => r.media_type === 'tv' || r.media_type === 'movie')
      if (match) {
        navigate(`/detail/${match.media_type}/${match.id}`)
      }
    } catch (err) {
      console.error('[Anime] Search error:', err)
    }
  }

  return (
    <div className="p-6">
      <h1 className="font-display font-bold text-3xl mb-1" style={{ color: 'var(--text-primary)' }}>
        ⚔ Anime
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Powered by AniList</p>

      <div className="flex gap-2 mb-4">
        {TABS.map(t => (
          <FilterChip key={t} active={tab === t} onClick={() => setTab(t)}>
            {t}
          </FilterChip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-8">
        {GENRES.map(g => (
          <FilterChip key={g} active={genre === g} onClick={() => setGenre(genre === g ? null : g)}>
            {g}
          </FilterChip>
        ))}
      </div>

      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-5">
        {loading
          ? Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="w-full h-[264px] rounded-2xl shimmer" style={{ border: '1px solid var(--border)' }} />
            ))
          : displayAnime.map((item, i) => (
              <div key={`${item.id}-${i}`} ref={i === displayAnime.length - 1 && !genre ? lastCardRef : null}>
                <motion.div
                  className="rounded-2xl overflow-hidden cursor-pointer group relative"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    height: 264,
                    boxShadow: 'var(--card-shadow)',
                  }}
                  whileHover={{
                    y: -8,
                    boxShadow: '0 0 30px var(--accent-glow), 0 20px 60px rgba(0,0,0,0.4)',
                    borderColor: 'var(--border-hover)',
                  }}
                  onClick={() => handlePlay(item)}
                >
                  <img
                    src={item.coverImage?.extraLarge || item.coverImage?.large}
                    alt={item.title.english || item.title.romaji}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Hover overlay */}
                  <div
                    className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out p-3 pt-10"
                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 60%, transparent 100%)' }}
                  >
                    <p className="font-display font-semibold text-sm text-white truncate">
                      {item.title.english || item.title.romaji}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {item.averageScore && (
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-yellow-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 glow-dot" />
                          {(item.averageScore / 10).toFixed(1)}
                        </span>
                      )}
                      {item.episodes && (
                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                          {item.episodes} eps
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rating badge */}
                  {item.averageScore && (
                    <div
                      className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold"
                      style={{
                        background: 'rgba(0,0,0,0.7)',
                        color: item.averageScore >= 70 ? '#4ade80' : item.averageScore >= 50 ? '#fbbf24' : '#f87171',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      {(item.averageScore / 10).toFixed(1)}
                    </div>
                  )}
                </motion.div>
              </div>
            ))
        }

        {loadingMore && Array.from({ length: 7 }).map((_, i) => (
          <div key={`more-${i}`} className="w-full h-[264px] rounded-2xl shimmer" style={{ border: '1px solid var(--border)' }} />
        ))}
      </div>

      {!loading && displayAnime.length === 0 && (
        <div className="text-center py-16">
          <p className="text-lg" style={{ color: 'var(--text-muted)' }}>No anime found</p>
        </div>
      )}

      {loadingMore && (
        <div className="flex justify-center py-8">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
        </div>
      )}
    </div>
  )
}
