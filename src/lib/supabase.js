import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://owymezptcmwmrlkeuxcg.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93eW1lenB0Y213bXJsa2V1eGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTM2NjEsImV4cCI6MjA4ODU4OTY2MX0.4OZvH_afMKK-CCEgSrW4ga7oC2y0Hqh3uz5ZeRVtvPQ'

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
