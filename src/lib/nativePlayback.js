import { invoke } from '@tauri-apps/api/core'
import {
  EMBED_PROVIDERS,
  getEmbedsForMediaType,
  isMovieLikeMediaType,
} from './embeds'

const FALLBACK_REASON_UNSUPPORTED = 'Native stream resolution is only available in the Tauri desktop app.'
const FALLBACK_REASON_UNRESOLVED = 'No provider exposed a clean native stream URL.'

const isTauriRuntime = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)

const inferStreamKind = (streamType, streamUrl = '') => {
  if (streamType === 'hls' || streamUrl.includes('.m3u8')) return 'hls'
  if (streamType === 'mp4' || streamUrl.includes('.mp4')) return 'mp4'
  return 'unknown'
}

const buildProviderSources = (mediaType, tmdbId, season = 1, episode = 1) => {
  const urls = getEmbedsForMediaType(mediaType, tmdbId, season, episode)

  return EMBED_PROVIDERS
    .map((provider, index) => {
      const embedUrl = urls[index]
      if (!embedUrl) return null

      return {
        index,
        providerId: provider.id,
        providerLabel: provider.label,
        nativeTimeoutMs: provider.nativeTimeoutMs || 10000,
        mediaType,
        embedUrl,
      }
    })
    .filter(Boolean)
}

const buildIframeFallbackResult = (reason, sources, attempts = []) => ({
  strategy: 'iframe-fallback',
  reason,
  sources,
  attempts,
})

const normalizeResolvedStream = (payload, source) => ({
  strategy: 'native',
  succeeded: true,
  mediaType: source.mediaType,
  providerId: source.providerId,
  providerLabel: source.providerLabel,
  providerHost: payload?.providerHost || '',
  embedUrl: source.embedUrl,
  streamUrl: payload?.streamUrl || '',
  streamType: inferStreamKind(payload?.streamType, payload?.streamUrl || ''),
  headers: payload?.headers || {},
  pageUrl: payload?.pageUrl || '',
  sessionId: payload?.sessionId || null,
})

export const resolveProviderStream = async (source) => {
  console.info('[NativePlayer] resolving provider', {
    providerId: source.providerId,
    providerLabel: source.providerLabel,
    embedUrl: source.embedUrl,
  })

  const payload = await invoke('resolve_embed_stream', {
    payload: {
      providerId: source.providerId,
      embedUrl: source.embedUrl,
    },
  })

  if (!payload?.streamUrl) {
    throw new Error('Provider did not return a playable stream URL')
  }

  console.info('[NativePlayer] resolved provider', {
    providerId: source.providerId,
    providerLabel: source.providerLabel,
    streamType: payload.streamType,
    streamUrl: payload.streamUrl,
    providerHost: payload.providerHost,
  })

  return normalizeResolvedStream(payload, source)
}

export const resolveNativePlayback = async ({
  mediaType,
  tmdbId,
  season = 1,
  episode = 1,
  onAttempt = null,
} = {}) => {
  const normalizedMediaType = isMovieLikeMediaType(mediaType) ? mediaType : 'tv'
  const sources = buildProviderSources(normalizedMediaType, tmdbId, season, episode)

  if (!isTauriRuntime()) {
    return buildIframeFallbackResult(FALLBACK_REASON_UNSUPPORTED, sources)
  }

  const attempts = []

  for (const source of sources) {
    const attempt = {
      providerId: source.providerId,
      providerLabel: source.providerLabel,
      embedUrl: source.embedUrl,
      status: 'pending',
    }
    attempts.push(attempt)

    if (typeof onAttempt === 'function') {
      onAttempt({ ...attempt, phase: 'start' })
    }

    try {
      const resolved = await resolveProviderStream(source)
      attempt.status = 'resolved'
      attempt.streamType = resolved.streamType
      attempt.streamUrl = resolved.streamUrl

      if (typeof onAttempt === 'function') {
        onAttempt({ ...attempt, phase: 'resolved' })
      }

      return {
        ...resolved,
        attempts,
        sources,
      }
    } catch (error) {
      attempt.status = 'failed'
      attempt.error = error instanceof Error ? error.message : String(error)

      if (typeof onAttempt === 'function') {
        onAttempt({ ...attempt, phase: 'failed' })
      }
    }
  }

  return buildIframeFallbackResult(FALLBACK_REASON_UNRESOLVED, sources, attempts)
}

export const getNativePlaybackSources = buildProviderSources
