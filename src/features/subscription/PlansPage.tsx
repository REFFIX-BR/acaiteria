import { useState } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { saveTenant } from '@/lib/storage/storage'
import { upgradeSubscription, getPlanInfo } from '@/lib/subscription/subscription'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Check, Crown, Sparkles, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import type { PlanType } from '@/types'
import { CheckoutModal } from './components/CheckoutModal'

const plans = [
  {
    id: 'basic' as PlanType,
    name: 'Plano Completo',
    price: 79.90,
    period: 'mês',
    description: 'Acesso completo a todas as funcionalidades',
    popular: true,
    features: [
      'Cardápio digital completo e personalizado',
      'Gestão de pedidos em tempo real',
      'Dashboard com métricas e analytics',
      'Relatórios de vendas detalhados',
      'Fluxo de caixa integrado',
      'Cardápio público personalizado',
      'QR Code para pedidos no balcão',
      'Campanhas de marketing',
      'Integração WhatsApp',
      'Sistema de cupons e descontos',
      'Gestão de clientes (CRM)',
      'Múltiplas categorias de produtos',
      'Suporte por email',
      'Pedidos ilimitados',
    ],
    color: 'from-purple-500 to-purple-600',
    icon: Crown,
  },
]

export default function PlansPage() {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { setTenant } = useTenantStore()
  const { toast } = useToast()
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<{ id: PlanType; name: string; price: number } | null>(null)

  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  const planInfo = getPlanInfo(currentTenant)

  const handleUpgrade = (planType: PlanType) => {
    if (!currentTenant) return

    const plan = plans.find(p => p.id === planType)
    if (!plan) return

    // Abre o modal de checkout
    setSelectedPlan({
      id: planType,
      name: plan.name,
      price: plan.price,
    })
    setCheckoutOpen(true)
  }

  const handlePaymentSuccess = () => {
    if (!currentTenant || !selectedPlan) return

    try {
      // Atualiza o tenant com o novo plano após pagamento bem-sucedido
      const updatedTenant = upgradeSubscription(currentTenant, selectedPlan.id)
      saveTenant(updatedTenant)
      setTenant(updatedTenant)

      toast({
        title: 'Assinatura ativada!',
        description: `Seu plano ${selectedPlan.name} foi ativado com sucesso.`,
      })

      setCheckoutOpen(false)
      setSelectedPlan(null)
    } catch (error) {
      console.error('Erro ao ativar assinatura:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao ativar assinatura. Entre em contato com o suporte.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Crown className="h-8 w-8 text-primary" />
          Planos e Assinaturas
        </h1>
        <p className="text-muted-foreground mt-2">
          Escolha o plano ideal para o seu negócio e tenha acesso completo a todas as funcionalidades da plataforma
        </p>
      </div>

      {/* Status atual */}
      {planInfo.isTrial && (
        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <AlertCircle className="h-6 w-6 text-orange-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Período de Teste</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Você está no período de teste gratuito. Restam{' '}
                  <span className="font-bold text-orange-500">
                    {planInfo.daysRemaining} {planInfo.daysRemaining === 1 ? 'dia' : 'dias'}
                  </span>{' '}
                  para experimentar todas as funcionalidades.
                </p>
                {currentTenant.subscription && (
                  <p className="text-xs text-muted-foreground">
                    Trial expira em:{' '}
                    {format(new Date(currentTenant.subscription.trialEndDate), "dd/MM/yyyy")}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {planInfo.isExpired && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1 text-destructive">
                  Período de Teste Expirado
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Seu período de teste expirou. Faça upgrade para continuar utilizando a plataforma.
                </p>
                <Button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                  Ver Planos
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Planos disponíveis */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Nosso Plano</h2>
        <div className="flex justify-center">
          <div className="w-full max-w-md">
        {plans.map((plan) => {
          const Icon = plan.icon
          const isCurrentPlan = currentTenant.subscription?.planType === plan.id && !planInfo.isTrial && planInfo.isActive
          const isUpgradingThis = isUpgrading === plan.id

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative transition-all duration-200',
                plan.popular && 'border-primary shadow-lg scale-105',
                isCurrentPlan && 'border-green-500 bg-green-500/5'
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Mais Popular
                  </Badge>
                </div>
              )}
              {isCurrentPlan && (
                <div className="absolute -top-3 right-4">
                  <Badge className="bg-green-500 text-white">
                    Plano Atual
                  </Badge>
                </div>
              )}
              <CardHeader>
                <div className={cn(
                  'w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-gradient-to-br',
                  plan.color
                )}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    R$ {plan.price.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-muted-foreground">/{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={cn(
                    'w-full mt-6',
                    plan.popular && 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700'
                  )}
                  variant={isCurrentPlan ? 'outline' : 'default'}
                  disabled={isCurrentPlan}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {isCurrentPlan ? (
                    'Plano Atual'
                  ) : (
                    'Assinar Plano'
                  )}
                </Button>
              </CardContent>
            </Card>
          )
        })}
          </div>
        </div>
      </div>

      {/* Informações adicionais */}
      <Card>
        <CardHeader>
          <CardTitle>Perguntas Frequentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Posso cancelar a qualquer momento?</h4>
            <p className="text-sm text-muted-foreground">
              Sim, você pode cancelar sua assinatura a qualquer momento. Não há taxas de cancelamento.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">O que acontece após o período de teste?</h4>
            <p className="text-sm text-muted-foreground">
              Após os 7 dias de teste, você precisará escolher um plano para continuar utilizando a plataforma.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Posso mudar de plano depois?</h4>
            <p className="text-sm text-muted-foreground">
              Sim, você pode fazer upgrade ou downgrade do seu plano a qualquer momento.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Checkout */}
      {selectedPlan && (
        <CheckoutModal
          open={checkoutOpen}
          onClose={() => {
            setCheckoutOpen(false)
            setSelectedPlan(null)
          }}
          planName={selectedPlan.name}
          planPrice={selectedPlan.price}
          planType={selectedPlan.id as 'basic' | 'premium' | 'enterprise'}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  )
}

