import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Home from './pages/Home'
import Movies from './pages/Movies'
import Series from './pages/Series'
import Anime from './pages/Anime'
import Animation from './pages/Animation'
import Detail from './pages/Detail'
import IframePlayerWindow from './pages/IframePlayerWindow'
import BrowserFetchBridge from './pages/BrowserFetchBridge'
import Watchlist from './pages/Watchlist'
import History from './pages/History'
import Settings from './pages/Settings'
import SearchOverlay from './components/Search/SearchOverlay'
import GalaxyIntro from './components/Intro/GalaxyIntro'
import useAppStore from './store/useAppStore'

export default function App() {
  const searchOpen = useAppStore(s => s.searchOpen)
  const isSpecialWindow = typeof window !== 'undefined'
    && (
      window.location.pathname.startsWith('/player-window')
      || window.location.pathname.startsWith('/fetch-bridge')
    )
  const [showIntro, setShowIntro] = useState(
    !isSpecialWindow && !sessionStorage.getItem('nova-intro-shown')
  )

  const handleIntroComplete = () => {
    sessionStorage.setItem('nova-intro-shown', 'true')
    setShowIntro(false)
  }

  if (showIntro) {
    return <GalaxyIntro onComplete={handleIntroComplete} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/player-window" element={<IframePlayerWindow />} />
        <Route path="/fetch-bridge" element={<BrowserFetchBridge />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/series" element={<Series />} />
          <Route path="/anime" element={<Anime />} />
          <Route path="/animation" element={<Animation />} />
          <Route path="/detail/:type/:id" element={<Detail />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
      {!isSpecialWindow && searchOpen && <SearchOverlay />}
    </BrowserRouter>
  )
}
