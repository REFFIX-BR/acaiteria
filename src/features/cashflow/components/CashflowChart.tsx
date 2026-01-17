import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useTenantStore } from '@/stores/tenantStore'
import { useMemo, useEffect, useState } from 'react'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import type { Transaction } from '@/types'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

interface CashflowChartProps {
  refreshTrigger?: number
}

export function CashflowChart({ refreshTrigger }: CashflowChartProps) {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const [transactions, setTransactions] = useState<Transaction[]>([])

  // Buscar transações do backend
  useEffect(() => {
    const loadTransactions = async () => {
      if (!currentTenant) {
        setTransactions([])
        return
      }

      try {
        const { getApiUrl } = await import('@/lib/api/config')
        const { getAuthToken } = await import('@/lib/api/auth')
        const apiUrl = getApiUrl()
        const token = getAuthToken()

        if (!token) {
          setTransactions([])
          return
        }

        const response = await fetch(`${apiUrl}/api/transactions`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          const normalizedTransactions = (data.transactions || []).map((t: any) => ({
            ...t,
            date: t.date ? new Date(t.date) : new Date(),
            createdAt: t.created_at ? new Date(t.created_at) : (t.createdAt ? new Date(t.createdAt) : new Date()),
          }))
          setTransactions(normalizedTransactions)
        } else {
          console.error('[CashflowChart] Erro ao buscar transações:', response.status)
          setTransactions([])
        }
      } catch (error) {
        console.error('[CashflowChart] Erro ao buscar transações:', error)
        setTransactions([])
      }
    }

    loadTransactions()
  }, [currentTenant, refreshTrigger])

  const data = useMemo(() => {
    if (!currentTenant || transactions.length === 0) return []
    
    const chartData: { date: string; Entradas: number; Saídas: number; Saldo: number }[] = []
    
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i)
      const dayStart = startOfDay(date)
      const dayEnd = endOfDay(date)
      
      const dayIncome = transactions
        .filter(
          (t) =>
            t.type === 'income' &&
            new Date(t.date) >= dayStart &&
            new Date(t.date) <= dayEnd
        )
        .reduce((sum, t) => sum + Number(t.amount), 0)

      const dayExpenses = transactions
        .filter(
          (t) =>
            t.type === 'expense' &&
            new Date(t.date) >= dayStart &&
            new Date(t.date) <= dayEnd
        )
        .reduce((sum, t) => sum + Number(t.amount), 0)

      chartData.push({
        date: format(date, 'dd/MM'),
        Entradas: dayIncome,
        Saídas: dayExpenses,
        Saldo: dayIncome - dayExpenses,
      })
    }

    return chartData
  }, [currentTenant, transactions])

  if (!currentTenant) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fluxo de Caixa (30 dias)</CardTitle>
        <CardDescription>
          Evolução de entradas, saídas e saldo
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 || data.every(d => d.Entradas === 0 && d.Saídas === 0) ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Nenhum dado disponível
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis
                tickFormatter={(value) => {
                  if (value >= 1000) {
                    return `R$ ${(value / 1000).toFixed(1)}k`
                  }
                  return `R$ ${value}`
                }}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelStyle={{ color: '#000' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="Entradas"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="Saídas"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="Saldo"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

