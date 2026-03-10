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

// Current app version — must match tauri.conf.json
const APP_VERSION = '1.0.1'

// GitHub API endpoint (api.github.com works even when raw.githubusercontent.com is blocked)
const UPDATE_API = 'https://api.github.com/repos/uchennaexecutive-sudo/novastream/contents/updates/latest.json'

function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1
    if ((pa[i] || 0) > (pb[i] || 0)) return 1
  }
  return 0
}

function Root() {
  const [updateInfo, setUpdateInfo] = useState(null)
  const [showUpdateToast, setShowUpdateToast] = useState(false)

  useEffect(() => {
    if (!isTauri) return

    async function checkUpdates() {
      try {
        // Try Tauri updater first (works if raw.githubusercontent.com is reachable)
        const { check } = await import('@tauri-apps/plugin-updater')
        const update = await check()
        if (update?.available) {
          setUpdateInfo({ version: update.version, update, notes: update.body })
          setShowUpdateToast(true)
          return
        }
      } catch (e) {
        console.log('Tauri updater failed, trying GitHub API fallback:', e)
      }

      // Fallback: fetch update info via GitHub API (works on restricted networks)
      try {
        const res = await fetch(UPDATE_API, {
          headers: { 'Accept': 'application/vnd.github.v3.raw' }
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        if (data.version && compareVersions(APP_VERSION, data.version) < 0) {
          setUpdateInfo({
            version: data.version,
            notes: data.notes,
            downloadUrl: data.platforms?.['windows-x86_64']?.url,
            update: null, // no Tauri update object — will use browser download
          })
          setShowUpdateToast(true)
        }
      } catch (e2) {
        console.log('GitHub API update check also failed:', e2)
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
