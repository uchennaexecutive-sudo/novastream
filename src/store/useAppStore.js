import { create } from 'zustand'

const useAppStore = create((set, get) => ({
  theme: localStorage.getItem('nova-theme') || 'nova-dark',
  setTheme: (id) => {
    document.documentElement.setAttribute('data-theme', id)
    localStorage.setItem('nova-theme', id)
    set({ theme: id })
  },

  preferences: JSON.parse(localStorage.getItem('nova-preferences') || JSON.stringify({
    defaultEmbed: 'vidsrc',
    autoplayNext: true,
    rememberPosition: true,
  })),
  setPreference: (key, value) => {
    const prefs = { ...get().preferences, [key]: value }
    localStorage.setItem('nova-preferences', JSON.stringify(prefs))
    set({ preferences: prefs })
  },

  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),

  sidebarExpanded: false,
  setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),
}))

export default useAppStore
