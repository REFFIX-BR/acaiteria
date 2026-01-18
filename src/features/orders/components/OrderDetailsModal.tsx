import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ChefHat, 
  Package,
  Truck,
  Phone,
  Mail,
  MapPin,
  DollarSign
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Order } from '@/types'

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

interface OrderDetailsModalProps {
  order: Order
  open: boolean
  onClose: () => void
  onUpdateStatus: (status: Order['status']) => void
}

export function OrderDetailsModal({
  order,
  open,
  onClose,
  onUpdateStatus,
}: OrderDetailsModalProps) {
  const status = statusConfig[order.status]
  const StatusIcon = status.icon
  const orderDate = order.createdAt instanceof Date 
    ? order.createdAt 
    : new Date(order.createdAt)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">
              Pedido #{order.id.slice(-8)}
            </DialogTitle>
            <Badge className={cn("border", status.color)}>
              <StatusIcon className="h-4 w-4 mr-1" />
              {status.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações do Cliente */}
          <div>
            <h3 className="font-semibold mb-3">Informações do Cliente</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{order.customerName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                {order.customerPhone}
              </div>
              {order.customerEmail && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {order.customerEmail}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Tipo de Entrega */}
          <div>
            <h3 className="font-semibold mb-3">Tipo de Entrega</h3>
            <div className="flex items-center gap-2">
              {order.deliveryType === 'delivery' ? (
                <>
                  <Truck className="h-5 w-5 text-primary" />
                  <span>Entrega</span>
                </>
              ) : (
                <>
                  <Package className="h-5 w-5 text-primary" />
                  <span>Retirada no Local</span>
                </>
              )}
            </div>
            {order.deliveryAddress && (
              <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5" />
                <span>{order.deliveryAddress}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Itens do Pedido */}
          <div>
            <h3 className="font-semibold mb-3">Itens do Pedido</h3>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-semibold">{item.menuItemName}</div>
                      {item.size && (
                        <div className="text-sm text-muted-foreground">
                          Tamanho: {item.size}
                        </div>
                      )}
                      {item.additions.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          Coberturas: {item.additions.join(', ')}
                        </div>
                      )}
                      {item.complements.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          Complementos: {item.complements.join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        Qtd: {item.quantity}
                      </div>
                      <div className="font-semibold">
                        {formatCurrency(item.totalPrice)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Observações */}
          {order.notes && (
            <>
              <div>
                <h3 className="font-semibold mb-2">Observações</h3>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </div>
              <Separator />
            </>
          )}

          {/* Resumo Financeiro */}
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(order.subtotal)}</span>
            </div>
            {order.deliveryFee && order.deliveryFee > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Taxa de Entrega</span>
                  <span className="font-medium">{formatCurrency(order.deliveryFee)}</span>
                </div>
                <Separator />
              </>
            )}
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(order.total)}</span>
            </div>
            {order.paymentMethod && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <DollarSign className="h-4 w-4" />
                <span>
                  Forma de pagamento: {
                    order.paymentMethod === 'cash' ? 'Dinheiro' :
                    order.paymentMethod === 'card' ? 'Cartão' :
                    order.paymentMethod === 'pix' ? 'PIX' : 'Outro'
                  }
                </span>
              </div>
            )}
          </div>

          {/* Informações de Tempo */}
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Pedido criado: {formatDate(orderDate)}</div>
            {order.acceptedAt && (
              <div>Aceito em: {formatDate(order.acceptedAt instanceof Date ? order.acceptedAt : new Date(order.acceptedAt))}</div>
            )}
            {order.readyAt && (
              <div>Pronto em: {formatDate(order.readyAt instanceof Date ? order.readyAt : new Date(order.readyAt))}</div>
            )}
            {order.deliveredAt && (
              <div>Entregue em: {formatDate(order.deliveredAt instanceof Date ? order.deliveredAt : new Date(order.deliveredAt))}</div>
            )}
          </div>

          {/* Ações */}
          <div className="flex gap-2 pt-4 border-t">
            {order.status === 'pending' && (
              <>
                <Button
                  onClick={() => {
                    onUpdateStatus('accepted')
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Aceitar Pedido
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Tem certeza que deseja cancelar este pedido?')) {
                      onUpdateStatus('cancelled')
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
                onClick={() => onUpdateStatus('preparing')}
                className="flex-1"
              >
                <ChefHat className="h-4 w-4 mr-2" />
                Iniciar Preparo
              </Button>
            )}
            {order.status === 'preparing' && (
              <Button
                onClick={() => onUpdateStatus('ready')}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Package className="h-4 w-4 mr-2" />
                Marcar como Pronto
              </Button>
            )}
            {order.status === 'ready' && (
              <Button
                onClick={() => onUpdateStatus('delivered')}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <Truck className="h-4 w-4 mr-2" />
                {order.deliveryType === 'delivery' ? 'Marcar como Entregue' : 'Cliente Retirou'}
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

