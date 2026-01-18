import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { createDeliveryFee, updateDeliveryFee, type DeliveryFee } from '@/lib/api/delivery-fees'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const deliveryFeeSchema = z.object({
  neighborhood: z.string().min(1, 'Nome do bairro é obrigatório'),
  fee: z.string().min(1, 'Taxa é obrigatória').refine(
    (val) => {
      const num = parseFloat(val.replace(',', '.'))
      return !isNaN(num) && num >= 0
    },
    { message: 'Taxa deve ser um número maior ou igual a zero' }
  ),
})

type DeliveryFeeFormData = z.infer<typeof deliveryFeeSchema>

interface DeliveryFeeFormProps {
  fee: DeliveryFee | null
  onClose: () => void
  onSuccess: () => void
}

export function DeliveryFeeForm({ fee, onClose, onSuccess }: DeliveryFeeFormProps) {
  const { toast } = useToast()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<DeliveryFeeFormData>({
    resolver: zodResolver(deliveryFeeSchema),
    defaultValues: {
      neighborhood: fee?.neighborhood || '',
      fee: fee ? fee.fee.toFixed(2).replace('.', ',') : '',
    },
  })

  useEffect(() => {
    if (fee) {
      reset({
        neighborhood: fee.neighborhood,
        fee: fee.fee.toFixed(2).replace('.', ','),
      })
    }
  }, [fee, reset])

  const onSubmit = async (data: DeliveryFeeFormData) => {
    try {
      const feeValue = parseFloat(data.fee.replace(',', '.'))

      if (fee) {
        await updateDeliveryFee(fee.id, {
          neighborhood: data.neighborhood.trim(),
          fee: feeValue,
        })
      } else {
        await createDeliveryFee({
          neighborhood: data.neighborhood.trim(),
          fee: feeValue,
        })
      }

      onSuccess()
    } catch (error: any) {
      console.error('Erro ao salvar taxa de entrega:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar a taxa de entrega',
        variant: 'destructive',
      })
    }
  }

  const formatCurrencyInput = (value: string): string => {
    // Remove tudo exceto números e vírgula
    const cleaned = value.replace(/[^\d,]/g, '')
    
    // Se não tem vírgula, permite números
    if (!cleaned.includes(',')) {
      return cleaned
    }

    // Se tem vírgula, permite apenas uma e máximo 2 casas decimais
    const parts = cleaned.split(',')
    if (parts.length > 2) {
      return parts[0] + ',' + parts.slice(1).join('')
    }
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + ',' + parts[1].substring(0, 2)
    }

    return cleaned
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">
            {fee ? 'Editar Taxa de Entrega' : 'Nova Taxa de Entrega'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <Label htmlFor="neighborhood" className="text-sm font-medium text-foreground">
              Bairro *
            </Label>
            <Input
              id="neighborhood"
              {...register('neighborhood')}
              placeholder="Ex: Centro, Jardim das Flores"
              className="mt-1"
              autoFocus
            />
            {errors.neighborhood && (
              <p className="mt-1 text-sm text-destructive">{errors.neighborhood.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="fee" className="text-sm font-medium text-foreground">
              Taxa de Entrega (R$) *
            </Label>
            <Input
              id="fee"
              {...register('fee', {
                onChange: (e) => {
                  const formatted = formatCurrencyInput(e.target.value)
                  e.target.value = formatted
                },
              })}
              placeholder="0,00"
              className="mt-1"
            />
            {errors.fee && (
              <p className="mt-1 text-sm text-destructive">{errors.fee.message}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : fee ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

