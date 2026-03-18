import { useMemo, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTenantStore } from '@/stores/tenantStore'
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
import { Switch } from '@/components/ui/switch'
import { transactionCategories } from '../types'
import type { Transaction } from '@/types'

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Categoria é obrigatória'),
  amount: z.number().positive('Valor deve ser maior que zero'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  date: z.string(),
  time: z.string().min(1, 'Horário é obrigatório'),
  isItemSale: z.boolean().default(false),
  itemCategory: z.string().optional(),
  itemName: z.string().optional(),
  itemQuantity: z.number().int().positive().optional(),
})

type TransactionFormData = z.infer<typeof transactionSchema>

interface TransactionFormProps {
  onSuccess?: () => void
}

export function TransactionForm({ onSuccess }: TransactionFormProps) {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [menuItems, setMenuItems] = useState<Array<{ id: string; name: string; category: string }>>([])

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
      date: [new Date().getFullYear(), String(new Date().getMonth() + 1).padStart(2, '0'), String(new Date().getDate()).padStart(2, '0')].join('-'),
      time: new Date().toTimeString().slice(0, 5),
      isItemSale: false,
      itemQuantity: 1,
    },
  })

  const selectedType = watch('type')
  const isItemSale = watch('isItemSale')
  const selectedItemCategory = watch('itemCategory')

  const itemCategories = useMemo(
    () => Array.from(new Set(menuItems.map((i) => i.category))).sort((a, b) => a.localeCompare(b)),
    [menuItems]
  )
  const itemsByCategory = useMemo(
    () => menuItems.filter((i) => i.category === selectedItemCategory),
    [menuItems, selectedItemCategory]
  )

  useEffect(() => {
    if (!open || !currentTenant) return
    const loadMenuItems = async () => {
      try {
        const { getApiUrl } = await import('@/lib/api/config')
        const { getAuthToken } = await import('@/lib/api/auth')
        const apiUrl = getApiUrl()
        const token = getAuthToken()
        if (!token) return

        const response = await fetch(`${apiUrl}/api/menu/items`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (!response.ok) return
        const data = await response.json()
        const normalized = (data.items || []).map((item: any) => ({
          id: String(item.id),
          name: String(item.name || ''),
          category: String(item.category || 'Sem categoria'),
        }))
        setMenuItems(normalized)
      } catch (error) {
        console.error('[TransactionForm] Erro ao carregar itens do cardápio:', error)
      }
    }
    loadMenuItems()
  }, [open, currentTenant])

  const onSubmit = async (data: TransactionFormData) => {
    if (!currentTenant) {
      toast({
        title: 'Erro',
        description: 'Tenant não encontrado',
        variant: 'destructive',
      })
      return
    }

    if (data.isItemSale && (!data.itemCategory || !data.itemName || !data.itemQuantity)) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Para item vendido, preencha categoria do item, item e quantidade.',
        variant: 'destructive',
      })
      return
    }

    try {
      const { getApiUrl } = await import('@/lib/api/config')
      const { getAuthToken } = await import('@/lib/api/auth')
      const apiUrl = getApiUrl()
      const token = getAuthToken()

      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      // Criar transação no backend
      const response = await fetch(`${apiUrl}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: data.type,
          category: data.category,
          amount: data.amount,
          description: data.description,
          date: data.date,
          time: data.time,
          itemCategory: data.isItemSale ? data.itemCategory : undefined,
          itemName: data.isItemSale ? data.itemName : undefined,
          itemQuantity: data.isItemSale ? data.itemQuantity : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro ao criar transação')
      }

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
        description: error instanceof Error ? error.message : 'Erro ao salvar transação',
        variant: 'destructive',
      })
    }
  }

  const setDefaultsWhenOpen = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      const now = new Date()
      setValue('date', [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-'))
      setValue('time', now.toTimeString().slice(0, 5))
      setValue('isItemSale', false)
      setValue('itemCategory', undefined)
      setValue('itemName', undefined)
      setValue('itemQuantity', 1)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setDefaultsWhenOpen}>
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

          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="isItemSale">Cadastrar item vendido</Label>
                <p className="text-xs text-muted-foreground">
                  Marque para informar categoria, item e quantidade vendida.
                </p>
              </div>
              <Switch
                id="isItemSale"
                checked={!!isItemSale}
                onCheckedChange={(checked) => {
                  setValue('isItemSale', checked)
                  if (!checked) {
                    setValue('itemCategory', undefined)
                    setValue('itemName', undefined)
                    setValue('itemQuantity', 1)
                  }
                }}
              />
              <input type="hidden" {...register('isItemSale')} />
            </div>

            {isItemSale && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="itemCategory">Categoria do item</Label>
                    <Select
                      onValueChange={(value) => {
                        setValue('itemCategory', value)
                        setValue('itemName', undefined)
                      }}
                    >
                      <SelectTrigger id="itemCategory">
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {itemCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input type="hidden" {...register('itemCategory')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="itemName">Item</Label>
                    <Select
                      onValueChange={(value) => setValue('itemName', value)}
                    >
                      <SelectTrigger id="itemName">
                        <SelectValue placeholder="Selecione o item" />
                      </SelectTrigger>
                      <SelectContent>
                        {itemsByCategory.map((item) => (
                          <SelectItem key={item.id} value={item.name}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input type="hidden" {...register('itemName')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="itemQuantity">Quantidade vendida</Label>
                  <Input
                    id="itemQuantity"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="1"
                    {...register('itemQuantity', { valueAsNumber: true })}
                  />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="time">Horário</Label>
              <Input
                id="time"
                type="time"
                {...register('time')}
              />
              {errors.time && (
                <p className="text-sm text-destructive">{errors.time.message}</p>
              )}
            </div>
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

