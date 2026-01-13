import { create } from 'zustand'
import type { User } from '@/types'
import { getCurrentUser, setCurrentUser, logout as authLogout } from '@/lib/auth/auth'

interface AuthState {
  currentUser: User | null
  isLoading: boolean
  setUser: (user: User | null) => void
  loadUser: () => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  isLoading: false,

  setUser: (user) => {
    setCurrentUser(user)
    set({ currentUser: user })
  },

  loadUser: () => {
    set({ isLoading: true })
    
    try {
      const user = getCurrentUser()
      if (user) {
        // Converte datas de string para Date
        const userWithDates: User = {
          ...user,
          createdAt: user.createdAt instanceof Date ? user.createdAt : new Date(user.createdAt),
          lastLogin: user.lastLogin instanceof Date ? user.lastLogin : (user.lastLogin ? new Date(user.lastLogin) : undefined),
        }
        set({ currentUser: userWithDates })
      } else {
        set({ currentUser: null })
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error)
      set({ currentUser: null })
    } finally {
      set({ isLoading: false })
    }
  },

  logout: () => {
    authLogout()
    set({ currentUser: null })
  },
}))

// Inicializa usuário salvo ao carregar a página
if (typeof window !== 'undefined') {
  useAuthStore.getState().loadUser()
}

