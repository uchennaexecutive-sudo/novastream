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
