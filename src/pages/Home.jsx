import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getTrending, getPopularMovies, getTopRatedMovies, getPopularSeries,
  getNowPlaying, getOnAir, getSeriesByNetwork, getAnimeSeries, getAnimationMovies,
} from '../lib/tmdb'
import { getTrendingAnime } from '../lib/anilist'
import HeroSlide from '../components/Cards/HeroSlide'
import MediaCard from '../components/Cards/MediaCard'
import SkeletonCard from '../components/UI/SkeletonCard'

function ContentRow({ title, icon, items, loading, type }) {
  const scrollRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  const onMouseDown = (e) => {
    setIsDragging(true)
    setStartX(e.pageX - scrollRef.current.offsetLeft)
    setScrollLeft(scrollRef.current.scrollLeft)
  }
  const onMouseMove = (e) => {
    if (!isDragging) return
    e.preventDefault()
    const x = e.pageX - scrollRef.current.offsetLeft
    scrollRef.current.scrollLeft = scrollLeft - (x - startX) * 1.5
  }
  const onMouseUp = () => setIsDragging(false)

  const scroll = useCallback((dir) => {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({ left: dir * 600, behavior: 'smooth' })
  }, [])

  return (
    <div className="mb-10 group/row">
      <div className="flex items-center justify-between px-6 mb-4">
        <h2 className="font-display font-semibold text-lg flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          {icon && <span className="text-xl">{icon}</span>}
          {title}
        </h2>
        <div className="flex gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
          <button
            onClick={() => scroll(-1)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            ‹
          </button>
          <button
            onClick={() => scroll(1)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            ›
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 px-6 overflow-x-auto hide-scrollbar scroll-smooth"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : items?.map(item => <MediaCard key={item.id} item={item} type={type} />)
        }
      </div>
    </div>
  )
}

export default function Home() {
  const [trending, setTrending] = useState([])
  const [heroIndex, setHeroIndex] = useState(0)
  const [popularMovies, setPopularMovies] = useState([])
  const [topRated, setTopRated] = useState([])
  const [popularSeries, setPopularSeries] = useState([])
  const [nowPlaying, setNowPlaying] = useState([])
  const [onAir, setOnAir] = useState([])
  const [netflix, setNetflix] = useState([])
  const [anime, setAnime] = useState([])
  const [animation, setAnimation] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getTrending().then(setTrending),
      getPopularMovies().then(d => setPopularMovies(d.results)),
      getTopRatedMovies().then(d => setTopRated(d.results)),
      getPopularSeries().then(d => setPopularSeries(d.results)),
      getNowPlaying().then(setNowPlaying),
      getOnAir().then(setOnAir),
      getSeriesByNetwork(213).then(d => setNetflix(d.results)),
      getAnimeSeries().then(d => setAnime(d.results)),
      getAnimationMovies().then(d => setAnimation(d.results)),
    ]).finally(() => setLoading(false))
  }, [])

  // Auto-advance hero every 8 seconds
  useEffect(() => {
    if (trending.length === 0) return
    const timer = setInterval(() => {
      setHeroIndex(i => (i + 1) % Math.min(trending.length, 5))
    }, 8000)
    return () => clearInterval(timer)
  }, [trending])

  const heroItems = trending.slice(0, 5)

  return (
    <div>
      {/* Hero Section */}
      <div className="relative -mt-14">
        <AnimatePresence mode="wait">
          {heroItems[heroIndex] && (
            <motion.div
              key={heroItems[heroIndex].id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            >
              <HeroSlide item={heroItems[heroIndex]} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Dots */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2.5 z-20">
          {heroItems.map((_, i) => (
            <button
              key={i}
              onClick={() => setHeroIndex(i)}
              className="relative h-2 rounded-full transition-all duration-300"
              style={{
                width: i === heroIndex ? 28 : 8,
                background: i === heroIndex ? 'var(--accent)' : 'rgba(255,255,255,0.25)',
                boxShadow: i === heroIndex ? '0 0 12px var(--accent-glow-strong)' : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Content Rows */}
      <div className="py-8">
        <ContentRow title="Trending This Week" icon="🔥" items={trending} loading={loading} />
        <ContentRow title="Popular Movies" icon="🎬" items={popularMovies} loading={loading} type="movie" />
        <ContentRow title="Top Rated" icon="⭐" items={topRated} loading={loading} type="movie" />
        <ContentRow title="Popular Series" icon="📺" items={popularSeries} loading={loading} type="tv" />
        <ContentRow title="Now Playing" icon="🆕" items={nowPlaying} loading={loading} type="movie" />
        <ContentRow title="On Air" icon="📡" items={onAir} loading={loading} type="tv" />
        <ContentRow title="Anime" icon="🌸" items={anime} loading={loading} type="tv" />
        <ContentRow title="Animation" icon="🎨" items={animation} loading={loading} type="movie" />
        <ContentRow title="Netflix Originals" icon="🔴" items={netflix} loading={loading} type="tv" />
      </div>
    </div>
  )
}
