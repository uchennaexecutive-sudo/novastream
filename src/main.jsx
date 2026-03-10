import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource-variable/jetbrains-mono'
import './themes/themes.css'
import './index.css'

// Apply theme before first render to prevent flash
const saved = localStorage.getItem('nova-theme') || 'nova-dark'
document.documentElement.setAttribute('data-theme', saved)

import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import UpdateToast from './components/UI/UpdateToast'

const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__

function Root() {
  const [updateInfo, setUpdateInfo] = useState(null)
  const [showUpdateToast, setShowUpdateToast] = useState(false)

  useEffect(() => {
    if (!isTauri) return

    async function checkUpdates() {
      try {
        const { check } = await import('@tauri-apps/plugin-updater')
        const update = await check()
        if (update?.available) {
          setUpdateInfo({ version: update.version, update })
          setShowUpdateToast(true)
        }
      } catch (e) {
        console.log('Update check failed:', e)
      }
    }
    setTimeout(checkUpdates, 3000)
  }, [])

  return (
    <React.StrictMode>
      <App />
      {showUpdateToast && (
        <UpdateToast
          updateInfo={updateInfo}
          onDismiss={() => setShowUpdateToast(false)}
        />
      )}
    </React.StrictMode>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />)
