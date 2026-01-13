import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from 'lucide-react'
import { format } from 'date-fns'

export type PeriodFilter = 'today' | 'week' | 'month' | 'year' | 'custom'

export interface DashboardFilterProps {
  period: PeriodFilter
  startDate?: Date
  endDate?: Date
  onPeriodChange: (period: PeriodFilter) => void
  onDateRangeChange?: (startDate: Date | undefined, endDate: Date | undefined) => void
}

export function DashboardFilter({
  period,
  startDate,
  endDate,
  onPeriodChange,
  onDateRangeChange,
}: DashboardFilterProps) {
  const [localStartDate, setLocalStartDate] = useState(
    startDate ? format(startDate, 'yyyy-MM-dd') : ''
  )
  const [localEndDate, setLocalEndDate] = useState(
    endDate ? format(endDate, 'yyyy-MM-dd') : ''
  )

  const handleStartDateChange = (value: string) => {
    setLocalStartDate(value)
    const date = value ? new Date(value) : undefined
    onDateRangeChange?.(date, endDate)
  }

  const handleEndDateChange = (value: string) => {
    setLocalEndDate(value)
    const date = value ? new Date(value) : undefined
    onDateRangeChange?.(startDate, date)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Label htmlFor="period" className="text-sm font-medium">
          Período:
        </Label>
      </div>
      
      <Select value={period} onValueChange={(value: PeriodFilter) => onPeriodChange(value)}>
        <SelectTrigger id="period" className="w-[180px]">
          <SelectValue placeholder="Selecione o período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Hoje</SelectItem>
          <SelectItem value="week">Esta Semana</SelectItem>
          <SelectItem value="month">Este Mês</SelectItem>
          <SelectItem value="year">Este Ano</SelectItem>
          <SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent>
      </Select>

      {period === 'custom' && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="startDate" className="text-sm text-muted-foreground">
              De:
            </Label>
            <Input
              id="startDate"
              type="date"
              value={localStartDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="endDate" className="text-sm text-muted-foreground">
              Até:
            </Label>
            <Input
              id="endDate"
              type="date"
              value={localEndDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="w-[150px]"
            />
          </div>
        </div>
      )}
    </div>
  )
}

