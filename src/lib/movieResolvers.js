import { invoke } from '@tauri-apps/api/core'

const TMDB_EMBED_API = 'https://tmdb-embed-api-xf3i.onrender.com'
const DIRECT_MEDIA_EXTENSIONS = ['.mp4', '.m3u8', '.mkv', '.webm', '.mov']
const DIRECT_MEDIA_PATH_MARKERS = [
  '/video',
  '/videos',
  '/stream',
  '/streams',
  '/playlist',
  '/manifest',
  '/hls',
  '/hls2',
]

const qualityScore = (quality) => {
  if (quality?.includes('1080')) return 3
  if (quality?.includes('720')) return 2
  if (quality?.includes('480')) return 1
  return 0
}

const typeScore = (url = '') => {
  const normalizedUrl = String(url).toLowerCase()
  if (normalizedUrl.includes('.mp4')) return 1
  if (normalizedUrl.includes('.m3u8')) return 0
  return 0
}

const sortStreams = (streams = []) => [...streams].sort((a, b) => {
  const qualityDelta = qualityScore(b.quality) - qualityScore(a.quality)
  if (qualityDelta !== 0) return qualityDelta

  const typeDelta = typeScore(b.url) - typeScore(a.url)
  if (typeDelta !== 0) return typeDelta

  return String(a.provider || '').localeCompare(String(b.provider || ''))
})

const isBase64LikeToken = (value = '') => /^[A-Za-z0-9+/=]{50,}$/.test(String(value))

const hasDirectMediaPath = (urlString = '') => {
  const normalizedUrl = String(urlString).toLowerCase()

  if (DIRECT_MEDIA_EXTENSIONS.some(extension => normalizedUrl.includes(extension))) {
    return true
  }

  return DIRECT_MEDIA_PATH_MARKERS.some(marker => normalizedUrl.includes(marker))
}

const inferStreamType = (url = '') => (
  String(url).toLowerCase().includes('.m3u8') ? 'hls' : 'mp4'
)

const isDirectPlayableStream = (stream) => {
  const rawUrl = String(stream?.url || '').trim()
  if (!rawUrl || isBase64LikeToken(rawUrl)) return false
  if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) return false

  try {
    const parsed = new URL(rawUrl)
    return hasDirectMediaPath(`${parsed.pathname}${parsed.search}`)
  } catch {
    return false
  }
}

const normalizeStream = (stream, resolverId) => ({
  ...stream,
  resolverId,
  streamType: inferStreamType(stream?.url || ''),
})

async function fetchTmdbEmbedStreams(endpoint, emptyMessage) {
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Stream API request failed: HTTP ${response.status}`)
  }

  const data = await response.json()
  if (!data.success || !data.streams?.length) {
    throw new Error(emptyMessage)
  }

  return data.streams
}

const tmdbEmbedResolver = {
  id: 'tmdb-embed-api',
  label: 'TMDB Embed API',
  async getMovieStreams(tmdbId) {
    return fetchTmdbEmbedStreams(
      `${TMDB_EMBED_API}/api/streams/movie/${tmdbId}`,
      'No streams found for this movie'
    )
  },
  async getSeriesStreams(tmdbId, season, episode) {
    return fetchTmdbEmbedStreams(
      `${TMDB_EMBED_API}/api/streams/series/${tmdbId}?season=${season}&episode=${episode}`,
      'No streams found for this episode'
    )
  },
}

const RESOLVERS = [tmdbEmbedResolver]

async function validateStreamCandidate(stream) {
  const result = await invoke('probe_movie_stream', {
    url: stream.url,
    headers: stream.headers || {},
    streamType: stream.streamType,
  })

  return result
}

async function resolveStreams(fetcher, contentLabel) {
  const validationErrors = []
  let lastFetchError = ''

  for (const resolver of RESOLVERS) {
    try {
      console.log('[movieResolvers] Fetching streams from resolver:', resolver.id)
      const rawStreams = await fetcher(resolver)

      const rejectedStreams = rawStreams.filter(stream => !isDirectPlayableStream(stream))
      if (rejectedStreams.length > 0) {
        console.warn('[movieResolvers] Ignoring non-direct streams:', rejectedStreams.map(stream => ({
          resolver: resolver.id,
          provider: stream.provider,
          quality: stream.quality,
          urlPreview: String(stream.url || '').slice(0, 80),
        })))
      }

      const directStreams = sortStreams(
        rawStreams
          .filter(isDirectPlayableStream)
          .map(stream => normalizeStream(stream, resolver.id))
      )

      if (directStreams.length === 0) {
        validationErrors.push(`${resolver.label}: no direct playable streams`)
        continue
      }

      const validStreams = []
      for (const stream of directStreams) {
        try {
          const probeResult = await validateStreamCandidate(stream)
          if (probeResult?.ok) {
            validStreams.push({
              ...stream,
              finalUrl: probeResult.finalUrl || stream.url,
              contentType: probeResult.contentType || '',
            })
          } else {
            validationErrors.push(
              `${resolver.label}/${stream.provider || 'provider'}: ${probeResult?.error || 'stream probe failed'}`
            )
          }
        } catch (probeError) {
          validationErrors.push(
            `${resolver.label}/${stream.provider || 'provider'}: ${probeError instanceof Error ? probeError.message : String(probeError)}`
          )
        }
      }

      if (validStreams.length > 0) {
        console.log('[movieResolvers] Validated streams:', validStreams.map(stream => ({
          resolver: stream.resolverId,
          provider: stream.provider,
          quality: stream.quality,
          streamType: stream.streamType,
          url: stream.finalUrl || stream.url,
        })))
        return validStreams
      }
    } catch (error) {
      lastFetchError = error instanceof Error ? error.message : String(error)
      console.warn('[movieResolvers] Resolver failed:', resolver.id, lastFetchError)
    }
  }

  if (validationErrors.length > 0) {
    throw new Error(`No validated direct playable streams available for this ${contentLabel}. ${validationErrors[0]}`)
  }

  throw new Error(lastFetchError || `No validated direct playable streams available for this ${contentLabel}`)
}

export async function resolveMovieStreams(tmdbId) {
  return resolveStreams(
    (resolver) => resolver.getMovieStreams(tmdbId),
    'movie'
  )
}

export async function resolveSeriesStreams(tmdbId, season, episode) {
  return resolveStreams(
    (resolver) => resolver.getSeriesStreams(tmdbId, season, episode),
    'episode'
  )
}

export const resolveAnimationStreams = resolveMovieStreams
