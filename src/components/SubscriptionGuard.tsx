import { useTenantStore } from '@/stores/tenantStore'
import { getPlanInfo } from '@/lib/subscription/subscription'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Crown, AlertCircle, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface SubscriptionGuardProps {
  children: React.ReactNode
  showUpgradePrompt?: boolean
}

/**
 * Componente que bloqueia o acesso se a subscription estiver expirada
 */
export function SubscriptionGuard({ children, showUpgradePrompt = true }: SubscriptionGuardProps) {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const navigate = useNavigate()

  if (!currentTenant) {
    return <>{children}</>
  }

  const planInfo = getPlanInfo(currentTenant)

  // Se não deve mostrar prompt de bloqueio, sempre permite acesso (ex: página de planos)
  if (!showUpgradePrompt) {
    return <>{children}</>
  }

  // Se a subscription está ativa, permite acesso
  if (planInfo.isActive) {
    return <>{children}</>
  }

  // Se está expirado, mostra bloqueio
  if (planInfo.isExpired) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full border-destructive">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Lock className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-destructive">Acesso Bloqueado</CardTitle>
                <CardDescription>
                  Seu período de teste expirou
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Para continuar utilizando a plataforma, você precisa fazer upgrade para um dos nossos planos.
              </p>
              <p className="text-sm text-muted-foreground">
                Escolha o plano ideal para o seu negócio e tenha acesso completo a todas as funcionalidades.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => navigate('/plans')}
            >
              <Crown className="h-4 w-4 mr-2" />
              Ver Planos e Fazer Upgrade
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Por padrão, permite acesso
  return <>{children}</>
}

