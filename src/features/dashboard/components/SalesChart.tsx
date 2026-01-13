import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useTenantStore } from '@/stores/tenantStore'
import { getSalesChartData } from '@/lib/api/dashboard'
import { useMemo } from 'react'
import { format } from 'date-fns'
import type { PeriodFilter } from './DashboardFilter'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

interface SalesChartProps {
  period: PeriodFilter
  startDate?: Date
  endDate?: Date
}

export function SalesChart({ period, startDate, endDate }: SalesChartProps) {
  const currentTenant = useTenantStore((state) => state.currentTenant)

  const data = useMemo(() => {
    if (!currentTenant) return []
    
    const rawData = getSalesChartData(currentTenant.id, period, startDate, endDate)
    return rawData.map((item) => ({
      date: format(new Date(item.date), 'dd/MM'),
      Vendas: item.sales,
    }))
  }, [currentTenant, period, startDate, endDate])

  const getChartTitle = () => {
    switch (period) {
      case 'today':
        return 'Vendas de Hoje'
      case 'week':
        return 'Vendas da Semana'
      case 'month':
        return 'Vendas do Mês'
      case 'year':
        return 'Vendas do Ano'
      case 'custom':
        return 'Vendas do Período'
      default:
        return 'Vendas dos Últimos 30 Dias'
    }
  }

  if (!currentTenant) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{getChartTitle()}</CardTitle>
        <CardDescription>
          Evolução do faturamento diário
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Nenhum dado de venda disponível
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
              <Line
                type="monotone"
                dataKey="Vendas"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

