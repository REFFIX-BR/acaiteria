import { useState, useMemo } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData } from '@/lib/storage/storage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { format } from 'date-fns'
import type { Transaction } from '@/types'
import { transactionCategories } from '../types'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { useDebounce } from '@/hooks/use-debounce'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

interface TransactionListProps {
  refreshTrigger?: number
  onDelete?: () => void
}

export function TransactionList({ refreshTrigger, onDelete }: TransactionListProps) {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // Debounce na busca
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const transactions = useMemo(() => {
    if (!currentTenant) return []
    
    let filtered = getTenantData<Transaction[]>(currentTenant.id, 'transactions') || []

    // Aplica filtros
    if (typeFilter !== 'all') {
      filtered = filtered.filter((t) => t.type === typeFilter)
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((t) => t.category === categoryFilter)
    }

    if (debouncedSearchTerm) {
      filtered = filtered.filter((t) =>
        t.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      )
    }

    if (startDate) {
      filtered = filtered.filter((t) => new Date(t.date) >= new Date(startDate))
    }

    if (endDate) {
      filtered = filtered.filter((t) => new Date(t.date) <= new Date(endDate))
    }

    // Ordena por data (mais recente primeiro)
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [currentTenant, typeFilter, categoryFilter, debouncedSearchTerm, startDate, endDate, refreshTrigger])

  const handleDelete = (id: string) => {
    if (!currentTenant) return

    confirm(
      'Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.',
      () => {
        try {
          const allTransactions = getTenantData<Transaction[]>(currentTenant.id, 'transactions') || []
          const updated = allTransactions.filter((t) => t.id !== id)
          setTenantData(currentTenant.id, 'transactions', updated)
          
          // Notifica o componente pai para atualizar
          onDelete?.()
          
          toast({
            title: 'Sucesso',
            description: 'Transação excluída com sucesso',
          })
        } catch (error) {
          console.error('Erro ao excluir transação:', error)
          toast({
            title: 'Erro',
            description: 'Erro ao excluir transação',
            variant: 'destructive',
          })
        }
      },
      {
        title: 'Excluir transação',
        variant: 'destructive',
        confirmText: 'Excluir',
      }
    )
  }

  if (!currentTenant) {
    return null
  }

  // Remove categorias duplicadas usando Set
  const allCategories = Array.from(new Set([
    ...transactionCategories.income,
    ...transactionCategories.expense,
  ]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Transações</CardTitle>
        <CardDescription>
          Visualize e gerencie todas as transações financeiras
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="income">Entradas</SelectItem>
              <SelectItem value="expense">Saídas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {allCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            placeholder="Data inicial"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            type="date"
            placeholder="Data final"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Tabela */}
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma transação encontrada
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {format(new Date(transaction.date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      {transaction.type === 'income' ? (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                          <ArrowUpCircle className="h-4 w-4" />
                          Entrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                          <ArrowDownCircle className="h-4 w-4" />
                          Saída
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{transaction.category}</TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        transaction.type === 'income'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(transaction.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {ConfirmDialogComponent}
    </Card>
  )
}

