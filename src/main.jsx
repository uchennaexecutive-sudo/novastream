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
const APP_VERSION = '1.0.2'

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
  // 'idle' | 'downloading' | 'ready' | 'error'
  const [updateState, setUpdateState] = useState('idle')
  const [updateVersion, setUpdateVersion] = useState(null)
  const [updateNotes, setUpdateNotes] = useState(null)

  useEffect(() => {
    if (!isTauri) return

    async function checkAndDownload() {
      try {
        // Fetch update info from GitHub API
        const res = await fetch(UPDATE_API, {
          headers: { 'Accept': 'application/vnd.github.v3.raw' }
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        if (!data.version || compareVersions(APP_VERSION, data.version) >= 0) {
          return // No update available
        }

        const downloadUrl = data.platforms?.['windows-x86_64']?.url
        if (!downloadUrl) return

        setUpdateVersion(data.version)
        setUpdateNotes(data.notes)
        setUpdateState('downloading')

        // Silently download the update via Rust backend
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('download_update', { url: downloadUrl })

        // Download complete — show restart prompt
        setUpdateState('ready')
      } catch (e) {
        console.log('Update check/download failed:', e)
        setUpdateState('error')
      }
    }

    setTimeout(checkAndDownload, 3000)
  }, [])

  const handleRestart = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('apply_update')
    } catch (e) {
      console.error('Failed to apply update:', e)
    }
  }

  return (
    <React.StrictMode>
      <App />
      {updateState === 'ready' && (
        <UpdateToast
          version={updateVersion}
          notes={updateNotes}
          onRestart={handleRestart}
        />
      )}
    </React.StrictMode>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />)
