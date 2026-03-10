import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function UpdateToast({ updateInfo, onDismiss }) {
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)

  if (!updateInfo) return null

  const handleUpdate = async () => {
    // If we have a Tauri update object, use it for seamless update
    if (updateInfo.update) {
      try {
        setDownloading(true)
        let downloaded = 0
        await updateInfo.update.downloadAndInstall((event) => {
          if (event.event === 'Progress') {
            downloaded += event.data.chunkLength
            setProgress(Math.min(downloaded / (event.data.contentLength || downloaded + 1) * 100, 100))
          } else if (event.event === 'Finished') {
            setProgress(100)
          }
        })
        const { relaunch } = await import('@tauri-apps/plugin-process')
        await relaunch()
      } catch (e) {
        console.error('Update failed:', e)
        // Fall back to browser download
        if (updateInfo.downloadUrl) {
          window.open(updateInfo.downloadUrl, '_blank')
        }
        setDownloading(false)
      }
    } else if (updateInfo.downloadUrl) {
      // Fallback: open download in browser
      window.open(updateInfo.downloadUrl, '_blank')
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-6 right-6"
        style={{
          zIndex: 99998,
          width: 320,
          background: 'var(--bg-surface)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <h3
          className="font-display font-bold text-base mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          Update Available
        </h3>
        <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
          NOVA STREAM v{updateInfo.version} is ready
        </p>
        {updateInfo.notes && (
          <p className="text-xs mb-4 font-mono" style={{ color: 'var(--text-muted)' }}>
            {updateInfo.notes}
          </p>
        )}

        {downloading && (
          <div
            className="w-full h-1.5 rounded-full mb-4 overflow-hidden"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--accent)' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={handleUpdate}
            disabled={downloading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              boxShadow: '0 0 20px var(--accent-glow)',
              opacity: downloading ? 0.6 : 1,
            }}
          >
            {downloading ? 'Downloading...' : updateInfo.update ? 'Update Now' : 'Download Update'}
          </button>
          {!downloading && (
            <button
              onClick={onDismiss}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              Later
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
