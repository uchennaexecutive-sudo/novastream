export const ANIME_SERVER_LABELS = [
  'VidSrc CC',
  '2Embed',
  'VidLink',
  'VidSrc ICU',
  'GoDrive',
]

export const getMovieEmbeds = (id) => [
  `https://vidsrc.xyz/embed/movie?tmdb=${id}`,
  `https://vidsrc.net/embed/movie?tmdb=${id}`,
  `https://vidsrc.me/embed/movie/${id}`,
  `https://player.autoembed.cc/embed/movie/${id}`,
  `https://moviesapi.club/movie/${id}`,
  `https://nontonfilm.tv/embed/movie?tmdb=${id}`,
]

export const getSeriesEmbeds = (id, s = 1, e = 1) => [
  `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  `https://vidsrc.net/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  `https://vidsrc.me/embed/tv/${id}/${s}/${e}`,
  `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`,
  `https://moviesapi.club/tv/${id}-${s}-${e}`,
]

export const getAnimeEmbeds = (id, s = 1, e = 1) => [
  `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`,
  `https://www.2embed.online/embed/tv/${id}/${s}/${e}`,
  `https://vidlink.pro/tv/${id}/${s}/${e}`,
  `https://vidsrc.icu/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  `https://godriveplayer.com/player.php?tmdb=${id}&season=${s}&episode=${e}`,
]
