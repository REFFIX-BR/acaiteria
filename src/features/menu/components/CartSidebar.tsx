import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Plus, Minus, X, ArrowLeft, ChefHat, Trash2, ShoppingCart, CreditCard, Banknote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect, useMemo } from 'react'
import { getTenantData, setTenantData, setGlobalData, getGlobalData } from '@/lib/storage/storage'
import type { CartItem } from '../MenuPublicPage'
import type { Order, Customer } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { CustomerIdentificationModal } from './CustomerIdentificationModal'
import { getOrderSourceFromUrl } from '@/lib/menu/menuUrl'
import { getApiUrl } from '@/lib/api/config'
import { authenticatedFetch } from '@/lib/api/auth'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const CUSTOMER_STORAGE_KEY = 'menu_customer_data'
const DELIVERY_ADDRESS_STORAGE_KEY = 'menu_delivery_address'

interface SavedDeliveryAddress {
  address: string
  number: string
  neighborhood: string
  zipCode: string
  complement: string
}

interface CartSidebarProps {
  open: boolean
  onClose: () => void
  items: CartItem[]
  total: number
  primaryColor: string
  secondaryColor: string
  onRemoveItem: (id: string) => void
  onUpdateQuantity: (id: string, quantity: number) => void
  allowWhatsAppOrder?: boolean
  whatsAppNumber?: string
  customMessage?: string
  tenantId?: string
  onCreateOrder?: () => void
  tenantName?: string
}

export function CartSidebar({
  open,
  onClose,
  items,
  total,
  primaryColor,
  secondaryColor,
  onRemoveItem,
  onUpdateQuantity,
  allowWhatsAppOrder = false,
  whatsAppNumber = '',
  customMessage = 'Olá! Gostaria de fazer um pedido.',
  tenantId,
  onCreateOrder,
  tenantName = 'Restaurante',
}: CartSidebarProps) {
  const { toast } = useToast()
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup')
  const [showIdentification, setShowIdentification] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryNumber, setDeliveryNumber] = useState('')
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState('')
  const [deliveryZipCode, setDeliveryZipCode] = useState('')
  const [deliveryComplement, setDeliveryComplement] = useState('')
  const [savedAddress, setSavedAddress] = useState<SavedDeliveryAddress | null>(null)
  const [showAddressOption, setShowAddressOption] = useState(false)
  const [useSavedAddress, setUseSavedAddress] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'credit' | 'debit' | 'cash' | null>(null)
  const [showChangeModal, setShowChangeModal] = useState(false)
  const [cashReceived, setCashReceived] = useState('')
  const [needsChange, setNeedsChange] = useState(false)

  // Carrega dados do cliente do localStorage ao montar
  useEffect(() => {
    const savedCustomer = getGlobalData<{ name: string; phone: string }>(CUSTOMER_STORAGE_KEY)
    if (savedCustomer?.name && savedCustomer?.phone) {
      setCustomerName(savedCustomer.name)
      setCustomerPhone(savedCustomer.phone)
    }

    // Carrega endereço salvo
    const saved = getGlobalData<SavedDeliveryAddress>(DELIVERY_ADDRESS_STORAGE_KEY)
    if (saved) {
      setSavedAddress(saved)
    }
  }, [])

  // Quando mudar para entrega, verifica se tem endereço salvo
  useEffect(() => {
    if (deliveryType === 'delivery' && savedAddress && !deliveryAddress) {
      setShowAddressOption(true)
    } else if (deliveryType === 'pickup') {
      setShowAddressOption(false)
      setUseSavedAddress(false)
      setPaymentMethod(null)
      setCashReceived('')
      setNeedsChange(false)
    }
  }, [deliveryType, savedAddress, deliveryAddress])

  // Calcula troco
  const change = useMemo(() => {
    if (paymentMethod === 'cash' && needsChange && cashReceived) {
      const received = parseFloat(cashReceived.replace(',', '.')) || 0
      const calculatedChange = received - total
      return calculatedChange > 0 ? calculatedChange : 0
    }
    return 0
  }, [paymentMethod, needsChange, cashReceived, total])

  const calculateItemTotal = (item: CartItem) => {
    // Se tem tamanho selecionado, usa o preço do tamanho
    // Se não tem tamanho, usa o preço base
    let itemTotal = item.size ? item.size.price : item.item.basePrice
    item.additions.forEach((add) => (itemTotal += add.price))
    item.complements.forEach((comp) => (itemTotal += comp.price))
    if (item.fruits) {
      item.fruits.forEach((fruit) => (itemTotal += fruit.price))
    }
    return itemTotal * item.quantity
  }

  const calculateItemUnitPrice = (item: CartItem) => {
    // Se tem tamanho selecionado, usa o preço do tamanho
    // Se não tem tamanho, usa o preço base
    let itemTotal = item.size ? item.size.price : item.item.basePrice
    item.additions.forEach((add) => (itemTotal += add.price))
    item.complements.forEach((comp) => (itemTotal += comp.price))
    if (item.fruits) {
      item.fruits.forEach((fruit) => (itemTotal += fruit.price))
    }
    return itemTotal
  }

  const generateWhatsAppMessage = () => {
    let message = customMessage + '\n\n'
    items.forEach((item) => {
      message += `• ${item.item.name}`
      if (item.size) message += ` (${item.size.name})`
      if (item.additions.length > 0) {
        message += ` - Coberturas: ${item.additions.map(a => a.name).join(', ')}`
      }
      if (item.complements.length > 0) {
        message += ` - Complementos: ${item.complements.map(c => c.name).join(', ')}`
      }
      if (item.fruits && item.fruits.length > 0) {
        message += ` - Frutas: ${item.fruits.map(f => f.name).join(', ')}`
      }
      message += ` x${item.quantity}\n`
    })
    message += `\nTotal: R$ ${total.toFixed(2).replace('.', ',')}`
    
    // Adiciona informações de entrega se for entrega
    if (deliveryType === 'delivery' && deliveryAddress) {
      let fullAddress = deliveryAddress
      if (deliveryNumber) fullAddress += `, Nº ${deliveryNumber}`
      if (deliveryComplement) fullAddress += ` (${deliveryComplement})`
      if (deliveryNeighborhood) fullAddress += ` - ${deliveryNeighborhood}`
      if (deliveryZipCode) fullAddress += ` - CEP: ${deliveryZipCode}`
      message += `\n\n📍 Endereço de Entrega:\n${fullAddress}`
      
      // Adiciona método de pagamento
      if (paymentMethod) {
        let paymentText = ''
        if (paymentMethod === 'credit') {
          paymentText = '💳 Cartão de Crédito'
        } else if (paymentMethod === 'debit') {
          paymentText = '💳 Cartão de Débito'
        } else if (paymentMethod === 'cash') {
          paymentText = '💵 Dinheiro'
          if (needsChange && cashReceived) {
            const received = parseFloat(cashReceived.replace(',', '.')) || 0
            paymentText += `\nValor recebido: ${formatCurrency(received)}`
            if (change > 0) {
              paymentText += `\nTroco: ${formatCurrency(change)}`
            }
          }
        }
        message += `\n\n💳 Forma de Pagamento:\n${paymentText}`
      }
    } else if (deliveryType === 'pickup') {
      message += `\n\n📍 Retirada no Local`
    }
    
    return encodeURIComponent(message)
  }


  const handleContinueFromIdentification = (name: string, phone: string) => {
    if (!tenantId) return

    // Salva dados do cliente localmente (para sessão)
    setCustomerName(name)
    setCustomerPhone(phone)
    setGlobalData(CUSTOMER_STORAGE_KEY, { name, phone })
    setShowIdentification(false)

    // Salva cliente na lista de clientes do tenant (para campanhas)
    try {
      const allCustomers = getTenantData<Customer[]>(tenantId, 'customers') || []
      
      // Verifica se já existe cliente com mesmo telefone
      const existingIndex = allCustomers.findIndex((c) => c.phone === phone)
      
      if (existingIndex >= 0) {
        // Se já existe, atualiza o nome (pode ter mudado)
        allCustomers[existingIndex] = {
          ...allCustomers[existingIndex],
          name: name,
        }
      } else {
        // Se não existe, cria novo cliente
        const newCustomer: Customer = {
          id: `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: name,
          phone: phone,
          createdAt: new Date(),
        }
        allCustomers.push(newCustomer)
      }

      setTenantData(tenantId, 'customers', allCustomers)
    } catch (error) {
      console.error('Erro ao salvar cliente:', error)
      // Não bloqueia o fluxo se houver erro ao salvar
    }

    // Após identificar, finaliza o pedido
    if (allowWhatsAppOrder && whatsAppNumber) {
      handleWhatsAppOrderWithCustomer(name, phone)
    } else {
      void handleCreateOrderWithCustomer(name, phone)
    }
  }

  const formatZipCode = (value: string): string => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 5) {
      return numbers
    }
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`
  }

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatZipCode(e.target.value)
    setDeliveryZipCode(formatted)
  }

  const handleFinalizeOrder = () => {
    // Verifica se está identificado antes de finalizar
    if (!customerName || !customerPhone) {
      setShowIdentification(true)
      return
    }

    // Se for entrega, valida endereço e método de pagamento
    if (deliveryType === 'delivery') {
      if (!deliveryAddress.trim() || !deliveryNumber.trim() || !deliveryNeighborhood.trim() || !deliveryZipCode.replace(/\D/g, '').length) {
        toast({
          title: 'Endereço incompleto',
          description: 'Por favor, preencha todos os campos do endereço',
          variant: 'destructive',
        })
        return
      }
      if (!paymentMethod) {
        toast({
          title: 'Método de pagamento',
          description: 'Por favor, selecione o método de pagamento',
          variant: 'destructive',
        })
        return
      }
      if (paymentMethod === 'cash' && needsChange && !cashReceived) {
        toast({
          title: 'Valor necessário',
          description: 'Por favor, informe o valor recebido',
          variant: 'destructive',
        })
        return
      }
      if (paymentMethod === 'cash' && needsChange) {
        const received = parseFloat(cashReceived.replace(',', '.')) || 0
        if (received < total) {
          toast({
            title: 'Valor insuficiente',
            description: `O valor recebido (${formatCurrency(received)}) deve ser maior ou igual ao total (${formatCurrency(total)})`,
            variant: 'destructive',
          })
          return
        }
      }
    }

    // Se estiver identificado, finaliza o pedido
    if (allowWhatsAppOrder && whatsAppNumber) {
      handleWhatsAppOrderWithCustomer(customerName, customerPhone)
    } else {
      void handleCreateOrderWithCustomer(customerName, customerPhone)
    }
  }

  const handleWhatsAppOrderWithCustomer = (name: string, phone: string) => {
    if (!whatsAppNumber) return
    
    // Salva endereço em cache se for entrega
    if (deliveryType === 'delivery' && deliveryAddress) {
      const addressToSave: SavedDeliveryAddress = {
        address: deliveryAddress,
        number: deliveryNumber,
        neighborhood: deliveryNeighborhood,
        zipCode: deliveryZipCode,
        complement: deliveryComplement,
      }
      setGlobalData(DELIVERY_ADDRESS_STORAGE_KEY, addressToSave)
      setSavedAddress(addressToSave)
    }

    const message = generateWhatsAppMessage()
    const url = `https://wa.me/${whatsAppNumber}?text=${message}`
    window.open(url, '_blank')
    onCreateOrder?.()
    onClose()
  }

  const handleUseSavedAddress = () => {
    if (savedAddress) {
      setDeliveryAddress(savedAddress.address)
      setDeliveryNumber(savedAddress.number)
      setDeliveryNeighborhood(savedAddress.neighborhood)
      setDeliveryZipCode(savedAddress.zipCode)
      setDeliveryComplement(savedAddress.complement)
      setUseSavedAddress(true)
      setShowAddressOption(false)
    }
  }

  const handleUseNewAddress = () => {
    setUseSavedAddress(false)
    setShowAddressOption(false)
    setDeliveryAddress('')
    setDeliveryNumber('')
    setDeliveryNeighborhood('')
    setDeliveryZipCode('')
    setDeliveryComplement('')
  }

  const handlePaymentMethodChange = (method: 'credit' | 'debit' | 'cash') => {
    setPaymentMethod(method)
    if (method === 'cash') {
      setShowChangeModal(true)
      setCashReceived('')
      setNeedsChange(false)
    } else {
      setShowChangeModal(false)
      setCashReceived('')
      setNeedsChange(false)
    }
  }

  const handleConfirmChange = () => {
    if (needsChange && !cashReceived) {
      toast({
        title: 'Valor necessário',
        description: 'Por favor, informe o valor recebido',
        variant: 'destructive',
      })
      return
    }
    if (needsChange) {
      const received = parseFloat(cashReceived.replace(',', '.')) || 0
      if (received < total) {
        toast({
          title: 'Valor insuficiente',
          description: `O valor recebido (${formatCurrency(received)}) deve ser maior ou igual ao total (${formatCurrency(total)})`,
          variant: 'destructive',
        })
        return
      }
    }
    setShowChangeModal(false)
  }

  const handleCreateOrderWithCustomer = async (name: string, phone: string) => {
    if (!tenantId) {
      toast({
        title: 'Erro',
        description: 'Erro ao criar pedido',
        variant: 'destructive',
      })
      return
    }

    try {
      const allOrders = getTenantData<Order[]>(tenantId, 'orders') || []

      const orderItems = items.map((item) => ({
        id: `order-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        menuItemId: item.item.id,
        menuItemName: item.item.name,
        size: item.size?.name,
        additions: item.additions.map(a => a.name),
        complements: item.complements.map(c => c.name),
        fruits: item.fruits ? item.fruits.map(f => f.name) : [],
        quantity: item.quantity,
        unitPrice: calculateItemUnitPrice(item),
        totalPrice: calculateItemTotal(item),
      }))

      // Monta endereço completo se for entrega
      let fullAddress: string | undefined = undefined
      if (deliveryType === 'delivery') {
        const addressParts = [
          deliveryAddress,
          deliveryNumber && `Nº ${deliveryNumber}`,
          deliveryComplement && `(${deliveryComplement})`,
          deliveryNeighborhood,
          deliveryZipCode,
        ].filter(Boolean)
        fullAddress = addressParts.join(', ')

        // Salva endereço em cache
        const addressToSave: SavedDeliveryAddress = {
          address: deliveryAddress,
          number: deliveryNumber,
          neighborhood: deliveryNeighborhood,
          zipCode: deliveryZipCode,
          complement: deliveryComplement,
        }
        setGlobalData(DELIVERY_ADDRESS_STORAGE_KEY, addressToSave)
        setSavedAddress(addressToSave)
      }

      // Determina método de pagamento para salvar no pedido
      let orderPaymentMethod: 'cash' | 'card' | 'pix' | 'other' | undefined = undefined
      if (deliveryType === 'delivery' && paymentMethod) {
        if (paymentMethod === 'credit' || paymentMethod === 'debit') {
          orderPaymentMethod = 'card'
        } else if (paymentMethod === 'cash') {
          orderPaymentMethod = 'cash'
        }
      }

      // Criar pedido no backend primeiro
      const apiUrl = getApiUrl()
      const response = await authenticatedFetch(`${apiUrl}/api/orders`, {
        method: 'POST',
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          items: orderItems.map(item => ({
            menuItemId: item.menuItemId,
            menuItemName: item.menuItemName,
            size: item.size,
            additions: item.additions,
            complements: item.complements,
            fruits: item.fruits,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
          subtotal: total,
          total,
          paymentMethod: orderPaymentMethod,
          deliveryType,
          deliveryAddress: fullAddress,
          notes: paymentMethod === 'cash' && needsChange && cashReceived
            ? `Pagamento em dinheiro. Valor recebido: ${formatCurrency(parseFloat(cashReceived.replace(',', '.')) || 0)}. Troco: ${formatCurrency(change)}`
            : undefined,
          source: getOrderSourceFromUrl(),
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
        tenantId,
        customerName: name,
        customerPhone: phone,
        items: orderItems,
        subtotal: total,
        total,
        status: 'pending',
        paymentMethod: orderPaymentMethod,
        deliveryType,
        deliveryAddress: fullAddress,
        notes: paymentMethod === 'cash' && needsChange && cashReceived
          ? `Pagamento em dinheiro. Valor recebido: ${formatCurrency(parseFloat(cashReceived.replace(',', '.')) || 0)}. Troco: ${formatCurrency(change)}`
          : undefined,
        source: getOrderSourceFromUrl(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      allOrders.push(newOrder)
      setTenantData(tenantId, 'orders', allOrders)

      toast({
        title: 'Pedido criado!',
        description: 'Seu pedido foi enviado e está aguardando confirmação',
      })

      onCreateOrder?.()
      onClose()
    } catch (error) {
      console.error('Erro ao criar pedido:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao criar pedido',
        variant: 'destructive',
      })
    }
  }

  if (!open) return null

  // Se mostrar identificação, renderiza apenas o modal de identificação
  if (showIdentification) {
    return (
      <CustomerIdentificationModal
        open={showIdentification}
        onClose={() => {
          setShowIdentification(false)
          onClose()
        }}
        onContinue={handleContinueFromIdentification}
        primaryColor={primaryColor}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#f8f7f6] overflow-hidden animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#f8f7f6]/80 backdrop-blur-md px-4 sm:px-10 py-4 sm:py-6 flex items-center justify-between border-b border-[#f3ede7]">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-[#9a734c] hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-wide uppercase hidden sm:inline">
            Continuar Pedindo
          </span>
        </button>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[#f3ede7] rounded-lg transition-colors"
        >
          <X className="h-5 w-5 text-[#1b140d]" />
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar h-[calc(100vh-73px)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
          <div className="mb-8 sm:mb-10">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 text-[#1b140d]">
              Resumo do Pedido
            </h1>
            <p className="text-[#9a734c]">
              Revise suas seleções antes de finalizar o pedido.
            </p>
          </div>

          <div className="flex flex-col xl:flex-row gap-8 sm:gap-12">
            {/* Items List */}
            <div className="flex-1 space-y-6 sm:space-y-8">
              {items.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-[#f3ede7]">
                  <ShoppingCart className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-[#9a734c] text-lg">Seu carrinho está vazio</p>
                  <p className="text-[#9a734c] text-sm mt-2">Adicione produtos ao carrinho e faça o pedido</p>
                </div>
              ) : (
                items.map((item) => (
                  <CartItemCard
                    key={item.id}
                    item={item}
                    primaryColor={primaryColor}
                    unitPrice={calculateItemUnitPrice(item)}
                    onRemove={() => onRemoveItem(item.id)}
                    onUpdateQuantity={(quantity) => onUpdateQuantity(item.id, quantity)}
                  />
                ))
              )}
            </div>

            {/* Sidebar - Checkout Details */}
            {items.length > 0 && (
              <aside className="w-full xl:w-[400px] shrink-0">
                <div
                  className="bg-[#2a2016] text-white rounded-3xl p-6 sm:p-8 sticky top-32 shadow-2xl"
                  style={{ boxShadow: `0 20px 60px rgba(42, 32, 22, 0.3)` }}
                >
                  <h2 className="text-xl font-bold tracking-tight mb-8 border-b border-white/10 pb-4">
                    Detalhes do Pedido
                  </h2>
                  
                  <div className="space-y-4 mb-8">
                    <div className="pt-4 border-t border-white/10 flex justify-between items-baseline">
                      <span className="text-lg font-bold">Total</span>
                      <span
                        className="text-2xl sm:text-3xl font-black"
                        style={{ color: primaryColor }}
                      >
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Button
                      onClick={handleFinalizeOrder}
                      className="w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 text-white hover:opacity-90"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <ShoppingCart className="h-5 w-5" />
                      {allowWhatsAppOrder && whatsAppNumber ? 'Finalizar via WhatsApp' : 'Finalizar Pedido'}
                    </Button>
                  </div>

                  {/* Dining Preferences */}
                  <div className="mt-8 pt-8 border-t border-white/10">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[#9a734c] mb-4">
                      Preferências de Entrega
                    </h4>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="delivery_type"
                          checked={deliveryType === 'pickup'}
                          onChange={() => {
                            setDeliveryType('pickup')
                            // Limpa campos de endereço quando muda para retirada
                            setDeliveryAddress('')
                            setDeliveryNumber('')
                            setDeliveryNeighborhood('')
                            setDeliveryZipCode('')
                            setDeliveryComplement('')
                          }}
                          className="w-4 h-4 border-white/20 bg-transparent"
                          style={{ accentColor: primaryColor }}
                        />
                        <span className="text-sm font-medium text-white/80">Retirada no Local</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="delivery_type"
                          checked={deliveryType === 'delivery'}
                          onChange={() => setDeliveryType('delivery')}
                          className="w-4 h-4 border-white/20 bg-transparent"
                          style={{ accentColor: primaryColor }}
                        />
                        <span className="text-sm font-medium text-white/80">Entrega</span>
                      </label>
                    </div>

                    {/* Método de Pagamento quando for Entrega */}
                    {deliveryType === 'delivery' && (
                      <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-[#9a734c] mb-4">
                          Forma de Pagamento
                        </h4>
                        <div className="space-y-3">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="payment_method"
                              checked={paymentMethod === 'credit'}
                              onChange={() => handlePaymentMethodChange('credit')}
                              className="w-4 h-4 border-white/20 bg-transparent"
                              style={{ accentColor: primaryColor }}
                            />
                            <span className="text-sm font-medium text-white/80">Cartão de Crédito</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="payment_method"
                              checked={paymentMethod === 'debit'}
                              onChange={() => handlePaymentMethodChange('debit')}
                              className="w-4 h-4 border-white/20 bg-transparent"
                              style={{ accentColor: primaryColor }}
                            />
                            <span className="text-sm font-medium text-white/80">Cartão de Débito</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="payment_method"
                              checked={paymentMethod === 'cash'}
                              onChange={() => handlePaymentMethodChange('cash')}
                              className="w-4 h-4 border-white/20 bg-transparent"
                              style={{ accentColor: primaryColor }}
                            />
                            <span className="text-sm font-medium text-white/80">Dinheiro</span>
                          </label>
                          {paymentMethod === 'cash' && needsChange && cashReceived && change > 0 && (
                            <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                              <p className="text-xs text-white/70">
                                Troco: <span className="font-semibold text-white" style={{ color: primaryColor }}>{formatCurrency(change)}</span>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Campos de Endereço quando for Entrega */}
                    {deliveryType === 'delivery' && (
                      <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
                        {/* Opção para usar endereço salvo */}
                        {showAddressOption && savedAddress && (
                          <div className="bg-white/5 border border-white/20 rounded-xl p-4 space-y-3">
                            <p className="text-sm font-semibold text-white/90">
                              Deseja usar o endereço anterior?
                            </p>
                            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                              <p className="text-xs text-white/70 leading-relaxed">
                                {savedAddress.address}, Nº {savedAddress.number}
                                {savedAddress.complement && ` (${savedAddress.complement})`}
                                <br />
                                {savedAddress.neighborhood} - CEP: {savedAddress.zipCode}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={handleUseSavedAddress}
                                className="flex-1 py-2 rounded-lg font-semibold text-sm transition-all"
                                style={{ backgroundColor: primaryColor, color: 'white' }}
                              >
                                Usar este endereço
                              </Button>
                              <Button
                                onClick={handleUseNewAddress}
                                variant="outline"
                                className="flex-1 py-2 rounded-lg font-semibold text-sm border-white/20 text-white/80 hover:bg-white/10"
                              >
                                Novo endereço
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Campos de endereço */}
                        {(!showAddressOption || useSavedAddress) && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="deliveryAddress" className="text-xs font-bold uppercase tracking-widest text-white/60">
                                Endereço *
                              </Label>
                              <Input
                                id="deliveryAddress"
                                placeholder="Rua, Avenida, etc."
                                value={deliveryAddress}
                                onChange={(e) => setDeliveryAddress(e.target.value)}
                                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-primary"
                                style={{ '--tw-ring-color': primaryColor } as any}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="deliveryNumber" className="text-xs font-bold uppercase tracking-widest text-white/60">
                                  Número *
                                </Label>
                                <Input
                                  id="deliveryNumber"
                                  placeholder="123"
                                  value={deliveryNumber}
                                  onChange={(e) => setDeliveryNumber(e.target.value)}
                                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-primary"
                                  style={{ '--tw-ring-color': primaryColor } as any}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="deliveryZipCode" className="text-xs font-bold uppercase tracking-widest text-white/60">
                                  CEP *
                                </Label>
                                <Input
                                  id="deliveryZipCode"
                                  placeholder="00000-000"
                                  value={deliveryZipCode}
                                  onChange={handleZipCodeChange}
                                  maxLength={9}
                                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-primary"
                                  style={{ '--tw-ring-color': primaryColor } as any}
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="deliveryNeighborhood" className="text-xs font-bold uppercase tracking-widest text-white/60">
                                Bairro *
                              </Label>
                              <Input
                                id="deliveryNeighborhood"
                                placeholder="Bairro"
                                value={deliveryNeighborhood}
                                onChange={(e) => setDeliveryNeighborhood(e.target.value)}
                                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-primary"
                                style={{ '--tw-ring-color': primaryColor } as any}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="deliveryComplement" className="text-xs font-bold uppercase tracking-widest text-white/60">
                                Complemento (opcional)
                              </Label>
                              <Input
                                id="deliveryComplement"
                                placeholder="Apartamento, Bloco, etc."
                                value={deliveryComplement}
                                onChange={(e) => setDeliveryComplement(e.target.value)}
                                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-primary"
                                style={{ '--tw-ring-color': primaryColor } as any}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Troco */}
      <Dialog open={showChangeModal} onOpenChange={setShowChangeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Precisa de troco?</DialogTitle>
            <DialogDescription>
              Informe se precisa de troco e o valor recebido
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="needs_change"
                  checked={!needsChange}
                  onChange={() => {
                    setNeedsChange(false)
                    setCashReceived('')
                  }}
                  className="w-4 h-4"
                  style={{ accentColor: primaryColor }}
                />
                <span className="text-sm font-medium">Não, valor exato</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="needs_change"
                  checked={needsChange}
                  onChange={() => setNeedsChange(true)}
                  className="w-4 h-4"
                  style={{ accentColor: primaryColor }}
                />
                <span className="text-sm font-medium">Sim, precisa de troco</span>
              </label>
            </div>
            {needsChange && (
              <div className="space-y-2">
                <Label htmlFor="cashReceived" className="text-sm font-semibold">
                  Valor recebido *
                </Label>
                <Input
                  id="cashReceived"
                  type="text"
                  placeholder="0,00"
                  value={cashReceived}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d,]/g, '')
                    setCashReceived(value)
                  }}
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Total: {formatCurrency(total)}
                </p>
                {cashReceived && (() => {
                  const received = parseFloat(cashReceived.replace(',', '.')) || 0
                  const calculatedChange = received - total
                  if (calculatedChange < 0) {
                    return (
                      <p className="text-xs text-red-500">
                        Valor insuficiente. Faltam {formatCurrency(Math.abs(calculatedChange))}
                      </p>
                    )
                  }
                  return (
                    <p className="text-xs font-semibold" style={{ color: primaryColor }}>
                      Troco: {formatCurrency(calculatedChange)}
                    </p>
                  )
                })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowChangeModal(false)
                setPaymentMethod(null)
                setCashReceived('')
                setNeedsChange(false)
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmChange}
              style={{ backgroundColor: primaryColor, color: 'white' }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface CartItemCardProps {
  item: CartItem
  primaryColor: string
  unitPrice: number
  onRemove: () => void
  onUpdateQuantity: (quantity: number) => void
}

function CartItemCard({ item, primaryColor, unitPrice, onRemove, onUpdateQuantity }: CartItemCardProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-6 p-6 bg-white rounded-2xl border border-[#f3ede7] shadow-sm">
      {/* Image */}
      <div className="w-full sm:w-32 h-32 rounded-xl overflow-hidden shrink-0 bg-gray-100">
        {item.item.image ? (
          <img
            src={item.item.image}
            alt={item.item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#f3ede7] to-gray-200">
            <ChefHat className="h-12 w-12 text-gray-300" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-2 gap-4">
            <h3 className="text-xl font-bold tracking-tight text-[#1b140d]">{item.item.name}</h3>
            <span className="text-xl font-bold shrink-0" style={{ color: primaryColor }}>
              {formatCurrency(unitPrice)}
            </span>
          </div>
          <div className="space-y-1 mb-4">
            {item.size && (
              <p className="text-xs font-semibold text-[#9a734c] uppercase tracking-wider flex items-center gap-1">
                <ChefHat className="h-3 w-3" />
                {item.size.name}
              </p>
            )}
            {item.additions.length > 0 && (
              <p className="text-xs font-semibold text-[#9a734c] uppercase tracking-wider flex items-center gap-1">
                <ChefHat className="h-3 w-3" />
                {item.additions.map(a => a.name).join(', ')}
              </p>
            )}
            {item.complements.length > 0 && (
              <p className="text-xs font-semibold text-[#9a734c] uppercase tracking-wider flex items-center gap-1">
                <ChefHat className="h-3 w-3" />
                {item.complements.map(c => c.name).join(', ')}
              </p>
            )}
            {item.fruits && item.fruits.length > 0 && (
              <p className="text-xs font-semibold text-[#9a734c] uppercase tracking-wider flex items-center gap-1">
                <ChefHat className="h-3 w-3" />
                Frutas: {item.fruits.map(f => f.name).join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Quantity and Remove */}
        <div className="flex items-center justify-between">
          <div className="flex items-center bg-[#f8f7f6] border border-[#f3ede7] rounded-lg p-0.5">
            <button
              onClick={() => onUpdateQuantity(Math.max(1, item.quantity - 1))}
              className="w-8 h-8 flex items-center justify-center hover:text-primary transition-colors text-[#1b140d]"
              style={{ '--hover-color': primaryColor } as any}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = primaryColor
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#1b140d'
              }}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-sm font-bold text-[#1b140d]">{item.quantity}</span>
            <button
              onClick={() => onUpdateQuantity(item.quantity + 1)}
              className="w-8 h-8 flex items-center justify-center hover:text-primary transition-colors text-[#1b140d]"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = primaryColor
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#1b140d'
              }}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={onRemove}
            className="text-xs font-bold uppercase text-red-500 hover:text-red-600 transition-colors flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" />
            Remover
          </button>
        </div>
      </div>
    </div>
  )
}
