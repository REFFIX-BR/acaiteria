import { create } from 'zustand'
import type { Tenant } from '@/types'
import { getGlobalData, setGlobalData } from '@/lib/storage/storage'
import { applyTenantTheme, removeTenantTheme } from '@/lib/tenant/theme'
import { getApiUrl } from '@/lib/api/config'
import { getAuthToken } from '@/lib/api/auth'

interface TenantState {
  currentTenant: Tenant | null
  isLoading: boolean
  setTenant: (tenant: Tenant | null) => void
  loadTenant: (tenantId: string) => Promise<void>
  clearTenant: () => void
}

export const useTenantStore = create<TenantState>((set, get) => ({
  currentTenant: null,
  isLoading: false,

  setTenant: (tenant) => {
    if (tenant) {
      applyTenantTheme(tenant)
      setGlobalData('currentTenantId', tenant.id)
    } else {
      removeTenantTheme()
      setGlobalData('currentTenantId', null)
    }
    set({ currentTenant: tenant })
  },

  loadTenant: async (tenantId) => {
    set({ isLoading: true })
    
    try {
      const apiUrl = getApiUrl()
      const token = getAuthToken()

      if (!token) {
        console.warn('[TenantStore] Sem token de autenticação, não é possível carregar tenant')
        get().clearTenant()
        return
      }

      // Buscar tenant do backend
      const response = await fetch(`${apiUrl}/api/tenants/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 404 || response.status === 401) {
          console.warn('[TenantStore] Tenant não encontrado ou não autenticado')
          get().clearTenant()
          return
        }
        throw new Error(`Erro ao buscar tenant: ${response.status}`)
      }

      const data = await response.json()
      const tenantData = data.tenant

      // Converter datas de string para Date
      const tenantWithDates: Tenant = {
        id: tenantData.id,
        name: tenantData.name,
        slug: tenantData.slug,
        logo: tenantData.logo || undefined,
        primaryColor: tenantData.primaryColor || '#8b5cf6',
        secondaryColor: tenantData.secondaryColor || '#ec4899',
        createdAt: tenantData.createdAt ? new Date(tenantData.createdAt) : new Date(),
        subscription: tenantData.subscription ? {
          id: tenantData.subscription.id,
          planType: tenantData.subscription.planType,
          trialStartDate: tenantData.subscription.trialStartDate 
            ? new Date(tenantData.subscription.trialStartDate)
            : new Date(),
          trialEndDate: tenantData.subscription.trialEndDate
            ? new Date(tenantData.subscription.trialEndDate)
            : new Date(),
          subscriptionStartDate: tenantData.subscription.subscriptionStartDate
            ? new Date(tenantData.subscription.subscriptionStartDate)
            : undefined,
          subscriptionEndDate: tenantData.subscription.subscriptionEndDate
            ? new Date(tenantData.subscription.subscriptionEndDate)
            : undefined,
          isActive: tenantData.subscription.isActive ?? true,
          isTrial: tenantData.subscription.isTrial ?? false,
        } : undefined,
      }

      get().setTenant(tenantWithDates)
    } catch (error) {
      console.error('[TenantStore] Erro ao carregar tenant:', error)
      get().clearTenant()
    } finally {
      set({ isLoading: false })
    }
  },

  clearTenant: () => {
    removeTenantTheme()
    setGlobalData('currentTenantId', null)
    set({ currentTenant: null })
  },
}))

// Inicializa tenant salvo ao carregar a página (se houver token)
if (typeof window !== 'undefined') {
  const savedTenantId = getGlobalData<string>('currentTenantId')
  const token = getAuthToken()
  
  if (savedTenantId && token) {
    useTenantStore.getState().loadTenant(savedTenantId)
  }
}
