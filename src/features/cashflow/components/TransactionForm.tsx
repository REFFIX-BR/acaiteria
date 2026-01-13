import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData } from '@/lib/storage/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Plus } from 'lucide-react'
import { transactionCategories } from '../types'
import type { Transaction } from '@/types'

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Categoria é obrigatória'),
  amount: z.number().positive('Valor deve ser maior que zero'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  date: z.string(),
})

type TransactionFormData = z.infer<typeof transactionSchema>

interface TransactionFormProps {
  onSuccess?: () => void
}

export function TransactionForm({ onSuccess }: TransactionFormProps) {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('income')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'income',
      date: new Date().toISOString().split('T')[0],
    },
  })

  const selectedType = watch('type')

  const onSubmit = async (data: TransactionFormData) => {
    if (!currentTenant) {
      toast({
        title: 'Erro',
        description: 'Tenant não encontrado',
        variant: 'destructive',
      })
      return
    }

    try {
      const transactions = getTenantData<Transaction[]>(currentTenant.id, 'transactions') || []
      
      const newTransaction: Transaction = {
        id: `transaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: data.type,
        category: data.category,
        amount: data.amount,
        description: data.description,
        date: new Date(data.date),
        createdAt: new Date(),
      }

      transactions.push(newTransaction)
      setTenantData(currentTenant.id, 'transactions', transactions)

      toast({
        title: 'Sucesso',
        description: 'Transação cadastrada com sucesso',
      })

      reset()
      setOpen(false)
      onSuccess?.()
    } catch (error) {
      console.error('Erro ao salvar transação:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao salvar transação',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova Transação
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Transação</DialogTitle>
          <DialogDescription>
            Adicione uma entrada ou saída financeira
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select
              value={selectedType}
              onValueChange={(value: 'income' | 'expense') => {
                setValue('type', value)
                setTransactionType(value)
                setValue('category', '')
              }}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Entrada</SelectItem>
                <SelectItem value="expense">Saída</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" {...register('type')} />
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select
              onValueChange={(value) => setValue('category', value)}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {transactionCategories[selectedType].map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" {...register('category')} />
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register('amount', { valueAsNumber: true })}
            />
            {errors.amount && (
              <p className="text-sm text-destructive">{errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Descreva a transação"
              {...register('description')}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              {...register('date')}
            />
            {errors.date && (
              <p className="text-sm text-destructive">{errors.date.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

