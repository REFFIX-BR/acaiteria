import { useEffect } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { applyTenantTheme, removeTenantTheme } from '@/lib/tenant/theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const currentTenant = useTenantStore((state) => state.currentTenant)

  useEffect(() => {
    if (currentTenant) {
      applyTenantTheme(currentTenant)
    } else {
      removeTenantTheme()
    }
  }, [currentTenant])

  return <>{children}</>
}

