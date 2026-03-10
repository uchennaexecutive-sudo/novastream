import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const PARTICLE_COUNT = 200
const TOTAL_DURATION = 4000

function randomBetween(a, b) {
  return a + Math.random() * (b - a)
}

function randomEdgePosition() {
  const side = Math.floor(Math.random() * 4)
  switch (side) {
    case 0: return { x: randomBetween(0, 100), y: -5 }
    case 1: return { x: randomBetween(0, 100), y: 105 }
    case 2: return { x: -5, y: randomBetween(0, 100) }
    case 3: return { x: 105, y: randomBetween(0, 100) }
    default: return { x: 50, y: 50 }
  }
}

export default function GalaxyIntro({ onComplete }) {
  const [stage, setStage] = useState(0) // 0=particles, 1=logo, 2=pulse, 3=fadeout
  const [showSkip, setShowSkip] = useState(false)

  const particles = useMemo(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const start = randomEdgePosition()
      return {
        id: i,
        startX: start.x,
        startY: start.y,
        size: randomBetween(2, 4),
        duration: randomBetween(1.2, 1.8),
        delay: randomBetween(0, 0.3),
        isAccent: Math.random() > 0.7,
      }
    }), []
  )

  useEffect(() => {
    const timers = [
      setTimeout(() => setShowSkip(true), 1000),
      setTimeout(() => setStage(1), 1500),
      setTimeout(() => setStage(2), 2500),
      setTimeout(() => setStage(3), 3000),
      setTimeout(() => onComplete(), TOTAL_DURATION),
    ]
    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  const handleSkip = () => {
    onComplete()
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{
        zIndex: 100000,
        background: stage >= 3 ? 'var(--bg-base)' : '#000',
        transition: 'background 0.5s ease',
      }}
    >
      {/* Particles */}
      <AnimatePresence>
        {stage < 2 && particles.map(p => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              background: p.isAccent ? 'var(--accent)' : '#fff',
              boxShadow: p.isAccent
                ? '0 0 6px var(--accent-glow)'
                : '0 0 4px rgba(255,255,255,0.5)',
            }}
            initial={{
              left: `${p.startX}%`,
              top: `${p.startY}%`,
              opacity: 0.8,
            }}
            animate={{
              left: '50%',
              top: '50%',
              opacity: stage >= 1 ? 0 : 0.8,
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: 'easeIn',
            }}
          />
        ))}
      </AnimatePresence>

      {/* Logo */}
      <AnimatePresence>
        {stage >= 1 && stage < 4 && (
          <motion.div
            className="absolute flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: stage >= 3 ? 0 : 1,
              scale: stage === 2 ? [1, 1.05, 1] : 1,
            }}
            transition={{
              opacity: { duration: stage >= 3 ? 0.5 : 0.5 },
              scale: { duration: 0.3 },
            }}
          >
            <h1
              className="font-display font-bold text-center"
              style={{
                fontSize: 72,
                filter: 'drop-shadow(0 0 30px var(--accent))',
                letterSpacing: '0.05em',
              }}
            >
              <span style={{ color: '#fff' }}>NOVA</span>{' '}
              <span style={{ color: 'var(--accent)' }}>STREAM</span>
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Radial pulse burst */}
      <AnimatePresence>
        {stage === 2 && (
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 200,
              height: 200,
              background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 4, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* Skip button */}
      <AnimatePresence>
        {showSkip && stage < 3 && (
          <motion.button
            className="absolute top-6 right-6 px-4 py-2 rounded-xl text-sm font-medium"
            style={{
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
              color: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleSkip}
            whileHover={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
          >
            Skip →
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
