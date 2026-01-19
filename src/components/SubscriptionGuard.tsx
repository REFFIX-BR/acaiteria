import { useTenantStore } from '@/stores/tenantStore'
import { getPlanInfo } from '@/lib/subscription/subscription'
import { Navigate, useLocation } from 'react-router-dom'

interface SubscriptionGuardProps {
  children: React.ReactNode
  showUpgradePrompt?: boolean
}

/**
 * Componente que bloqueia o acesso se a subscription estiver expirada
 */
export function SubscriptionGuard({ children, showUpgradePrompt = true }: SubscriptionGuardProps) {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const location = useLocation()

  if (!currentTenant) {
    return <>{children}</>
  }

  const planInfo = getPlanInfo(currentTenant)

  // Se não deve mostrar prompt de bloqueio, sempre permite acesso (ex: página de planos)
  if (!showUpgradePrompt) {
    return <>{children}</>
  }

  // Se está expirado, redireciona automaticamente para a página de planos
  if (planInfo.isExpired && location.pathname !== '/plans') {
    return <Navigate to="/plans" replace />
  }

  // Se a subscription está ativa, permite acesso
  if (planInfo.isActive) {
    return <>{children}</>
  }

  // Por padrão, permite acesso
  return <>{children}</>
}

