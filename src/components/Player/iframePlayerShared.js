import { DEFAULT_SERVER_LABELS } from '../../lib/embeds'

export { DEFAULT_SERVER_LABELS }

const toNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const readNumber = (source, keys) => {
  if (!source || typeof source !== 'object') return null

  for (const key of keys) {
    const value = toNumber(source[key])
    if (value !== null) return value
  }

  return null
}

export const parseMessagePayload = (payload) => {
  let parsed = payload

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return null
    }
  }

  if (!parsed || typeof parsed !== 'object') return null

  const candidates = [
    parsed,
    parsed.data,
    parsed.payload,
    parsed.message,
    parsed.player,
    parsed.detail,
    parsed.progress,
  ].filter(Boolean)

  for (const candidate of candidates) {
    const progressSeconds = readNumber(candidate, [
      'progressSeconds',
      'currentTime',
      'current_time',
      'playedSeconds',
      'time',
      'seconds',
      'position',
    ])
    const durationSeconds = readNumber(candidate, [
      'durationSeconds',
      'duration',
      'totalDuration',
      'total_duration',
      'length',
    ])

    if (progressSeconds !== null || durationSeconds !== null) {
      return {
        progressSeconds: Math.max(0, Math.floor(progressSeconds || 0)),
        durationSeconds: Math.max(0, Math.floor(durationSeconds || 0)),
      }
    }
  }

  return null
}

export const withResumeParams = (url, seconds) => {
  const startSeconds = Math.max(0, Math.floor(Number(seconds) || 0))
  if (!startSeconds) return url

  try {
    const nextUrl = new URL(url)
    nextUrl.searchParams.set('start', String(startSeconds))
    nextUrl.searchParams.set('t', String(startSeconds))
    nextUrl.hash = `t=${startSeconds}`
    return nextUrl.toString()
  } catch {
    return url
  }
}

export const buildResumeMessages = (seconds) => {
  const time = Math.max(0, Math.floor(Number(seconds) || 0))
  if (!time) return []

  return [
    { type: 'nova:seek', seconds: time },
    { type: 'seek', seconds: time },
    { type: 'seek', time },
    { action: 'seek', seconds: time },
    { action: 'seek', time },
    { command: 'seek', seconds: time },
    { command: 'seek', time },
    { event: 'seek', seconds: time },
  ]
}
