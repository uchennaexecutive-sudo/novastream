import { invoke } from '@tauri-apps/api/core'

export const ANIWATCH_BASE_URL = 'https://aniwatch-api-orcin-six.vercel.app'
const animeIdCache = new Map()
const animeEpisodesCache = new Map()
const isTauri = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)

const normalizeTitle = (title) => String(title || '').trim().toLowerCase()
const normalizeTracks = (tracks) => (tracks || []).map((track) => ({
  ...track,
  kind: track.kind || (String(track.lang).toLowerCase() === 'thumbnails' ? 'thumbnails' : 'captions'),
  rawFile: track.file || track.url || null,
  file: track.file || track.url || null,
  url: track.url || track.file || null,
}))

// Search anime by title
export async function searchAnime(title, { fresh = false } = {}) {
  const cacheKey = normalizeTitle(title)

  if (!fresh && animeIdCache.has(cacheKey)) {
    return { id: animeIdCache.get(cacheKey) }
  }

  if (isTauri) {
    const anime = await invoke('search_hianime', { title })

    if (anime?.id) {
      animeIdCache.set(cacheKey, anime.id)
    }

    return anime
  }

  const res = await fetch(`${ANIWATCH_BASE_URL}/api/v2/hianime/search?q=${encodeURIComponent(title)}&page=1`, {
    cache: 'no-store',
  })
  const data = await res.json()
  const anime = data.data?.animes?.[0] || null

  if (anime?.id) {
    animeIdCache.set(cacheKey, anime.id)
  }

  return anime
}

// Get episode list for an anime
export async function getAnimeEpisodes(animeId, { fresh = false } = {}) {
  const cacheKey = String(animeId || '')

  if (!fresh && animeEpisodesCache.has(cacheKey)) {
    return animeEpisodesCache.get(cacheKey)
  }

  if (isTauri) {
    const episodes = await invoke('get_hianime_episodes', { animeId: cacheKey })
    animeEpisodesCache.set(cacheKey, episodes || [])
    return episodes || []
  }

  const res = await fetch(`${ANIWATCH_BASE_URL}/api/v2/hianime/anime/${animeId}/episodes`, {
    cache: 'no-store',
  })
  const data = await res.json()
  const episodes = data.data?.episodes || []

  animeEpisodesCache.set(cacheKey, episodes)

  return episodes
}

// Get stream payload for a specific episode
export async function getAnimeStream(episodeId, server = 'hd-2', { fresh = false } = {}) {
  if (isTauri) {
    const data = await invoke('get_hianime_stream', {
      episodeId: String(episodeId),
      server: String(server),
      category: 'sub',
      fresh,
    })
    const sources = data?.sources || []
    const tracks = normalizeTracks(data?.tracks || [])
    const m3u8 = sources.find(source => source.type === 'hls') || sources[0]
    const rawUrl = m3u8?.url || null

    return {
      rawUrl,
      sources,
      tracks,
      headers: data?.headers || {},
    }
  }

  const params = new URLSearchParams({
    animeEpisodeId: String(episodeId),
    server: String(server),
    category: 'sub',
  })

  if (fresh) {
    params.set('_ts', Date.now().toString())
  }

  const res = await fetch(
    `${ANIWATCH_BASE_URL}/api/v2/hianime/episode/sources?${params.toString()}`,
    {
      cache: 'no-store',
    }
  )
  const data = await res.json()
  const sources = data.data?.sources || []
  const tracks = normalizeTracks(data.data?.tracks || [])
  const m3u8 = sources.find(source => source.type === 'hls') || sources[0]
  const rawUrl = m3u8?.url || null

  return {
    rawUrl,
    sources,
    tracks,
    headers: data.data?.headers || {},
  }
}

export async function preloadAnimePlayback(title) {
  const anime = await searchAnime(title)
  if (!anime?.id) return null

  const episodes = await getAnimeEpisodes(anime.id)

  return {
    animeId: anime.id,
    episodes,
  }
}
