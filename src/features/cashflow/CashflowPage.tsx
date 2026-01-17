import { useState, useMemo, useEffect } from 'react'
import { TransactionForm } from './components/TransactionForm'
import { TransactionList } from './components/TransactionList'
import { CashflowChart } from './components/CashflowChart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTenantStore } from '@/stores/tenantStore'
import type { Transaction } from '@/types'
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
          console.error('[CashflowPage] Erro ao buscar transações:', response.status)
          setTransactions([])
        }
      } catch (error) {
        console.error('[CashflowPage] Erro ao buscar transações:', error)
        setTransactions([])
      }
    }

    loadTransactions()
  }, [currentTenant, refreshTrigger])

  const summary = useMemo(() => {
    if (!currentTenant || transactions.length === 0) return null
    
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    return {
      income,
      expenses,
      profit: income - expenses,
    }
  }, [currentTenant, transactions])

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
