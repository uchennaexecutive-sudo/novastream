import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Home from './pages/Home'
import Movies from './pages/Movies'
import Series from './pages/Series'
import Anime from './pages/Anime'
import Animation from './pages/Animation'
import Detail from './pages/Detail'
import Watchlist from './pages/Watchlist'
import History from './pages/History'
import Settings from './pages/Settings'
import SearchOverlay from './components/Search/SearchOverlay'
import useAppStore from './store/useAppStore'

export default function App() {
  const searchOpen = useAppStore(s => s.searchOpen)

  return (
    <BrowserRouter>
      <Routes>
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
      {searchOpen && <SearchOverlay />}
    </BrowserRouter>
  )
}
