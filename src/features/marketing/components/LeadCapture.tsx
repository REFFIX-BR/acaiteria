import { useState, useMemo } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData } from '@/lib/storage/storage'
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

  const customers = useMemo(() => {
    if (!currentTenant) return []
    return getTenantData<Customer[]>(currentTenant.id, 'customers') || []
  }, [currentTenant])

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
      const allCustomers = getTenantData<Customer[]>(currentTenant.id, 'customers') || []
      
      // Verifica se já existe cliente com mesmo telefone
      const existing = allCustomers.find((c) => c.phone === data.phone)
      if (existing) {
        toast({
          title: 'Aviso',
          description: 'Cliente com este telefone já está cadastrado',
          variant: 'destructive',
        })
        return
      }

      const newCustomer: Customer = {
        id: `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: data.name,
        phone: data.phone,
        email: data.email || undefined,
        createdAt: new Date(),
      }

      allCustomers.push(newCustomer)
      setTenantData(currentTenant.id, 'customers', allCustomers)

      toast({
        title: 'Sucesso',
        description: 'Cliente cadastrado com sucesso',
      })

      reset()
      setOpen(false)
    } catch (error) {
      console.error('Erro ao salvar cliente:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao salvar cliente',
        variant: 'destructive',
      })
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
        {customers.length === 0 ? (
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

