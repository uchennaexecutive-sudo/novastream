import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Watchlist
export const getWatchlist = async () => {
  const { data } = await supabase.from('nova_watchlist').select('*').order('added_at', { ascending: false })
  return data || []
}

export const addToWatchlist = async (item) => {
  const { data } = await supabase.from('nova_watchlist').upsert({
    tmdb_id: item.tmdb_id,
    media_type: item.media_type,
    title: item.title,
    poster_path: item.poster_path,
    user_id: 'local',
    added_at: new Date().toISOString(),
  }, { onConflict: 'tmdb_id,user_id' })
  return data
}

export const removeFromWatchlist = async (tmdbId) => {
  await supabase.from('nova_watchlist').delete().eq('tmdb_id', tmdbId)
}

export const isInWatchlist = async (tmdbId) => {
  const { data } = await supabase.from('nova_watchlist').select('id').eq('tmdb_id', tmdbId).single()
  return !!data
}

// History
export const getHistory = async () => {
  const { data } = await supabase.from('nova_history').select('*').order('watched_at', { ascending: false })
  return data || []
}

export const addToHistory = async (item) => {
  await supabase.from('nova_history').upsert({
    tmdb_id: item.tmdb_id,
    media_type: item.media_type,
    title: item.title,
    poster_path: item.poster_path,
    season: item.season || null,
    episode: item.episode || null,
    user_id: 'local',
    progress_seconds: item.progress_seconds || 0,
    watched_at: new Date().toISOString(),
  }, { onConflict: 'tmdb_id,user_id' })
}
