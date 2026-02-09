import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, DollarSign, Eye, EyeOff } from 'lucide-react'
import { useTenantStore } from '@/stores/tenantStore'
import { getFinancialSummary } from '@/lib/api/dashboard'
import { useDashboardFinancial } from '@/features/dashboard/context/DashboardFinancialContext'
import { useState, useEffect } from 'react'
import type { PeriodFilter } from './DashboardFilter'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

interface FinancialSummaryProps {
  period: PeriodFilter
  startDate?: Date
  endDate?: Date
}

export function FinancialSummary({ period, startDate, endDate }: FinancialSummaryProps) {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const financial = useDashboardFinancial()
  const hasPassword = financial?.hasPassword ?? null
  const unlocked = financial?.unlocked ?? false
  const setUnlocked = financial?.setUnlocked ?? (() => {})
  const openSetModal = financial?.openSetModal ?? (() => {})
  const openVerifyModal = financial?.openVerifyModal ?? (() => {})
  const [summary, setSummary] = useState<{ income: number; expenses: number; profit: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadSummary = async () => {
      if (!currentTenant) {
        setSummary(null)
        setIsLoading(false)
        return
      }
      try {
        setIsLoading(true)
        const data = await getFinancialSummary(currentTenant.id, period, startDate, endDate)
        setSummary(data)
      } catch (error) {
        console.error('[FinancialSummary] Erro ao carregar resumo:', error)
        setSummary({ income: 0, expenses: 0, profit: 0 })
      } finally {
        setIsLoading(false)
      }
    }
    loadSummary()
  }, [currentTenant, period, startDate, endDate])

  const handleEyeClick = () => {
    if (hasPassword === null) return
    if (unlocked) {
      setUnlocked(false)
      return
    }
    if (!hasPassword) {
      openSetModal()
      return
    }
    openVerifyModal()
  }

  if (!currentTenant || !summary) {
    return null
  }

  const isProfit = summary.profit >= 0
  const showContent = hasPassword === false || unlocked

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Resumo Financeiro
              </CardTitle>
              <CardDescription>
                Entradas, saídas e resultado
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleEyeClick}
              title={unlocked ? 'Ocultar valores' : hasPassword ? 'Digite a senha para visualizar' : 'Definir senha para proteger'}
              className="shrink-0"
            >
              {unlocked ? (
                <EyeOff className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Eye className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando dados...
            </div>
          ) : showContent ? (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                <div>
                  <div className="text-sm font-medium text-green-700 dark:text-green-400">Entradas</div>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {formatCurrency(summary.income)}
                  </div>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                <div>
                  <div className="text-sm font-medium text-red-700 dark:text-red-400">Saídas</div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {formatCurrency(summary.expenses)}
                  </div>
                </div>
                <TrendingDown className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <div
                className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                  isProfit
                    ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                }`}
              >
                <div>
                  <div
                    className={`text-sm font-medium ${
                      isProfit ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {isProfit ? 'Lucro' : 'Prejuízo'}
                  </div>
                  <div
                    className={`text-3xl font-bold ${
                      isProfit ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {formatCurrency(Math.abs(summary.profit))}
                  </div>
                </div>
                {isProfit ? (
                  <TrendingUp className="h-10 w-10 text-green-600 dark:text-green-400" />
                ) : (
                  <TrendingDown className="h-10 w-10 text-red-600 dark:text-red-400" />
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8 space-y-2">
              <p className="text-muted-foreground text-sm">
                Este resumo está protegido por senha.
              </p>
              <p className="text-muted-foreground text-sm">
                Clique no ícone do olho acima e {hasPassword ? 'digite a senha' : 'defina uma senha'} para visualizar.
              </p>
              <div className="flex justify-center gap-4 pt-2 text-2xl font-bold text-muted-foreground/50">
                <span>R$ •••••••</span>
                <span>R$ •••••••</span>
                <span>R$ •••••••</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
