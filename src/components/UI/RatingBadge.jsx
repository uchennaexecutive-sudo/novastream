export default function RatingBadge({ rating }) {
  if (!rating) return null
  const score = typeof rating === 'number' ? rating.toFixed(1) : rating
  const numRating = typeof rating === 'number' ? rating : parseFloat(rating)
  const color = numRating >= 7 ? '#4ade80' : numRating >= 5 ? '#fbbf24' : '#f87171'

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs font-bold"
      style={{
        background: 'var(--accent-glow)',
        color: 'var(--text-primary)',
        border: '1px solid var(--accent)',
        boxShadow: '0 0 12px var(--accent-glow)',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full glow-dot"
        style={{ background: color }}
      />
      {score}
    </span>
  )
}
