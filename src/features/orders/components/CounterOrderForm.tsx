import { useState } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData } from '@/lib/storage/storage'
import { getApiUrl } from '@/lib/api/config'
import { authenticatedFetch } from '@/lib/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Plus, Store } from 'lucide-react'
import type { Order, MenuItem, OrderItem } from '@/types'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

interface CounterOrderFormProps {
  onSuccess?: () => void
}

export function CounterOrderForm({ onSuccess }: CounterOrderFormProps) {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [selectedItems, setSelectedItems] = useState<Array<{
    menuItem: MenuItem
    quantity: number
  }>>([])
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'pix'>('cash')

  const menuItems = currentTenant
    ? (getTenantData<MenuItem[]>(currentTenant.id, 'menu') || []).filter(item => item.available)
    : []

  const addItem = (item: MenuItem) => {
    const existing = selectedItems.find(si => si.menuItem.id === item.id)
    if (existing) {
      setSelectedItems(selectedItems.map(si =>
        si.menuItem.id === item.id
          ? { ...si, quantity: si.quantity + 1 }
          : si
      ))
    } else {
      setSelectedItems([...selectedItems, { menuItem: item, quantity: 1 }])
    }
  }

  const removeItem = (itemId: string) => {
    setSelectedItems(selectedItems.filter(si => si.menuItem.id !== itemId))
  }

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId)
      return
    }
    setSelectedItems(selectedItems.map(si =>
      si.menuItem.id === itemId
        ? { ...si, quantity }
        : si
    ))
  }

  const calculateTotal = () => {
    return selectedItems.reduce((total, si) => {
      const itemPrice = si.menuItem.basePrice
      return total + (itemPrice * si.quantity)
    }, 0)
  }

  const handleSubmit = async () => {
    if (!currentTenant) {
      toast({
        title: 'Erro',
        description: 'Tenant não encontrado',
        variant: 'destructive',
      })
      return
    }

    if (!customerName.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome do cliente é obrigatório',
        variant: 'destructive',
      })
      return
    }

    if (selectedItems.length === 0) {
      toast({
        title: 'Erro',
        description: 'Adicione pelo menos um item ao pedido',
        variant: 'destructive',
      })
      return
    }

    try {
      const allOrders = getTenantData<Order[]>(currentTenant.id, 'orders') || []

      const orderItems: OrderItem[] = selectedItems.map((si) => ({
        id: `order-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        menuItemId: si.menuItem.id,
        menuItemName: si.menuItem.name,
        additions: [],
        complements: [],
        fruits: [],
        quantity: si.quantity,
        unitPrice: si.menuItem.basePrice,
        totalPrice: si.menuItem.basePrice * si.quantity,
      }))

      const total = calculateTotal()

      // Criar pedido no backend primeiro
      const apiUrl = getApiUrl()
      const response = await authenticatedFetch(`${apiUrl}/api/orders`, {
        method: 'POST',
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: 'Balcão',
          items: orderItems.map(item => ({
            menuItemId: item.menuItemId,
            menuItemName: item.menuItemName,
            size: undefined,
            additions: item.additions || [],
            complements: item.complements || [],
            fruits: item.fruits || [],
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
          subtotal: total,
          total,
          paymentMethod,
          deliveryType: 'pickup',
          source: 'counter',
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erro ao criar pedido' }))
        throw new Error(error.error || 'Erro ao criar pedido no servidor')
      }

      const result = await response.json()
      const backendOrderId = result.id

      // Criar pedido local com o ID do backend
      const newOrder: Order = {
        id: backendOrderId,
        tenantId: currentTenant.id,
        customerName: customerName.trim(),
        customerPhone: 'Balcão',
        items: orderItems,
        subtotal: total,
        total,
        status: 'pending',
        paymentMethod,
        deliveryType: 'pickup',
        source: 'counter',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Pedido já foi criado no backend, não precisa salvar localmente

      toast({
        title: 'Pedido criado!',
        description: 'Pedido de balcão registrado com sucesso',
      })

      // Limpa o formulário
      setCustomerName('')
      setSelectedItems([])
      setPaymentMethod('cash')
      setOpen(false)
      onSuccess?.()
    } catch (error) {
      console.error('Erro ao criar pedido:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao criar pedido',
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Store className="h-4 w-4 mr-2" />
        Novo Pedido Balcão
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Pedido - Balcão</DialogTitle>
            <DialogDescription>
              Registre um pedido feito diretamente na loja
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Cliente */}
            <div className="space-y-2">
              <Label htmlFor="customerName">Nome do Cliente</Label>
              <Input
                id="customerName"
                placeholder="Nome do cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            {/* Método de Pagamento */}
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Método de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="card">Cartão</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Itens do Cardápio */}
            <div className="space-y-2">
              <Label>Itens do Cardápio</Label>
              <div className="border rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                {menuItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum item disponível no cardápio
                  </p>
                ) : (
                  menuItems.map((item) => {
                    const selected = selectedItems.find(si => si.menuItem.id === item.id)
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 border rounded hover:bg-muted/50"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(item.basePrice)}
                          </p>
                        </div>
                        {selected ? (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.id, selected.quantity - 1)}
                            >
                              -
                            </Button>
                            <span className="w-8 text-center">{selected.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.id, selected.quantity + 1)}
                            >
                              +
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addItem(item)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Adicionar
                          </Button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Itens Selecionados */}
            {selectedItems.length > 0 && (
              <div className="space-y-2">
                <Label>Itens Selecionados</Label>
                <div className="border rounded-lg p-4 space-y-2">
                  {selectedItems.map((si) => (
                    <div
                      key={si.menuItem.id}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          {si.menuItem.name} x{si.quantity}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(si.menuItem.basePrice * si.quantity)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(si.menuItem.id)}
                      >
                        Remover
                      </Button>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex items-center justify-between font-semibold">
                      <span>Total:</span>
                      <span>{formatCurrency(calculateTotal())}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={selectedItems.length === 0 || !customerName.trim()}>
              Criar Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

