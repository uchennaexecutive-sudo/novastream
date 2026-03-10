export default function GlassBadge({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${className}`}
      style={{
        background: 'var(--bg-glass)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: 'var(--inner-glow)',
      }}
    >
      {children}
    </span>
  )
}
