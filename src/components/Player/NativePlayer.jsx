import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { imgOriginal, imgW500 } from '../../lib/tmdb'
import { saveProgress } from '../../lib/progress'
import { getNativePlaybackSources, resolveProviderStream } from '../../lib/nativePlayback'
import { isMovieLikeMediaType } from '../../lib/embeds'
import SharedNativePlayer from './SharedNativePlayer'

export default function NativePlayer({
  isOpen,
  onClose,
  tmdbId,
  mediaType,
  title,
  posterPath,
  backdropPath,
  season = 1,
  episode = 1,
  resumeAt = 0,
  durationHintSeconds = 0,
}) {
  const isTauri = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)
  const isMovieLike = isMovieLikeMediaType(mediaType)
  const poster = posterPath?.startsWith?.('http') ? posterPath : imgW500(posterPath)
  const backdrop = backdropPath?.startsWith?.('http') ? backdropPath : imgOriginal(backdropPath)
  const sources = useMemo(
    () => getNativePlaybackSources(mediaType, String(tmdbId || ''), season, episode),
    [episode, mediaType, season, tmdbId]
  )

  const lastPlaybackRef = useRef({
    progressSeconds: Math.max(0, Math.floor(Number(resumeAt) || 0)),
    durationSeconds: Math.max(0, Math.floor(Number(durationHintSeconds) || 0)),
  })

  const [sourceIndex, setSourceIndex] = useState(0)
  const [resolverNonce, setResolverNonce] = useState(0)
  const [resolvedStream, setResolvedStream] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState('Resolving stream...')
  const [error, setError] = useState('')
  const [errorDetail, setErrorDetail] = useState('')

  const activeSource = sources[sourceIndex] || null
  const providerPosition = sources.length > 0
    ? `${Math.min(sourceIndex + 1, sources.length)}/${sources.length}`
    : '0/0'
  const footerMeta = isMovieLike
    ? `${resolvedStream?.providerLabel || activeSource?.providerLabel || 'Provider'} | ${(resolvedStream?.streamType || 'native').toUpperCase()}`
    : `Season ${season} Episode ${episode} | ${resolvedStream?.providerLabel || activeSource?.providerLabel || 'Provider'} | ${(resolvedStream?.streamType || 'native').toUpperCase()}`

  const persistProgress = useCallback(async (snapshot = lastPlaybackRef.current) => {
    const progressSeconds = Math.max(0, Math.floor(Number(snapshot?.progressSeconds) || 0))
    const nextDuration = Math.max(
      0,
      Math.floor(Number(snapshot?.durationSeconds) || durationHintSeconds || 0)
    )

    lastPlaybackRef.current = {
      progressSeconds,
      durationSeconds: nextDuration,
    }

    if (!tmdbId || progressSeconds <= 0) return null

    return saveProgress({
      contentId: String(tmdbId),
      contentType: mediaType,
      title,
      poster,
      backdrop,
      season: isMovieLike ? null : season,
      episode: isMovieLike ? null : episode,
      progressSeconds,
      durationSeconds: nextDuration,
    })
  }, [backdrop, durationHintSeconds, episode, isMovieLike, mediaType, poster, season, title, tmdbId])

  const advanceToNextProvider = useCallback((detail = '') => {
    if (detail) {
      setErrorDetail(detail)
    }

    setResolvedStream(null)
    setError('')

    if (sourceIndex < sources.length - 1) {
      setSourceIndex(index => index + 1)
      return
    }

    setLoading(false)
    setLoadingStage('')
    setError('Could not load stream')
  }, [sourceIndex, sources.length])

  const retryProviderScan = useCallback(() => {
    setSourceIndex(0)
    setResolvedStream(null)
    setError('')
    setErrorDetail('')
    setLoading(true)
    setLoadingStage('Resolving stream...')
    setResolverNonce(value => value + 1)
  }, [])

  const handleStreamFailure = useCallback((detail) => {
    setErrorDetail(detail || '')
    persistProgress().catch(() => {})
    advanceToNextProvider(detail || '')
  }, [advanceToNextProvider, persistProgress])

  const handlePersistProgress = useCallback((snapshot) => (
    persistProgress(snapshot)
  ), [persistProgress])

  const handlePlaybackSnapshot = useCallback((snapshot) => {
    lastPlaybackRef.current = snapshot
  }, [])

  useEffect(() => {
    if (!isOpen) return

    setSourceIndex(0)
    setResolverNonce(0)
    setResolvedStream(null)
    setLoading(isTauri)
    setLoadingStage(isTauri ? 'Resolving stream...' : '')
    setError(isTauri ? '' : 'Native playback unavailable')
    setErrorDetail(isTauri ? '' : 'Native playback is only available in the desktop app.')
    lastPlaybackRef.current = {
      progressSeconds: Math.max(0, Math.floor(Number(resumeAt) || 0)),
      durationSeconds: Math.max(0, Math.floor(Number(durationHintSeconds) || 0)),
    }
  }, [durationHintSeconds, isOpen, isTauri, resumeAt, season, episode, tmdbId, mediaType])

  useEffect(() => {
    if (!isOpen || !isTauri) return undefined
    if (!activeSource?.embedUrl) {
      setLoading(false)
      setLoadingStage('')
      setError('Could not load stream')
      setErrorDetail('No native providers are available for this title.')
      return undefined
    }

    let cancelled = false

    setLoading(true)
    setLoadingStage(`Trying ${activeSource.providerLabel} (${providerPosition})...`)
    setError('')
    console.info('[NativePlayer] trying source', {
      providerId: activeSource.providerId,
      providerLabel: activeSource.providerLabel,
      embedUrl: activeSource.embedUrl,
      providerPosition,
    })

    resolveProviderStream(activeSource)
      .then((payload) => {
        if (cancelled) return
        setResolvedStream(payload)
        setLoading(false)
        setLoadingStage('Buffering...')
        setError('')
        setErrorDetail('')
      })
      .catch((resolverError) => {
        if (cancelled) return
        const detail = resolverError instanceof Error ? resolverError.message : String(resolverError)
        console.warn('[NativePlayer] provider failed', {
          providerId: activeSource.providerId,
          providerLabel: activeSource.providerLabel,
          detail,
        })
        advanceToNextProvider(detail)
      })

    return () => {
      cancelled = true
    }
  }, [activeSource, advanceToNextProvider, isOpen, isTauri, providerPosition, resolverNonce])

  if (!isOpen) return null

  return (
    <SharedNativePlayer
      title={title}
      backdrop={backdrop}
      streamUrl={resolvedStream?.streamUrl || ''}
      streamHeaders={resolvedStream?.headers || {}}
      streamSessionId={resolvedStream?.sessionId || null}
      streamType={resolvedStream?.streamType || 'hls'}
      streamLabel={resolvedStream?.providerLabel || activeSource?.providerLabel || 'Provider'}
      streamMeta={footerMeta}
      loading={loading}
      loadingStage={loadingStage}
      loadingHost={resolvedStream?.providerHost || activeSource?.providerLabel || ''}
      error={error}
      errorDetail={errorDetail}
      onRetry={retryProviderScan}
      onClose={() => {
        persistProgress().catch(() => {})
        onClose?.()
      }}
      onStreamFailure={handleStreamFailure}
      onPersistProgress={handlePersistProgress}
      onPlaybackSnapshot={handlePlaybackSnapshot}
      subtitleCues={[]}
      subtitleEnabled={false}
      hasPrev={false}
      hasNext={false}
      resumeAt={lastPlaybackRef.current.progressSeconds || resumeAt}
      resumeKey={`${mediaType}-${tmdbId}-${season}-${episode}-${sourceIndex}-${resolverNonce}`}
    />
  )
}
