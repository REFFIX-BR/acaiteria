import { getTenantData } from '@/lib/storage/storage'
import { useTenantStore } from '@/stores/tenantStore'
import type { Transaction, Product, Order, MenuItem } from '@/types'
import { subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'
import type { PeriodFilter } from '@/features/dashboard/components/DashboardFilter'

/**
 * Calcula vendas do dia
 */
export function getTodaySales(tenantId: string): number {
  const transactions = getTenantData<Transaction[]>(tenantId, 'transactions') || []
  const orders = getTenantData<Order[]>(tenantId, 'orders') || []
  const today = new Date()
  const todayStart = startOfDay(today)
  const todayEnd = endOfDay(today)

  // Vendas de transações
  const transactionsTotal = transactions
    .filter(
      (t) =>
        t.type === 'income' &&
        new Date(t.date) >= todayStart &&
        new Date(t.date) <= todayEnd
    )
    .reduce((sum, t) => sum + t.amount, 0)

  // Vendas de pedidos entregues (data de entrega no dia de hoje)
  const ordersTotal = orders
    .filter((o) => {
      if (o.status !== 'delivered' || !o.deliveredAt) return false
      const deliveredDate = o.deliveredAt instanceof Date ? o.deliveredAt : new Date(o.deliveredAt)
      return deliveredDate >= todayStart && deliveredDate <= todayEnd
    })
    .reduce((sum, o) => sum + o.total, 0)

  return transactionsTotal + ordersTotal
}

/**
 * Calcula vendas da semana
 */
export function getWeekSales(tenantId: string): number {
  const transactions = getTenantData<Transaction[]>(tenantId, 'transactions') || []
  const orders = getTenantData<Order[]>(tenantId, 'orders') || []
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })

  // Vendas de transações
  const transactionsTotal = transactions
    .filter(
      (t) =>
        t.type === 'income' &&
        new Date(t.date) >= weekStart &&
        new Date(t.date) <= weekEnd
    )
    .reduce((sum, t) => sum + t.amount, 0)

  // Vendas de pedidos entregues na semana
  const ordersTotal = orders
    .filter((o) => {
      if (o.status !== 'delivered' || !o.deliveredAt) return false
      const deliveredDate = o.deliveredAt instanceof Date ? o.deliveredAt : new Date(o.deliveredAt)
      return deliveredDate >= weekStart && deliveredDate <= weekEnd
    })
    .reduce((sum, o) => sum + o.total, 0)

  return transactionsTotal + ordersTotal
}

/**
 * Calcula vendas do mês
 */
export function getMonthSales(tenantId: string): number {
  const transactions = getTenantData<Transaction[]>(tenantId, 'transactions') || []
  const orders = getTenantData<Order[]>(tenantId, 'orders') || []
  const monthStart = startOfMonth(new Date())
  const monthEnd = endOfMonth(new Date())

  // Vendas de transações
  const transactionsTotal = transactions
    .filter(
      (t) =>
        t.type === 'income' &&
        new Date(t.date) >= monthStart &&
        new Date(t.date) <= monthEnd
    )
    .reduce((sum, t) => sum + t.amount, 0)

  // Vendas de pedidos entregues no mês
  const ordersTotal = orders
    .filter((o) => {
      if (o.status !== 'delivered' || !o.deliveredAt) return false
      const deliveredDate = o.deliveredAt instanceof Date ? o.deliveredAt : new Date(o.deliveredAt)
      return deliveredDate >= monthStart && deliveredDate <= monthEnd
    })
    .reduce((sum, o) => sum + o.total, 0)

  return transactionsTotal + ordersTotal
}

/**
 * Calcula faturamento total
 */
export function getTotalRevenue(tenantId: string): number {
  const transactions = getTenantData<Transaction[]>(tenantId, 'transactions') || []
  const orders = getTenantData<Order[]>(tenantId, 'orders') || []

  // Vendas de transações
  const transactionsTotal = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  // Vendas de pedidos entregues
  const ordersTotal = orders
    .filter((o) => o.status === 'delivered')
    .reduce((sum, o) => sum + o.total, 0)

  return transactionsTotal + ordersTotal
}

/**
 * Calcula vendas para um período específico
 */
export function getSalesByPeriod(
  tenantId: string,
  period: PeriodFilter,
  startDate?: Date,
  endDate?: Date
): number {
  const transactions = getTenantData<Transaction[]>(tenantId, 'transactions') || []
  const orders = getTenantData<Order[]>(tenantId, 'orders') || []
  
  let periodStart: Date
  let periodEnd: Date

  if (period === 'custom' && startDate && endDate) {
    periodStart = startOfDay(startDate)
    periodEnd = endOfDay(endDate)
  } else {
    const now = new Date()
    switch (period) {
      case 'today':
        periodStart = startOfDay(now)
        periodEnd = endOfDay(now)
        break
      case 'week':
        periodStart = startOfWeek(now, { weekStartsOn: 1 })
        periodEnd = endOfWeek(now, { weekStartsOn: 1 })
        break
      case 'month':
        periodStart = startOfMonth(now)
        periodEnd = endOfMonth(now)
        break
      case 'year':
        periodStart = startOfYear(now)
        periodEnd = endOfYear(now)
        break
      default:
        periodStart = startOfMonth(now)
        periodEnd = endOfMonth(now)
    }
  }

  // Vendas de transações
  const transactionsTotal = transactions
    .filter(
      (t) =>
        t.type === 'income' &&
        new Date(t.date) >= periodStart &&
        new Date(t.date) <= periodEnd
    )
    .reduce((sum, t) => sum + t.amount, 0)

  // Vendas de pedidos entregues
  const ordersTotal = orders
    .filter((o) => {
      if (o.status !== 'delivered' || !o.deliveredAt) return false
      const deliveredDate = o.deliveredAt instanceof Date ? o.deliveredAt : new Date(o.deliveredAt)
      return deliveredDate >= periodStart && deliveredDate <= periodEnd
    })
    .reduce((sum, o) => sum + o.total, 0)

  return transactionsTotal + ordersTotal
}

/**
 * Obtém produtos com estoque baixo
 */
export function getLowStockProducts(tenantId: string): Product[] {
  const products = getTenantData<Product[]>(tenantId, 'products') || []
  return products.filter((p) => p.currentStock <= p.minStock)
}

/**
 * Calcula resumo financeiro (entradas vs saídas)
 */
export function getFinancialSummary(
  tenantId: string,
  period?: PeriodFilter,
  startDate?: Date,
  endDate?: Date
) {
  const transactions = getTenantData<Transaction[]>(tenantId, 'transactions') || []
  const orders = getTenantData<Order[]>(tenantId, 'orders') || []
  
  let periodStart: Date | undefined
  let periodEnd: Date | undefined

  if (period && period !== 'custom') {
    const now = new Date()
    switch (period) {
      case 'today':
        periodStart = startOfDay(now)
        periodEnd = endOfDay(now)
        break
      case 'week':
        periodStart = startOfWeek(now, { weekStartsOn: 1 })
        periodEnd = endOfWeek(now, { weekStartsOn: 1 })
        break
      case 'month':
        periodStart = startOfMonth(now)
        periodEnd = endOfMonth(now)
        break
      case 'year':
        periodStart = startOfYear(now)
        periodEnd = endOfYear(now)
        break
    }
  } else if (period === 'custom' && startDate && endDate) {
    periodStart = startOfDay(startDate)
    periodEnd = endOfDay(endDate)
  }
  
  // Entradas de transações
  let transactionsIncome = transactions
    .filter((t) => t.type === 'income')
  
  if (periodStart && periodEnd) {
    transactionsIncome = transactionsIncome.filter(
      (t) => new Date(t.date) >= periodStart! && new Date(t.date) <= periodEnd!
    )
  }
  
  const transactionsIncomeTotal = transactionsIncome.reduce((sum, t) => sum + t.amount, 0)

  // Entradas de pedidos entregues
  let ordersIncome = orders.filter((o) => o.status === 'delivered')
  
  if (periodStart && periodEnd) {
    ordersIncome = ordersIncome.filter((o) => {
      if (!o.deliveredAt) return false
      const deliveredDate = o.deliveredAt instanceof Date ? o.deliveredAt : new Date(o.deliveredAt)
      return deliveredDate >= periodStart! && deliveredDate <= periodEnd!
    })
  }
  
  const ordersIncomeTotal = ordersIncome.reduce((sum, o) => sum + o.total, 0)

  const income = transactionsIncomeTotal + ordersIncomeTotal

  // Saídas (despesas)
  let expensesTransactions = transactions.filter((t) => t.type === 'expense')
  
  if (periodStart && periodEnd) {
    expensesTransactions = expensesTransactions.filter(
      (t) => new Date(t.date) >= periodStart! && new Date(t.date) <= periodEnd!
    )
  }
  
  const expenses = expensesTransactions.reduce((sum, t) => sum + t.amount, 0)

  return {
    income,
    expenses,
    profit: income - expenses,
  }
}

/**
 * Obtém dados para gráfico de vendas
 */
export function getSalesChartData(
  tenantId: string,
  period?: PeriodFilter,
  startDate?: Date,
  endDate?: Date
) {
  const transactions = getTenantData<Transaction[]>(tenantId, 'transactions') || []
  const orders = getTenantData<Order[]>(tenantId, 'orders') || []
  const data: { date: string; sales: number }[] = []
  
  let periodStart: Date
  let periodEnd: Date
  let daysToShow = 30

  if (period === 'custom' && startDate && endDate) {
    periodStart = startOfDay(startDate)
    periodEnd = endOfDay(endDate)
    daysToShow = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  } else {
    const now = new Date()
    switch (period) {
      case 'today':
        periodStart = startOfDay(now)
        periodEnd = endOfDay(now)
        daysToShow = 1
        break
      case 'week':
        periodStart = startOfWeek(now, { weekStartsOn: 1 })
        periodEnd = endOfWeek(now, { weekStartsOn: 1 })
        daysToShow = 7
        break
      case 'month':
        periodStart = startOfMonth(now)
        periodEnd = endOfMonth(now)
        daysToShow = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
        break
      case 'year':
        periodStart = startOfYear(now)
        periodEnd = endOfYear(now)
        daysToShow = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
        break
      default:
        // Padrão: últimos 30 dias
        periodStart = startOfDay(subDays(now, 29))
        periodEnd = endOfDay(now)
        daysToShow = 30
    }
  }
  
  for (let i = 0; i < daysToShow; i++) {
    const date = new Date(periodStart)
    date.setDate(date.getDate() + i)
    const dayStart = startOfDay(date)
    const dayEnd = endOfDay(date)
    
    // Vendas de transações do dia
    const transactionsDaySales = transactions
      .filter(
        (t) =>
          t.type === 'income' &&
          new Date(t.date) >= dayStart &&
          new Date(t.date) <= dayEnd
      )
      .reduce((sum, t) => sum + t.amount, 0)

    // Vendas de pedidos entregues no dia
    const ordersDaySales = orders
      .filter((o) => {
        if (o.status !== 'delivered' || !o.deliveredAt) return false
        const deliveredDate = o.deliveredAt instanceof Date ? o.deliveredAt : new Date(o.deliveredAt)
        return deliveredDate >= dayStart && deliveredDate <= dayEnd
      })
      .reduce((sum, o) => sum + o.total, 0)

    data.push({
      date: date.toISOString().split('T')[0],
      sales: transactionsDaySales + ordersDaySales,
    })
  }

  return data
}

/**
 * Obtém produtos mais vendidos (baseado em pedidos entregues)
 */
export function getTopProducts(tenantId: string, limit: number = 5) {
  const orders = getTenantData<Order[]>(tenantId, 'orders') || []
  const menuItems = getTenantData<MenuItem[]>(tenantId, 'menu') || []
  
  // Conta vendas por produto baseado nos pedidos entregues
  const productSales = new Map<string, { name: string; sales: number; revenue: number }>()
  
  // Filtra apenas pedidos entregues
  const deliveredOrders = orders.filter((o) => o.status === 'delivered')
  
  deliveredOrders.forEach((order) => {
    order.items.forEach((item) => {
      // Usa menuItemId para identificar o produto
      const productId = item.menuItemId
      
      // Busca o nome do produto no menu ou usa o nome do item
      let productName = item.menuItemName
      const menuItem = menuItems.find((m) => m.id === item.menuItemId)
      if (menuItem) {
        productName = menuItem.name
      }
      
      const existing = productSales.get(productId) || {
        name: productName,
        sales: 0,
        revenue: 0,
      }
      
      productSales.set(productId, {
        name: productName,
        sales: existing.sales + item.quantity,
        revenue: existing.revenue + item.totalPrice,
      })
    })
  })
  
  return Array.from(productSales.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

