// Local storage-backed watchlist & history (no external DB required)

const WATCHLIST_KEY = 'nova-watchlist'
const HISTORY_KEY = 'nova-history'

function readStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}

function writeStore(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

// Watchlist
export const getWatchlist = async () => {
  return readStore(WATCHLIST_KEY)
}

export const addToWatchlist = async (item) => {
  const list = readStore(WATCHLIST_KEY)
  const idx = list.findIndex(i => i.tmdb_id === item.tmdb_id)
  const entry = {
    id: item.tmdb_id,
    tmdb_id: item.tmdb_id,
    media_type: item.media_type,
    title: item.title,
    poster_path: item.poster_path,
    added_at: new Date().toISOString(),
  }
  if (idx >= 0) {
    list[idx] = entry
  } else {
    list.unshift(entry)
  }
  writeStore(WATCHLIST_KEY, list)
}

export const removeFromWatchlist = async (tmdbId) => {
  const list = readStore(WATCHLIST_KEY).filter(i => i.tmdb_id !== tmdbId)
  writeStore(WATCHLIST_KEY, list)
}

export const isInWatchlist = async (tmdbId) => {
  return readStore(WATCHLIST_KEY).some(i => i.tmdb_id === tmdbId)
}

// History
export const getHistory = async () => {
  return readStore(HISTORY_KEY)
}

export const addToHistory = async (item) => {
  const list = readStore(HISTORY_KEY)
  const idx = list.findIndex(i => i.tmdb_id === item.tmdb_id)
  const entry = {
    id: item.tmdb_id,
    tmdb_id: item.tmdb_id,
    media_type: item.media_type,
    title: item.title,
    poster_path: item.poster_path,
    season: item.season || null,
    episode: item.episode || null,
    progress_seconds: item.progress_seconds || 0,
    watched_at: new Date().toISOString(),
  }
  if (idx >= 0) {
    list.splice(idx, 1)
  }
  list.unshift(entry)
  writeStore(HISTORY_KEY, list)
}
