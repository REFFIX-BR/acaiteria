import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, DollarSign, Calendar, Clock, ArrowUpRight } from 'lucide-react'
import { useTenantStore } from '@/stores/tenantStore'
import { getSalesByPeriod, getTotalRevenue } from '@/lib/api/dashboard'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { PeriodFilter } from './DashboardFilter'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

interface KPICardsProps {
  period: PeriodFilter
  startDate?: Date
  endDate?: Date
}

export function KPICards({ period, startDate, endDate }: KPICardsProps) {
  const currentTenant = useTenantStore((state) => state.currentTenant)

  const kpis = useMemo(() => {
    if (!currentTenant) return null

    const periodSales = getSalesByPeriod(currentTenant.id, period, startDate, endDate)
    const total = getTotalRevenue(currentTenant.id)

    return {
      period: periodSales,
      total,
    }
  }, [currentTenant, period, startDate, endDate])

  if (!currentTenant || !kpis) {
    return null
  }

  const getPeriodDescription = () => {
    switch (period) {
      case 'today':
        return 'Faturamento do dia'
      case 'week':
        return 'Últimos 7 dias'
      case 'month':
        return 'Este mês'
      case 'year':
        return 'Este ano'
      case 'custom':
        return 'Período selecionado'
      default:
        return 'Este mês'
    }
  }

  const cards = [
    {
      title: 'Vendas do Período',
      value: formatCurrency(kpis.period),
      icon: TrendingUp,
      description: getPeriodDescription(),
      gradient: 'from-green-500 to-green-600',
      bgGradient: 'from-green-50 to-green-50/50 dark:from-green-950/20 dark:to-green-950/10',
      delay: '0ms',
    },
    {
      title: 'Faturamento Total',
      value: formatCurrency(kpis.total),
      icon: DollarSign,
      description: 'Acumulado',
      gradient: 'from-orange-500 to-orange-600',
      bgGradient: 'from-orange-50 to-orange-50/50 dark:from-orange-950/20 dark:to-orange-950/10',
      delay: '100ms',
    },
  ]

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {cards.map((card, index) => {
        const Icon = card.icon
        return (
          <Card
            key={card.title}
            className={cn(
              'relative overflow-hidden border-0 shadow-lg card-hover animate-slide-up',
              `bg-gradient-to-br ${card.bgGradient}`
            )}
            style={{ animationDelay: card.delay }}
          >
            {/* Decorative gradient overlay */}
            <div className={cn(
              'absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20',
              `bg-gradient-to-br ${card.gradient}`
            )} />
            
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={cn(
                'p-2 rounded-lg shadow-md',
                `bg-gradient-to-br ${card.gradient}`
              )}>
                <Icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="flex items-baseline gap-2 mb-1">
                <div className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                  {card.value}
                </div>
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                {card.description}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

