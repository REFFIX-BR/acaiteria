import { useState } from 'react'
import { KPICards } from './components/KPICards'
import { SalesChart } from './components/SalesChart'
import { TopProducts } from './components/TopProducts'
import { FinancialSummary } from './components/FinancialSummary'
import { DashboardFilter, type PeriodFilter } from './components/DashboardFilter'
import { Sparkles, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'

export default function DashboardPage() {
  const [period, setPeriod] = useState<PeriodFilter>('month')
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)

  const handleDateRangeChange = (start: Date | undefined, end: Date | undefined) => {
    setStartDate(start)
    setEndDate(end)
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-card border p-8 shadow-lg">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-4xl font-bold">Dashboard</h1>
                <Sparkles className="h-6 w-6 text-yellow-500 animate-pulse" />
              </div>
              <p className="text-muted-foreground text-lg">
                Visão geral do seu negócio em tempo real
              </p>
            </div>
          </div>
          
          {/* Filtro de Período */}
          <Card className="p-4">
            <DashboardFilter
              period={period}
              startDate={startDate}
              endDate={endDate}
              onPeriodChange={setPeriod}
              onDateRangeChange={handleDateRangeChange}
            />
          </Card>
        </div>
      </div>

      {/* KPI Cards */}
      <KPICards period={period} startDate={startDate} endDate={endDate} />

      {/* Charts and Summary Row */}
      <div className="grid gap-6 md:grid-cols-2">
        <SalesChart period={period} startDate={startDate} endDate={endDate} />
        <FinancialSummary period={period} startDate={startDate} endDate={endDate} />
      </div>

      {/* Products Row */}
      <div className="grid gap-6 md:grid-cols-2">
        <TopProducts />
      </div>
    </div>
  )
}
