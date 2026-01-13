import { useState } from 'react'
import { TransactionForm } from './components/TransactionForm'
import { TransactionList } from './components/TransactionList'
import { CashflowChart } from './components/CashflowChart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData } from '@/lib/storage/storage'
import { useMemo, useEffect } from 'react'
import type { Transaction, Order } from '@/types'
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export default function CashflowPage() {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Sincroniza pedidos entregues com transações de entrada
  useEffect(() => {
    if (!currentTenant) return

    const orders = getTenantData<Order[]>(currentTenant.id, 'orders') || []
    const transactions = getTenantData<Transaction[]>(currentTenant.id, 'transactions') || []
    
    // Encontra pedidos entregues que ainda não têm transação
    const deliveredOrders = orders.filter((order) => order.status === 'delivered')
    const newTransactions: Transaction[] = []

    deliveredOrders.forEach((order) => {
      // Verifica se já existe uma transação para este pedido
      const existingTransaction = transactions.find(
        (t) => t.type === 'income' && t.description.includes(`Pedido #${order.id}`)
      )

      if (!existingTransaction) {
        const newTransaction: Transaction = {
          id: `transaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'income',
          category: 'Vendas',
          amount: order.total,
          description: `Pedido #${order.id} - ${order.customerName}${order.deliveryType === 'delivery' ? ' (Entrega)' : ' (Retirada)'}`,
          date: order.deliveredAt || order.updatedAt || order.createdAt,
          createdAt: new Date(),
        }
        newTransactions.push(newTransaction)
      }
    })

    // Adiciona novas transações se houver
    if (newTransactions.length > 0) {
      const updatedTransactions = [...transactions, ...newTransactions]
      setTenantData(currentTenant.id, 'transactions', updatedTransactions)
      setRefreshTrigger((prev) => prev + 1)
    }
  }, [currentTenant])

  const summary = useMemo(() => {
    if (!currentTenant) return null
    
    const transactions = getTenantData<Transaction[]>(currentTenant.id, 'transactions') || []
    
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)

    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)

    return {
      income,
      expenses,
      profit: income - expenses,
    }
  }, [currentTenant, refreshTrigger])

  const handleTransactionSuccess = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fluxo de Caixa</h1>
          <p className="text-muted-foreground">
            Controle de entradas e saídas
          </p>
        </div>
        <TransactionForm onSuccess={handleTransactionSuccess} />
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Entradas</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.income)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Saídas</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(summary.expenses)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {summary.profit >= 0 ? 'Lucro' : 'Prejuízo'}
              </CardTitle>
              <DollarSign className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  summary.profit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(Math.abs(summary.profit))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      <CashflowChart refreshTrigger={refreshTrigger} />

      {/* Transactions List */}
      <TransactionList 
        refreshTrigger={refreshTrigger} 
        onDelete={handleTransactionSuccess}
      />
    </div>
  )
}
