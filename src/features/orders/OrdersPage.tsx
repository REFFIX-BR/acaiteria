import { useState, useMemo, useEffect } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData } from '@/lib/storage/storage'
import type { Transaction } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ChefHat, 
  Package,
  Truck,
  Phone,
  Mail,
  MapPin,
  Filter,
  RefreshCw,
  Smartphone,
  Store
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { OrderDetailsModal } from './components/OrderDetailsModal'
import type { Order } from '@/types'
import { motion, AnimatePresence } from 'framer-motion'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const statusConfig = {
  pending: {
    label: 'Pendente',
    color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    icon: Clock,
  },
  accepted: {
    label: 'Aceito',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    icon: CheckCircle2,
  },
  preparing: {
    label: 'Em Preparo',
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    icon: ChefHat,
  },
  ready: {
    label: 'Pronto',
    color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    icon: Package,
  },
  delivered: {
    label: 'Entregue',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    icon: Truck,
  },
  cancelled: {
    label: 'Cancelado',
    color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    icon: XCircle,
  },
}

export default function OrdersPage() {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { toast } = useToast()
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [lastPendingCount, setLastPendingCount] = useState(0)
  const [isPageVisible, setIsPageVisible] = useState(true)

  const orders = useMemo(() => {
    if (!currentTenant) return []
    const allOrders = getTenantData<Order[]>(currentTenant.id, 'orders') || []
    // Garante que pedidos antigos sem source tenham um valor padrão
    const ordersWithSource = allOrders.map(order => ({
      ...order,
      source: order.source || 'digital' // Padrão para pedidos antigos
    }))
    return ordersWithSource.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt)
      return dateB.getTime() - dateA.getTime()
    })
  }, [currentTenant, refreshTrigger])

  const filteredOrders = useMemo(() => {
    let filtered = orders
    
    // Filtro por status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((order) => order.status === statusFilter)
    }
    
    // Filtro por origem
    if (sourceFilter !== 'all') {
      filtered = filtered.filter((order) => order.source === sourceFilter)
    }
    
    return filtered
  }, [orders, statusFilter, sourceFilter])

  const pendingCount = useMemo(() => {
    return orders.filter((o) => o.status === 'pending').length
  }, [orders])

  const pendingOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'pending')
  }, [orders])

  const updateOrderStatus = (orderId: string, newStatus: Order['status']) => {
    if (!currentTenant) return

    try {
      const allOrders = getTenantData<Order[]>(currentTenant.id, 'orders') || []
      const orderIndex = allOrders.findIndex((o) => o.id === orderId)
      
      if (orderIndex === -1) return

      const order = allOrders[orderIndex]
      const updatedOrder: Order = {
        ...order,
        status: newStatus,
        updatedAt: new Date(),
        acceptedAt: newStatus === 'accepted' ? new Date() : order.acceptedAt,
        readyAt: newStatus === 'ready' ? new Date() : order.readyAt,
        deliveredAt: newStatus === 'delivered' ? new Date() : order.deliveredAt,
      }

      allOrders[orderIndex] = updatedOrder
      setTenantData(currentTenant.id, 'orders', allOrders)
      setRefreshTrigger((prev) => prev + 1)

      // Se o pedido foi marcado como entregue, cria uma transação de entrada
      if (newStatus === 'delivered' && order.status !== 'delivered') {
        const transactions = getTenantData<Transaction[]>(currentTenant.id, 'transactions') || []
        
        // Verifica se já existe uma transação para este pedido (evita duplicatas)
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
            date: new Date(),
            createdAt: new Date(),
          }

          transactions.push(newTransaction)
          setTenantData(currentTenant.id, 'transactions', transactions)

          toast({
            title: 'Status atualizado',
            description: `Pedido ${statusConfig[newStatus].label.toLowerCase()} e adicionado ao fluxo de caixa`,
          })
        } else {
          toast({
            title: 'Status atualizado',
            description: `Pedido ${statusConfig[newStatus].label.toLowerCase()}`,
          })
        }
      } else {
        toast({
          title: 'Status atualizado',
          description: `Pedido ${statusConfig[newStatus].label.toLowerCase()}`,
        })
      }
    } catch (error) {
      console.error('Erro ao atualizar pedido:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar status do pedido',
        variant: 'destructive',
      })
    }
  }

  // Toca som de notificação
  const playNotificationSound = () => {
    try {
      // Cria um contexto de áudio
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Configura o som (frequência, duração, etc)
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)

      // Toca novamente após um pequeno delay para um som mais notável
      setTimeout(() => {
        const oscillator2 = audioContext.createOscillator()
        const gainNode2 = audioContext.createGain()
        
        oscillator2.connect(gainNode2)
        gainNode2.connect(audioContext.destination)
        
        oscillator2.frequency.value = 1000
        oscillator2.type = 'sine'
        
        gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime)
        gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
        
        oscillator2.start(audioContext.currentTime)
        oscillator2.stop(audioContext.currentTime + 0.5)
      }, 300)
    } catch (error) {
      console.error('Erro ao tocar som:', error)
    }
  }

  // Detecta quando a página está visível ou oculta
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Verifica novos pedidos em tempo real (a cada 2 segundos)
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger((prev) => prev + 1)
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  // Inicializa o contador quando a página carrega
  useEffect(() => {
    if (lastPendingCount === 0 && pendingCount > 0) {
      setLastPendingCount(pendingCount)
    }
  }, [pendingCount, lastPendingCount])

  // Detecta novos pedidos e toca som
  useEffect(() => {
    if (pendingCount > lastPendingCount && lastPendingCount >= 0) {
      // Novo pedido detectado!
      playNotificationSound()
      
      // Mostra notificação do navegador se permitido (mesmo se a página estiver visível)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Novo Pedido!', {
          body: `${pendingCount - lastPendingCount} novo(s) pedido(s) pendente(s)`,
          icon: '/favicon.ico',
          tag: 'new-order',
          requireInteraction: false,
        })
      }
      
      // Mostra toast também
      toast({
        title: 'Novo Pedido!',
        description: `${pendingCount - lastPendingCount} novo(s) pedido(s) recebido(s)`,
      })
    }
    if (pendingCount !== lastPendingCount) {
      setLastPendingCount(pendingCount)
    }
  }, [pendingCount, lastPendingCount, isPageVisible, toast])

  // Solicita permissão de notificação quando a página carrega
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  if (!currentTenant) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground">
            Gerencie os pedidos recebidos
          </p>
        </div>
        <div className="flex items-center gap-4">
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-lg px-4 py-2">
              {pendingCount} {pendingCount === 1 ? 'pedido pendente' : 'pedidos pendentes'}
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={() => setRefreshTrigger((prev) => prev + 1)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="accepted">Aceito</SelectItem>
                <SelectItem value="preparing">Em Preparo</SelectItem>
                <SelectItem value="ready">Pronto</SelectItem>
                <SelectItem value="delivered">Entregue</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="digital">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    <span>Cardápio Digital</span>
                  </div>
                </SelectItem>
                <SelectItem value="counter">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    <span>Balcão</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Pedidos */}
      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum pedido encontrado</h3>
            <p className="text-muted-foreground">
              {statusFilter === 'all' && sourceFilter === 'all'
                ? 'Ainda não há pedidos cadastrados'
                : statusFilter !== 'all' && sourceFilter !== 'all'
                ? `Nenhum pedido com status "${statusConfig[statusFilter as keyof typeof statusConfig]?.label}" e origem "${sourceFilter === 'digital' ? 'Cardápio Digital' : 'Balcão'}"`
                : statusFilter !== 'all'
                ? `Nenhum pedido com status "${statusConfig[statusFilter as keyof typeof statusConfig]?.label}"`
                : `Nenhum pedido de origem "${sourceFilter === 'digital' ? 'Cardápio Digital' : 'Balcão'}"`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {filteredOrders.map((order, index) => {
              const status = statusConfig[order.status]
              const StatusIcon = status.icon
              const orderDate = order.createdAt instanceof Date 
                ? order.createdAt 
                : new Date(order.createdAt)

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    scale: order.status === 'pending' && pendingOrders.findIndex(o => o.id === order.id) < (pendingCount - lastPendingCount) ? [1, 1.02, 1] : 1
                  }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card 
                    className={cn(
                      "hover:shadow-lg transition-all cursor-pointer",
                      order.status === 'pending' && "border-yellow-500/50 bg-yellow-500/5 animate-pulse"
                    )}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge className={cn("border", status.color)}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "border",
                                order.source === 'digital' 
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                  : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                              )}
                            >
                              {order.source === 'digital' ? (
                                <>
                                  <Smartphone className="h-3 w-3 mr-1" />
                                  Digital
                                </>
                              ) : (
                                <>
                                  <Store className="h-3 w-3 mr-1" />
                                  Balcão
                                </>
                              )}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              #{order.id.slice(-8)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {formatDate(orderDate)}
                            </span>
                          </div>

                          <div>
                            <h3 className="font-semibold text-lg mb-1">
                              {order.customerName}
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Phone className="h-4 w-4" />
                                {order.customerPhone}
                              </div>
                              {order.customerEmail && (
                                <div className="flex items-center gap-1">
                                  <Mail className="h-4 w-4" />
                                  {order.customerEmail}
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                {order.deliveryType === 'delivery' ? (
                                  <>
                                    <Truck className="h-4 w-4" />
                                    Entrega
                                  </>
                                ) : (
                                  <>
                                    <Package className="h-4 w-4" />
                                    Retirada
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">
                              {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span className="font-semibold text-lg">
                              {formatCurrency(order.total)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          {order.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  updateOrderStatus(order.id, 'accepted')
                                }}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Aceitar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (confirm('Tem certeza que deseja cancelar este pedido?')) {
                                    updateOrderStatus(order.id, 'cancelled')
                                  }
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Recusar
                              </Button>
                            </>
                          )}
                          {order.status === 'accepted' && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateOrderStatus(order.id, 'preparing')
                              }}
                            >
                              <ChefHat className="h-4 w-4 mr-2" />
                              Iniciar Preparo
                            </Button>
                          )}
                          {order.status === 'preparing' && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateOrderStatus(order.id, 'ready')
                              }}
                            >
                              <Package className="h-4 w-4 mr-2" />
                              Marcar Pronto
                            </Button>
                          )}
                          {order.status === 'ready' && order.deliveryType === 'delivery' && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateOrderStatus(order.id, 'delivered')
                              }}
                            >
                              <Truck className="h-4 w-4 mr-2" />
                              Marcar Entregue
                            </Button>
                          )}
                          {order.status === 'ready' && order.deliveryType === 'pickup' && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateOrderStatus(order.id, 'delivered')
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Cliente Retirou
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Modal de Detalhes */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          open={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={(status) => {
            updateOrderStatus(selectedOrder.id, status)
            setSelectedOrder(null)
          }}
        />
      )}
    </div>
  )
}

