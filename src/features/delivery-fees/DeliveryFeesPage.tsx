import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { DeliveryFeeList } from './components/DeliveryFeeList'
import { DeliveryFeeForm } from './components/DeliveryFeeForm'
import { getDeliveryFees, type DeliveryFee } from '@/lib/api/delivery-fees'

export default function DeliveryFeesPage() {
  const { toast } = useToast()
  const [deliveryFees, setDeliveryFees] = useState<DeliveryFee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingFee, setEditingFee] = useState<DeliveryFee | null>(null)

  const loadDeliveryFees = async () => {
    setIsLoading(true)
    try {
      const fees = await getDeliveryFees()
      setDeliveryFees(fees)
    } catch (error) {
      console.error('Erro ao carregar taxas de entrega:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as taxas de entrega',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDeliveryFees()
  }, [])

  const handleCreate = () => {
    setEditingFee(null)
    setIsFormOpen(true)
  }

  const handleEdit = (fee: DeliveryFee) => {
    setEditingFee(fee)
    setIsFormOpen(true)
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setEditingFee(null)
  }

  const handleFormSuccess = () => {
    loadDeliveryFees()
    handleFormClose()
    toast({
      title: 'Sucesso',
      description: editingFee ? 'Taxa atualizada com sucesso' : 'Taxa criada com sucesso',
    })
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Taxa de Entrega</h1>
          <p className="text-muted-foreground mt-1">
            Configure os bairros e suas respectivas taxas de entrega
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Adicionar Bairro
        </button>
      </div>

      {/* Lista de Taxas */}
      <DeliveryFeeList
        deliveryFees={deliveryFees}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={loadDeliveryFees}
      />

      {/* Formulário Modal */}
      {isFormOpen && (
        <DeliveryFeeForm
          fee={editingFee}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  )
}

