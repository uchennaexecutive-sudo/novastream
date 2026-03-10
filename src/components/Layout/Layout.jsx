import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BackgroundOrbs from './BackgroundOrbs'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import TitleBar from './TitleBar'
import useAppStore from '../../store/useAppStore'

const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__

const pageVariants = {
  initial: { opacity: 0, y: 20, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -10, filter: 'blur(4px)' },
}

const pageTransition = {
  duration: 0.4,
  ease: [0.4, 0, 0.2, 1],
}

export default function Layout() {
  const setSearchOpen = useAppStore(s => s.setSearchOpen)
  const location = useLocation()

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSearchOpen])

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg-base)' }}>
      <TitleBar />
      <BackgroundOrbs />
      <TopBar />
      <Sidebar />
      <main className={`relative ml-[72px] min-h-screen ${isTauri ? 'pt-[78px]' : 'pt-14'}`} style={{ zIndex: 1 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
