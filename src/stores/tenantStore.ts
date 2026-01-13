import { create } from 'zustand'
import type { Tenant } from '@/types'
import { getTenantById, getGlobalData, setGlobalData } from '@/lib/storage/storage'
import { applyTenantTheme, removeTenantTheme } from '@/lib/tenant/theme'

interface TenantState {
  currentTenant: Tenant | null
  isLoading: boolean
  setTenant: (tenant: Tenant | null) => void
  loadTenant: (tenantId: string) => void
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

  loadTenant: (tenantId) => {
    set({ isLoading: true })
    
    try {
      // Tenta carregar do localStorage
      const tenant = getTenantById(tenantId)
      
      if (tenant) {
        // Converte datas de string para Date
        const tenantWithDates: Tenant = {
          ...tenant,
          createdAt: tenant.createdAt instanceof Date 
            ? tenant.createdAt 
            : new Date(tenant.createdAt),
          subscription: tenant.subscription ? {
            ...tenant.subscription,
            trialStartDate: tenant.subscription.trialStartDate instanceof Date
              ? tenant.subscription.trialStartDate
              : new Date(tenant.subscription.trialStartDate),
            trialEndDate: tenant.subscription.trialEndDate instanceof Date
              ? tenant.subscription.trialEndDate
              : new Date(tenant.subscription.trialEndDate),
            subscriptionStartDate: tenant.subscription.subscriptionStartDate
              ? (tenant.subscription.subscriptionStartDate instanceof Date
                  ? tenant.subscription.subscriptionStartDate
                  : new Date(tenant.subscription.subscriptionStartDate))
              : undefined,
            subscriptionEndDate: tenant.subscription.subscriptionEndDate
              ? (tenant.subscription.subscriptionEndDate instanceof Date
                  ? tenant.subscription.subscriptionEndDate
                  : new Date(tenant.subscription.subscriptionEndDate))
              : undefined,
          } : undefined,
        }
        get().setTenant(tenantWithDates)
      } else {
        // Verifica se há tenant salvo na sessão
        const savedTenantId = getGlobalData<string>('currentTenantId')
        if (savedTenantId !== tenantId) {
          // Se não encontrou, limpa
          get().clearTenant()
        }
      }
    } catch (error) {
      console.error('Erro ao carregar tenant:', error)
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

// Inicializa tenant salvo ao carregar a página
if (typeof window !== 'undefined') {
  const savedTenantId = getGlobalData<string>('currentTenantId')
  if (savedTenantId) {
    useTenantStore.getState().loadTenant(savedTenantId)
  }
}

