export const EMBED_PROVIDERS = [
  {
    id: 'moviesapi',
    label: 'MoviesAPI',
    nativeTimeoutMs: 12000,
    buildMovieUrl: (id) => `https://moviesapi.club/movie/${id}`,
    buildSeriesUrl: (id, season = 1, episode = 1) => `https://moviesapi.club/tv/${id}-${season}-${episode}`,
  },
  {
    id: 'nontonfilm',
    label: 'NontonFilm',
    nativeTimeoutMs: 10000,
    buildMovieUrl: (id) => `https://nontonfilm.tv/embed/movie?tmdb=${id}`,
    buildSeriesUrl: null,
  },
  {
    id: 'vidsrc-me',
    label: 'VidSrc Me',
    nativeTimeoutMs: 9000,
    buildMovieUrl: (id) => `https://vidsrc.me/embed/movie/${id}`,
    buildSeriesUrl: (id, season = 1, episode = 1) => `https://vidsrc.me/embed/tv/${id}/${season}/${episode}`,
  },
  {
    id: 'vidsrc-net',
    label: 'VidSrc Net',
    nativeTimeoutMs: 8000,
    buildMovieUrl: (id) => `https://vidsrc.net/embed/movie?tmdb=${id}`,
    buildSeriesUrl: (id, season = 1, episode = 1) => `https://vidsrc.net/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`,
  },
  {
    id: 'vidsrc-xyz',
    label: 'VidSrc XYZ',
    nativeTimeoutMs: 8000,
    buildMovieUrl: (id) => `https://vidsrc.xyz/embed/movie?tmdb=${id}`,
    buildSeriesUrl: (id, season = 1, episode = 1) => `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`,
  },
  {
    id: 'autoembed',
    label: 'AutoEmbed',
    nativeTimeoutMs: 9000,
    buildMovieUrl: (id) => `https://player.autoembed.cc/embed/movie/${id}`,
    buildSeriesUrl: (id, season = 1, episode = 1) => `https://player.autoembed.cc/embed/tv/${id}/${season}/${episode}`,
  },
]

export const DEFAULT_SERVER_LABELS = EMBED_PROVIDERS.map(provider => provider.label)
export const ANIME_SERVER_LABELS = DEFAULT_SERVER_LABELS.slice(0, 5)

export const isMovieLikeMediaType = (mediaType) => (
  mediaType === 'movie' || mediaType === 'animation'
)

export const isEpisodeBasedMediaType = (mediaType) => !isMovieLikeMediaType(mediaType)

export const getMovieEmbeds = (id) => EMBED_PROVIDERS
  .map(provider => provider.buildMovieUrl?.(id))
  .filter(Boolean)

export const getAnimationEmbeds = (id) => getMovieEmbeds(id)

export const getSeriesEmbeds = (id, s = 1, e = 1) => EMBED_PROVIDERS
  .map(provider => provider.buildSeriesUrl?.(id, s, e))
  .filter(Boolean)

export const getEmbedsForMediaType = (mediaType, id, season = 1, episode = 1) => (
  isMovieLikeMediaType(mediaType)
    ? getMovieEmbeds(id)
    : getSeriesEmbeds(id, season, episode)
)

export const getAnimeEmbeds = (id, s = 1, e = 1) => getSeriesEmbeds(id, s, e)
