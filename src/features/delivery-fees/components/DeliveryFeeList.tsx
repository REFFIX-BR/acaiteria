import { useState } from 'react'
import { Edit, Trash2, Search } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteDeliveryFee, type DeliveryFee } from '@/lib/api/delivery-fees'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

interface DeliveryFeeListProps {
  deliveryFees: DeliveryFee[]
  isLoading: boolean
  onEdit: (fee: DeliveryFee) => void
  onDelete: () => void
}

export function DeliveryFeeList({
  deliveryFees,
  isLoading,
  onEdit,
  onDelete,
}: DeliveryFeeListProps) {
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const [searchTerm, setSearchTerm] = useState('')

  const filteredFees = deliveryFees.filter((fee) =>
    fee.neighborhood.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDelete = (fee: DeliveryFee) => {
    confirm(
      `Tem certeza que deseja excluir a taxa de entrega para o bairro "${fee.neighborhood}"?`,
      async () => {
        try {
          await deleteDeliveryFee(fee.id)
          toast({
            title: 'Sucesso',
            description: 'Taxa de entrega excluída com sucesso',
          })
          onDelete()
        } catch (error) {
          console.error('Erro ao excluir taxa de entrega:', error)
          toast({
            title: 'Erro',
            description: 'Não foi possível excluir a taxa de entrega',
            variant: 'destructive',
          })
        }
      },
      {
        title: 'Excluir Taxa de Entrega',
        confirmText: 'Excluir',
        cancelText: 'Cancelar',
        variant: 'destructive',
      }
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  return (
    <>
      {ConfirmDialogComponent}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por bairro..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Tabela */}
      {filteredFees.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchTerm
            ? 'Nenhum bairro encontrado com esse termo'
            : 'Nenhuma taxa de entrega configurada. Clique em "Adicionar Bairro" para começar.'}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Bairro
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Taxa de Entrega
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-background divide-y divide-border">
              {filteredFees.map((fee) => (
                <tr key={fee.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-foreground">{fee.neighborhood}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-foreground">{formatCurrency(fee.fee)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(fee)}
                        className="text-primary hover:text-primary/80 transition-colors"
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(fee)}
                        className="text-destructive hover:text-destructive/80 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

