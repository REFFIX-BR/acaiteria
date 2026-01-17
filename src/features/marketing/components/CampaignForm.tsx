import { useState, useEffect, useRef } from 'react'
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
import { Plus, Edit, Upload, Image as ImageIcon, X } from 'lucide-react'
import type { Campaign, Customer, WhatsAppConfig, WhatsAppSend } from '@/types'

const campaignSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['promotion', 'whatsapp']),
  description: z.string().optional(),
  discount: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return undefined
      if (typeof val === 'number') return isNaN(val) ? undefined : val
      if (typeof val === 'string') {
        const num = parseFloat(val)
        return isNaN(num) ? undefined : num
      }
      return undefined
    },
    z.number().min(0).max(100).optional()
  ),
  startDate: z.string().min(1, 'Data de início é obrigatória'),
  endDate: z.preprocess(
    (val) => val === '' ? undefined : val,
    z.string().optional()
  ),
  image: z.preprocess(
    (val) => val === '' ? undefined : val,
    z.string().optional()
  ),
  sendInterval: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return 15
      if (typeof val === 'number') {
        return isNaN(val) ? 15 : Math.max(15, val)
      }
      if (typeof val === 'string') {
        const num = parseInt(val, 10)
        return isNaN(num) ? 15 : Math.max(15, num)
      }
      return 15
    },
    z.number().min(15, 'O intervalo mínimo é de 15 segundos').default(15)
  ),
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
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
          image: campaign.image || '',
          sendInterval: campaign.sendInterval || 15,
        }
      : {
          type: 'promotion',
          startDate: new Date().toISOString().split('T')[0],
          image: '',
          sendInterval: 15,
        },
  })

  const campaignType = watch('type')

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentTenant) return

    // Valida tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione uma imagem válida',
        variant: 'destructive',
      })
      return
    }

    // Valida tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Erro',
        description: 'A imagem deve ter no máximo 5MB',
        variant: 'destructive',
      })
      return
    }

    setIsUploadingImage(true)
    setSelectedImageFile(file)

    try {
      // Preview local imediato
      const reader = new FileReader()
      reader.onload = (event) => {
        const previewUrl = event.target?.result as string
        setImagePreview(previewUrl)
      }
      reader.readAsDataURL(file)

      // Fazer upload para MinIO
      console.log('[CampaignForm] Iniciando upload de imagem:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        tenantId: currentTenant.id,
        tenantSlug: currentTenant.slug,
      })

      const { uploadImage } = await import('@/lib/api/upload')
      const imageUrl = await uploadImage(file, 'campaign', {
        tenantId: currentTenant.id,
        tenantSlug: currentTenant.slug,
      })

      console.log('[CampaignForm] Upload concluído, URL recebida:', imageUrl)
      
      // Atualiza o preview com a URL do MinIO
      setImagePreview(imageUrl)
      setValue('image', imageUrl)
    } catch (error) {
      console.error('[CampaignForm] Erro ao fazer upload:', error)
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao fazer upload da imagem',
        variant: 'destructive',
      })
      setSelectedImageFile(null)
      setImagePreview(null)
      setValue('image', '')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleRemoveImage = () => {
    setImagePreview(null)
    setSelectedImageFile(null)
    setValue('image', '')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  useEffect(() => {
    if (campaign) {
      setValue('name', campaign.name)
      setValue('type', campaign.type)
      setValue('description', campaign.description || '')
      setValue('discount', campaign.discount)
      setValue('startDate', formatDateForInput(campaign.startDate))
      setValue('endDate', formatDateForInput(campaign.endDate))
      setValue('image', campaign.image || '')
      setValue('sendInterval', campaign.sendInterval || 15)
      setImagePreview(campaign.image || null)
    } else {
      setImagePreview(null)
      setSelectedImageFile(null)
    }
  }, [campaign, setValue])

  const onSubmit = async (data: CampaignFormData) => {
    console.log('[CampaignForm] onSubmit chamado:', data)
    
    if (!currentTenant) {
      toast({
        title: 'Erro',
        description: 'Tenant não encontrado',
        variant: 'destructive',
      })
      return
    }

    try {
      console.log('[CampaignForm] Iniciando salvamento da campanha...')
      // Se há um arquivo selecionado mas ainda não foi feito upload, fazer agora
      let finalImageUrl = data.image
      if (selectedImageFile && imagePreview && imagePreview.startsWith('data:')) {
        console.log('[CampaignForm] Fazendo upload antes de salvar...')
        setIsUploadingImage(true)
        
        try {
          const { uploadImage } = await import('@/lib/api/upload')
          finalImageUrl = await uploadImage(selectedImageFile, 'campaign', {
            tenantId: currentTenant.id,
            tenantSlug: currentTenant.slug,
          })
          setImagePreview(finalImageUrl)
          setSelectedImageFile(null)
        } catch (uploadError) {
          console.error('[CampaignForm] Erro ao fazer upload:', uploadError)
          throw uploadError
        } finally {
          setIsUploadingImage(false)
        }
      }

      const campaigns = getTenantData<Campaign[]>(currentTenant.id, 'campaigns') || []
      let tempId: string | undefined

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
            endDate: data.endDate && data.endDate !== '' ? new Date(data.endDate) : undefined,
            image: finalImageUrl || undefined,
            sendInterval: typeof data.sendInterval === 'string' 
              ? (data.sendInterval === '' ? 15 : parseInt(data.sendInterval, 10) || 15)
              : (data.sendInterval || 15),
          }
        }
      } else {
        // Criar nova campanha
        tempId = `campaign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const newCampaign: Campaign = {
          id: tempId,
          name: data.name,
          type: data.type,
          status: 'active',
          description: data.description,
          discount: data.discount,
          startDate: new Date(data.startDate),
          endDate: data.endDate && data.endDate !== '' ? new Date(data.endDate) : undefined,
          image: finalImageUrl || undefined,
          sendInterval: typeof data.sendInterval === 'string' 
            ? (data.sendInterval === '' ? 15 : parseInt(data.sendInterval, 10) || 15)
            : (data.sendInterval || 15),
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

      // Salvar no backend
      try {
        const { getApiUrl } = await import('@/lib/api/config')
        const { getAuthToken } = await import('@/lib/api/auth')
        const apiUrl = getApiUrl()
        const token = getAuthToken()

        if (token) {
          // Normalizar sendInterval para número
          const sendInterval = typeof data.sendInterval === 'string' 
            ? (data.sendInterval === '' ? 15 : parseInt(data.sendInterval, 10) || 15)
            : (data.sendInterval || 15)

          const payload = {
            name: data.name,
            type: data.type,
            description: data.description || undefined,
            discount: data.discount,
            startDate: data.startDate,
            endDate: data.endDate || undefined,
            image: finalImageUrl || undefined,
            sendInterval: sendInterval >= 15 ? sendInterval : 15,
          }

          console.log('[CampaignForm] Payload para backend:', payload)

          if (campaign) {
            // Atualizar campanha existente
            const response = await fetch(`${apiUrl}/api/campaigns/${campaign.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(payload),
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              throw new Error(errorData.error || `Erro ao atualizar campanha: ${response.status}`)
            }
          } else {
            // Criar nova campanha
            const response = await fetch(`${apiUrl}/api/campaigns`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(payload),
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              throw new Error(errorData.error || `Erro ao criar campanha: ${response.status}`)
            }

            const result = await response.json()
            // Atualizar o ID da campanha criada no localStorage com o ID do backend
            if (result.id) {
              const index = campaigns.findIndex((c) => c.id === tempId)
              if (index !== -1) {
                campaigns[index].id = result.id
              }
            }
          }
        }
      } catch (error) {
        console.error('[CampaignForm] Erro ao salvar campanha no backend:', error)
        // Continua para salvar no localStorage mesmo se falhar no backend
      }

      setTenantData(currentTenant.id, 'campaigns', campaigns)

      console.log('[CampaignForm] Campanha salva com sucesso')

      // Se for campanha WhatsApp ou Promoção e status ativo, enviar automaticamente para todos os clientes
      if ((data.type === 'whatsapp' || data.type === 'promotion') && (!campaign || campaign.status === 'active')) {
        try {
          console.log('[CampaignForm] Iniciando envio automático da campanha WhatsApp...')
          
          // Buscar configuração do WhatsApp
          const whatsappConfig = getTenantData<WhatsAppConfig>(currentTenant.id, 'whatsapp_config')
          
          console.log('[CampaignForm] Verificando configuração WhatsApp:', {
            hasConfig: !!whatsappConfig,
            apiUrl: whatsappConfig?.apiUrl,
            hasApiKey: !!whatsappConfig?.apiKey,
            instanceName: whatsappConfig?.instanceName,
            connected: whatsappConfig?.connected,
          })
          
          // Verificar se tem configuração mínima necessária (apiUrl, apiKey, instanceName)
          if (!whatsappConfig || !whatsappConfig.apiUrl || !whatsappConfig.apiKey || !whatsappConfig.instanceName) {
            console.warn('[CampaignForm] WhatsApp não configurado completamente')
            toast({
              title: 'Aviso',
              description: 'Campanha salva, mas WhatsApp não está configurado completamente. Configure o WhatsApp para enviar automaticamente.',
              variant: 'default',
            })
          } else {
            // Buscar todos os clientes
            const allCustomers = getTenantData<Customer[]>(currentTenant.id, 'customers') || []
            
            if (allCustomers.length === 0) {
              console.warn('[CampaignForm] Nenhum cliente cadastrado')
              toast({
                title: 'Aviso',
                description: 'Campanha salva, mas não há clientes cadastrados para enviar.',
                variant: 'default',
              })
            } else {
              // Enviar campanha automaticamente
              const { EvolutionAPIClient } = await import('@/lib/whatsapp/evolutionApi')
              const client = new EvolutionAPIClient(whatsappConfig)
              
              const sendInterval = data.sendInterval || 15
              
              // Montar mensagem com informações da campanha
              let message = data.description || ''
              
              // Se for promoção, adicionar informação de desconto
              if (data.type === 'promotion' && data.discount) {
                const discountText = `🎉 Promoção: ${data.discount}% de desconto!\n\n`
                message = discountText + (message || 'Confira nossa promoção especial!')
              }
              
              // Adicionar nome da campanha se houver
              if (data.name) {
                message = `📢 ${data.name}\n\n${message}`
              }
              
              const imageUrl = finalImageUrl || undefined
              
              console.log('[CampaignForm] Enviando para', allCustomers.length, 'clientes...')
              
              // Enviar em background (não bloquear a UI)
              client.sendBulkMessage(
                whatsappConfig.instanceName,
                allCustomers,
                message,
                undefined, // Sem callback de progresso para não bloquear
                sendInterval,
                imageUrl
              ).then((results) => {
                console.log('[CampaignForm] Envio automático concluído:', {
                  sent: results.sent,
                  failed: results.failed,
                  total: results.results.length,
                })
                
                // Atualizar métricas da campanha
                const updatedCampaigns = getTenantData<Campaign[]>(currentTenant.id, 'campaigns') || []
                const campaignIndex = updatedCampaigns.findIndex((c) => 
                  c.id === (campaign?.id || tempId)
                )
                
                if (campaignIndex !== -1) {
                  updatedCampaigns[campaignIndex] = {
                    ...updatedCampaigns[campaignIndex],
                    metrics: {
                      ...updatedCampaigns[campaignIndex].metrics,
                      sent: updatedCampaigns[campaignIndex].metrics.sent + results.sent,
                      delivered: updatedCampaigns[campaignIndex].metrics.delivered + results.sent,
                      failed: updatedCampaigns[campaignIndex].metrics.failed + results.failed,
                    },
                  }
                  setTenantData(currentTenant.id, 'campaigns', updatedCampaigns)
                }
                
                // Salvar histórico de envios
                const history = getTenantData<WhatsAppSend[]>(currentTenant.id, 'whatsapp_sends') || []
                const newSends: WhatsAppSend[] = results.results.map((result) => {
                  const customer = allCustomers.find((c) => c.id === result.customerId)!
                  return {
                    id: `send-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    campaignId: campaign?.id || tempId,
                    customerId: customer.id,
                    phone: customer.phone,
                    message,
                    status: result.success ? 'sent' : 'failed',
                    sentAt: result.success ? new Date() : undefined,
                    error: result.error,
                    createdAt: new Date(),
                  }
                })
                setTenantData(currentTenant.id, 'whatsapp_sends', [...history, ...newSends])
                
                toast({
                  title: 'Campanha enviada!',
                  description: `${results.sent} mensagem(ns) enviada(s) para ${allCustomers.length} cliente(s)`,
                })
              }).catch((error) => {
                console.error('[CampaignForm] Erro ao enviar campanha automaticamente:', error)
                toast({
                  title: 'Erro no envio',
                  description: 'Campanha salva, mas houve erro ao enviar mensagens. Tente novamente.',
                  variant: 'destructive',
                })
              })
            }
          }
        } catch (error) {
          console.error('[CampaignForm] Erro ao preparar envio automático:', error)
          // Não bloquear o salvamento da campanha se houver erro no envio
        }
      }

      toast({
        title: 'Sucesso',
        description: campaign ? 'Campanha atualizada com sucesso' : 'Campanha criada com sucesso',
      })

      reset()
      setImagePreview(null)
      setSelectedImageFile(null)
      setOpen(false)
      onSuccess?.()
    } catch (error) {
      console.error('[CampaignForm] Erro ao salvar campanha:', error)
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao salvar campanha',
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
        <form 
          onSubmit={handleSubmit(
            onSubmit,
            (errors) => {
              console.error('[CampaignForm] Erros de validação:', errors)
              toast({
                title: 'Erro de validação',
                description: 'Por favor, verifique os campos do formulário',
                variant: 'destructive',
              })
            }
          )} 
          className="space-y-4"
        >
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

          <div className="space-y-2">
            <Label htmlFor="image">Imagem da Campanha (opcional)</Label>
            <div className="space-y-2">
              {imagePreview ? (
                <div className="relative group">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 w-full object-cover rounded-md border"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="h-32 w-full border-2 border-dashed rounded-md bg-muted flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploadingImage ? 'Enviando...' : imagePreview ? 'Alterar Imagem' : 'Carregar Imagem'}
                </Button>
                {imagePreview && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remover
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: JPG, PNG, GIF, WebP. Tamanho máximo: 5MB
              </p>
            </div>
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

          <div className="space-y-2">
            <Label htmlFor="sendInterval">
              Intervalo de Disparo (segundos)
            </Label>
            <Input
              id="sendInterval"
              type="number"
              min="15"
              placeholder="15"
              {...register('sendInterval', { 
                valueAsNumber: false,
                setValueAs: (value) => {
                  if (value === '' || value === undefined || value === null) return 15
                  const num = typeof value === 'string' ? parseInt(value, 10) : value
                  return isNaN(num) ? 15 : Math.max(15, num)
                }
              })}
            />
            {errors.sendInterval && (
              <p className="text-sm text-destructive">{errors.sendInterval.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Intervalo mínimo: 15 segundos. Tempo de espera entre cada envio de mensagem para cada cliente.
            </p>
          </div>

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
            <Button type="submit" disabled={isSubmitting || isUploadingImage}>
              {isSubmitting || isUploadingImage ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

