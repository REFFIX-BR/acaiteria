import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sun, TrendingUp, DollarSign } from 'lucide-react'
import { useTenantStore } from '@/stores/tenantStore'
import { useFinancialLocked } from '@/features/dashboard/context/DashboardFinancialContext'
import { useState, useEffect } from 'react'
import { getKPIs } from '@/lib/api/dashboard'
import { getFinancialSummary } from '@/lib/api/dashboard'
import { cn } from '@/lib/utils'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/**
 * Retorna o início e o fim de "hoje" no fuso local (para enviar à API).
 */
function getTodayRangeLocal() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { start, end }
}

export function DaySummary() {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const financialLocked = useFinancialLocked()
  const [sales, setSales] = useState<number | null>(null)
  const [summary, setSummary] = useState<{ income: number; expenses: number; profit: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!currentTenant) {
        setSales(null)
        setSummary(null)
        setIsLoading(false)
        return
      }
      try {
        setIsLoading(true)
        const { start, end } = getTodayRangeLocal()
        const [kpis, finSummary] = await Promise.all([
          getKPIs('today', start, end),
          getFinancialSummary(currentTenant.id, 'today', start, end),
        ])
        setSales(kpis.periodSales)
        setSummary(finSummary)
      } catch (error) {
        console.error('[DaySummary] Erro ao carregar:', error)
        setSales(0)
        setSummary({ income: 0, expenses: 0, profit: 0 })
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [currentTenant])

  if (!currentTenant) return null

  const profit = summary?.profit ?? 0
  const isProfit = profit >= 0

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-2',
        'bg-gradient-to-br from-primary/5 via-card to-primary/10 dark:from-primary/10 dark:to-primary/5'
      )}
    >
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
      <CardHeader className="pb-2 relative z-10">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sun className="h-5 w-5 text-primary" />
          Resumo do dia
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Como foi seu dia hoje: faturamento e lucro
        </p>
      </CardHeader>
      <CardContent className="relative z-10">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="h-16 rounded-lg bg-muted animate-pulse" />
            <div className="h-16 rounded-lg bg-muted animate-pulse" />
          </div>
        ) : financialLocked ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Faturamento hoje</p>
                <p className="text-xl font-bold text-muted-foreground/70">R$ •••••••</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border">
              <div className="p-2 rounded-lg bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Lucro hoje</p>
                <p className="text-xl font-bold text-muted-foreground/70">R$ •••••••</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Faturamento hoje</p>
                <p className="text-xl font-bold">{formatCurrency(sales ?? 0)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border">
              <div className={cn(
                'p-2 rounded-lg',
                isProfit ? 'bg-green-500/10' : 'bg-red-500/10'
              )}>
                <DollarSign className={cn(
                  'h-5 w-5',
                  isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  {isProfit ? 'Lucro hoje' : 'Prejuízo hoje'}
                </p>
                <p className={cn(
                  'text-xl font-bold',
                  isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )}>
                  {formatCurrency(Math.abs(profit))}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
