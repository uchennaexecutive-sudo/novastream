import { invoke } from '@tauri-apps/api/core'

async function fetchResolvedStreams(tmdbId, contentType, season, episode, imdbId) {
  return invoke('fetch_movie_resolver_streams', {
    payload: {
      tmdbId: String(tmdbId),
      contentType,
      season: season ?? null,
      episode: episode ?? null,
      imdbId: imdbId || null,
    },
  })
}

export async function getMovieStreams(tmdbId, imdbId = null) {
  return fetchResolvedStreams(tmdbId, 'movie', null, null, imdbId)
}

export async function getSeriesStreams(tmdbId, season, episode, imdbId = null) {
  return fetchResolvedStreams(tmdbId, 'series', season, episode, imdbId)
}

export async function getAnimationStreams(tmdbId, imdbId = null) {
  return fetchResolvedStreams(tmdbId, 'animation', null, null, imdbId)
}

export async function getMovieStream(tmdbId, imdbId = null) {
  const streams = await getMovieStreams(tmdbId, imdbId)
  return streams[0]
}

export async function getSeriesStream(tmdbId, season, episode, imdbId = null) {
  const streams = await getSeriesStreams(tmdbId, season, episode, imdbId)
  return streams[0]
}

export const getAnimationStream = getMovieStream
