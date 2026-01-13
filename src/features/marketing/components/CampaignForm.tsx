import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData } from '@/lib/storage/storage'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Plus, Edit } from 'lucide-react'
import type { Campaign } from '@/types'

const campaignSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['promotion', 'whatsapp']),
  description: z.string().optional(),
  discount: z.number().min(0).max(100).optional(),
  startDate: z.string().min(1, 'Data de início é obrigatória'),
  endDate: z.string().optional(),
})

type CampaignFormData = z.infer<typeof campaignSchema>

interface CampaignFormProps {
  campaign?: Campaign
  onSuccess?: () => void
  trigger?: React.ReactNode
}

export function CampaignForm({ campaign, onSuccess, trigger }: CampaignFormProps) {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { toast } = useToast()
  const [open, setOpen] = useState(false)

  // Função auxiliar para converter Date ou string para formato de input date
  const formatDateForInput = (date: Date | string | undefined): string => {
    if (!date) return ''
    if (date instanceof Date) {
      return date.toISOString().split('T')[0]
    }
    if (typeof date === 'string') {
      // Se já é uma string no formato ISO ou date input, retorna
      if (date.includes('T')) {
        return date.split('T')[0]
      }
      return date
    }
    return ''
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: campaign
      ? {
          name: campaign.name,
          type: campaign.type,
          description: campaign.description || '',
          discount: campaign.discount,
          startDate: formatDateForInput(campaign.startDate),
          endDate: formatDateForInput(campaign.endDate),
        }
      : {
          type: 'promotion',
          startDate: new Date().toISOString().split('T')[0],
        },
  })

  const campaignType = watch('type')

  useEffect(() => {
    if (campaign) {
      setValue('name', campaign.name)
      setValue('type', campaign.type)
      setValue('description', campaign.description || '')
      setValue('discount', campaign.discount)
      setValue('startDate', formatDateForInput(campaign.startDate))
      setValue('endDate', formatDateForInput(campaign.endDate))
    }
  }, [campaign, setValue])

  const onSubmit = async (data: CampaignFormData) => {
    if (!currentTenant) {
      toast({
        title: 'Erro',
        description: 'Tenant não encontrado',
        variant: 'destructive',
      })
      return
    }

    try {
      const campaigns = getTenantData<Campaign[]>(currentTenant.id, 'campaigns') || []

      if (campaign) {
        // Editar campanha existente
        const index = campaigns.findIndex((c) => c.id === campaign.id)
        if (index !== -1) {
          campaigns[index] = {
            ...campaign,
            name: data.name,
            type: data.type,
            description: data.description,
            discount: data.discount,
            startDate: new Date(data.startDate),
            endDate: data.endDate ? new Date(data.endDate) : undefined,
          }
        }
      } else {
        // Criar nova campanha
        const newCampaign: Campaign = {
          id: `campaign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: data.name,
          type: data.type,
          status: 'active',
          description: data.description,
          discount: data.discount,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          metrics: {
            sent: 0,
            delivered: 0,
            failed: 0,
            clicks: 0,
            conversions: 0,
          },
          createdAt: new Date(),
        }
        campaigns.push(newCampaign)
      }

      setTenantData(currentTenant.id, 'campaigns', campaigns)

      toast({
        title: 'Sucesso',
        description: campaign ? 'Campanha atualizada com sucesso' : 'Campanha criada com sucesso',
      })

      reset()
      setOpen(false)
      onSuccess?.()
    } catch (error) {
      console.error('Erro ao salvar campanha:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao salvar campanha',
        variant: 'destructive',
      })
    }
  }

  const defaultTrigger = campaign ? (
    <Button variant="ghost" size="icon">
      <Edit className="h-4 w-4" />
    </Button>
  ) : (
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      Nova Campanha
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{campaign ? 'Editar Campanha' : 'Nova Campanha'}</DialogTitle>
          <DialogDescription>
            {campaign ? 'Atualize as informações da campanha' : 'Crie uma nova campanha promocional'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Campanha</Label>
            <Input
              id="name"
              placeholder="Ex: Promoção de Verão"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <select
              id="type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register('type')}
            >
              <option value="promotion">Promoção</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <textarea
              id="description"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Descreva a campanha..."
              {...register('description')}
            />
          </div>

          {campaignType === 'promotion' && (
            <div className="space-y-2">
              <Label htmlFor="discount">Desconto (%)</Label>
              <Input
                id="discount"
                type="number"
                min="0"
                max="100"
                placeholder="0"
                {...register('discount', { valueAsNumber: true })}
              />
              {errors.discount && (
                <p className="text-sm text-destructive">{errors.discount.message}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data de Início</Label>
              <Input
                id="startDate"
                type="date"
                {...register('startDate')}
              />
              {errors.startDate && (
                <p className="text-sm text-destructive">{errors.startDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Data de Término (opcional)</Label>
              <Input
                id="endDate"
                type="date"
                {...register('endDate')}
              />
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

