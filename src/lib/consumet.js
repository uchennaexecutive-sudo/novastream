export const ANIWATCH_BASE_URL = 'https://aniwatch-api-orcin-six.vercel.app'

// Search anime by title
export async function searchAnime(title) {
  const res = await fetch(`${ANIWATCH_BASE_URL}/api/v2/hianime/search?q=${encodeURIComponent(title)}&page=1`)
  const data = await res.json()
  return data.data?.animes?.[0] || null
}

// Get episode list for an anime
export async function getAnimeEpisodes(animeId) {
  const res = await fetch(`${ANIWATCH_BASE_URL}/api/v2/hianime/anime/${animeId}/episodes`)
  const data = await res.json()
  return data.data?.episodes || []
}

// Get stream URL for a specific episode
export async function getAnimeStream(episodeId, server = 'hd-1') {
  const res = await fetch(
    `${ANIWATCH_BASE_URL}/api/v2/hianime/episode/sources?animeEpisodeId=${encodeURIComponent(episodeId)}&server=${encodeURIComponent(server)}&category=sub`
  )
  const data = await res.json()
  const sources = data.data?.sources || []
  const m3u8 = sources.find(source => source.type === 'hls') || sources[0]
  return m3u8?.url || null
}
