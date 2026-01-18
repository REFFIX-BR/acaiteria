import { getApiUrl } from './config'
import { getAuthToken } from './auth'
import type { PeriodFilter } from '@/features/dashboard/components/DashboardFilter'

/**
 * Calcula vendas do período e faturamento total
 */
export async function getKPIs(
  period: PeriodFilter,
  startDate?: Date,
  endDate?: Date
): Promise<{ periodSales: number; totalRevenue: number }> {
  try {
    const apiUrl = getApiUrl()
    const token = getAuthToken()

    if (!token) {
      return { periodSales: 0, totalRevenue: 0 }
    }

    const params = new URLSearchParams({
      period,
    })

    if (startDate) {
      params.append('startDate', startDate.toISOString())
    }
    if (endDate) {
      params.append('endDate', endDate.toISOString())
    }

    const response = await fetch(`${apiUrl}/api/dashboard/kpis?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      console.error('[Dashboard API] Erro ao buscar KPIs:', response.status)
      return { periodSales: 0, totalRevenue: 0 }
    }

    const data = await response.json()
    return {
      periodSales: parseFloat(data.periodSales || '0'),
      totalRevenue: parseFloat(data.totalRevenue || '0'),
    }
  } catch (error) {
    console.error('[Dashboard API] Erro ao buscar KPIs:', error)
    return { periodSales: 0, totalRevenue: 0 }
  }
}

/**
 * Calcula vendas do dia
 */
export async function getTodaySales(): Promise<number> {
  const kpis = await getKPIs('today')
  return kpis.periodSales
}

/**
 * Calcula vendas da semana
 */
export async function getWeekSales(): Promise<number> {
  const kpis = await getKPIs('week')
  return kpis.periodSales
}

/**
 * Calcula vendas do mês
 */
export async function getMonthSales(): Promise<number> {
  const kpis = await getKPIs('month')
  return kpis.periodSales
}

/**
 * Calcula faturamento total
 */
export async function getTotalRevenue(): Promise<number> {
  const kpis = await getKPIs('month') // Usa qualquer período, só precisa do totalRevenue
  return kpis.totalRevenue
}

/**
 * Calcula vendas para um período específico
 */
export async function getSalesByPeriod(
  tenantId: string,
  period: PeriodFilter,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  const kpis = await getKPIs(period, startDate, endDate)
  return kpis.periodSales
}

/**
 * Obtém produtos com estoque baixo
 */
export async function getLowStockProducts() {
  try {
    const apiUrl = getApiUrl()
    const token = getAuthToken()

    if (!token) {
      return []
    }

    const response = await fetch(`${apiUrl}/api/dashboard/low-stock`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      console.error('[Dashboard API] Erro ao buscar produtos com estoque baixo:', response.status)
      return []
    }

    const data = await response.json()
    return data.products || []
  } catch (error) {
    console.error('[Dashboard API] Erro ao buscar produtos com estoque baixo:', error)
    return []
  }
}

/**
 * Calcula resumo financeiro (entradas vs saídas)
 */
export async function getFinancialSummary(
  tenantId: string,
  period?: PeriodFilter,
  startDate?: Date,
  endDate?: Date
) {
  try {
    const apiUrl = getApiUrl()
    const token = getAuthToken()

    if (!token) {
      return { income: 0, expenses: 0, profit: 0 }
    }

    const params = new URLSearchParams()
    if (startDate) {
      params.append('startDate', startDate.toISOString())
    }
    if (endDate) {
      params.append('endDate', endDate.toISOString())
    }

    const response = await fetch(`${apiUrl}/api/dashboard/financial-summary?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      console.error('[Dashboard API] Erro ao buscar resumo financeiro:', response.status)
      return { income: 0, expenses: 0, profit: 0 }
    }

    const data = await response.json()
    return data.summary || { income: 0, expenses: 0, profit: 0 }
  } catch (error) {
    console.error('[Dashboard API] Erro ao buscar resumo financeiro:', error)
    return { income: 0, expenses: 0, profit: 0 }
  }
}

/**
 * Obtém dados para gráfico de vendas
 */
export async function getSalesChartData(
  tenantId: string,
  period?: PeriodFilter,
  startDate?: Date,
  endDate?: Date
) {
  try {
    const apiUrl = getApiUrl()
    const token = getAuthToken()

    if (!token) {
      return []
    }

    const params = new URLSearchParams()
    if (startDate) {
      params.append('startDate', startDate.toISOString())
    }
    if (endDate) {
      params.append('endDate', endDate.toISOString())
    }

    const response = await fetch(`${apiUrl}/api/dashboard/sales-chart?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      console.error('[Dashboard API] Erro ao buscar dados do gráfico:', response.status)
      return []
    }

    const data = await response.json()
    return (data.chart || []).map((item: any) => ({
      date: item.date,
      sales: parseFloat(item.sales || '0'),
    }))
  } catch (error) {
    console.error('[Dashboard API] Erro ao buscar dados do gráfico:', error)
    return []
  }
}

/**
 * Obtém produtos mais vendidos (baseado em pedidos entregues)
 */
export async function getTopProducts(tenantId: string, limit: number = 5) {
  try {
    const apiUrl = getApiUrl()
    const token = getAuthToken()

    if (!token) {
      return []
    }

    const response = await fetch(`${apiUrl}/api/dashboard/top-products`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      console.error('[Dashboard API] Erro ao buscar produtos mais vendidos:', response.status)
      return []
    }

    const data = await response.json()
    return (data.products || [])
      .slice(0, limit)
      .map((item: any) => ({
        name: item.menu_item_name,
        sales: parseInt(item.total_quantity || '0'),
        revenue: parseFloat(item.total_revenue || '0'),
      }))
  } catch (error) {
    console.error('[Dashboard API] Erro ao buscar produtos mais vendidos:', error)
    return []
  }
}
