import { useState, useEffect } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Plus } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import type { Customer } from '@/types'

const customerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
})

type CustomerFormData = z.infer<typeof customerSchema>

export function LeadCapture() {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Buscar clientes do backend (sem usar localStorage)
  useEffect(() => {
    const loadCustomers = async () => {
      if (!currentTenant) {
        setCustomers([])
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const { getApiUrl } = await import('@/lib/api/config')
        const { getAuthToken } = await import('@/lib/api/auth')
        const apiUrl = getApiUrl()
        const token = getAuthToken()

        if (!token) {
          setCustomers([])
          setIsLoading(false)
          return
        }

        const response = await fetch(`${apiUrl}/api/customers`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          const normalizedCustomers = (data.customers || []).map((c: any) => ({
            ...c,
            createdAt: c.created_at ? new Date(c.created_at) : (c.createdAt ? new Date(c.createdAt) : new Date()),
          }))
          setCustomers(normalizedCustomers)
        } else {
          console.error('[LeadCapture] Erro ao buscar clientes:', response.status)
          setCustomers([])
        }
      } catch (error) {
        console.error('[LeadCapture] Erro ao buscar clientes:', error)
        setCustomers([])
      } finally {
        setIsLoading(false)
      }
    }

    loadCustomers()
  }, [currentTenant, refreshTrigger])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
  })

  const onSubmit = async (data: CustomerFormData) => {
    if (!currentTenant) {
      toast({
        title: 'Erro',
        description: 'Tenant não encontrado',
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

      // Verificar se já existe cliente com mesmo telefone
      const existing = customers.find((c) => c.phone === data.phone)
      if (existing) {
        toast({
          title: 'Aviso',
          description: 'Cliente com este telefone já está cadastrado',
          variant: 'destructive',
        })
        return
      }

      // Criar cliente no backend
      const response = await fetch(`${apiUrl}/api/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          email: data.email || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro ao criar cliente')
      }

      const result = await response.json()
      
      // Atualizar lista local com o novo cliente
      const newCustomer: Customer = {
        id: result.id || result.customer?.id,
        name: data.name,
        phone: data.phone,
        email: data.email || undefined,
        createdAt: result.created_at ? new Date(result.created_at) : new Date(),
      }
      setCustomers(prev => [...prev, newCustomer])

      // Força atualização da lista
      setRefreshTrigger((prev) => prev + 1)

      toast({
        title: 'Sucesso',
        description: 'Cliente cadastrado com sucesso',
      })

      reset()
      setOpen(false)
    } catch (error) {
      console.error('Erro ao salvar cliente:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar cliente'
      
      // Se for erro de duplicata, mostra mensagem específica
      if (errorMessage.includes('já está cadastrado')) {
        toast({
          title: 'Aviso',
          description: errorMessage,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Erro',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    }
  }

  if (!currentTenant) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Clientes / Leads</CardTitle>
            <CardDescription>
              Gerencie sua base de clientes para campanhas
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Cliente</DialogTitle>
                <DialogDescription>
                  Adicione um novo cliente à sua base
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    placeholder="Nome do cliente"
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="(00) 00000-0000"
                    {...register('phone')}
                  />
                  {errors.phone && (
                    <p className="text-sm text-destructive">{errors.phone.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
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
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Carregando clientes...
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum cliente cadastrado
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>{customer.email || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(customer.createdAt), 'dd/MM/yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

