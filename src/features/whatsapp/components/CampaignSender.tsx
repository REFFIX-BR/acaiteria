import { useState, useMemo } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData } from '@/lib/storage/storage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Send, Loader2, MessageCircle } from 'lucide-react'
import { EvolutionAPIClient } from '@/lib/whatsapp/evolutionApi'
import type { Customer, WhatsAppConfig, WhatsAppSend, Campaign } from '@/types'

export function CampaignSender() {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { toast } = useToast()
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [selectedCampaign, setSelectedCampaign] = useState<string>('none')
  const [isSending, setIsSending] = useState(false)
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null)

  const config = useMemo(() => {
    if (!currentTenant) return null
    return getTenantData<WhatsAppConfig>(currentTenant.id, 'whatsapp_config')
  }, [currentTenant])

  const customers = useMemo(() => {
    if (!currentTenant) return []
    return getTenantData<Customer[]>(currentTenant.id, 'customers') || []
  }, [currentTenant])

  const campaigns = useMemo(() => {
    if (!currentTenant) return []
    return getTenantData<Campaign[]>(currentTenant.id, 'campaigns') || []
  }, [currentTenant])

  const whatsappCampaigns = useMemo(() => {
    return campaigns.filter((c) => c.type === 'whatsapp')
  }, [campaigns])

  const handleSelectAll = () => {
    if (selectedCustomers.length === customers.length) {
      setSelectedCustomers([])
    } else {
      setSelectedCustomers(customers.map((c) => c.id))
    }
  }

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomers((prev) =>
      prev.includes(customerId)
        ? prev.filter((id) => id !== customerId)
        : [...prev, customerId]
    )
  }

  const handleLoadCampaign = () => {
    if (!selectedCampaign || selectedCampaign === 'none') return

    const campaign = campaigns.find((c) => c.id === selectedCampaign)
    if (campaign) {
      if (campaign.description) {
        setMessage(campaign.description)
      }
      // Mostra aviso se a campanha tem imagem
      if (campaign.image) {
        toast({
          title: 'Campanha com imagem',
          description: 'A imagem da campanha será enviada junto com a mensagem',
        })
      }
    }
  }

  const handleSend = async () => {
    if (!currentTenant || !config || !config.connected) {
      toast({
        title: 'Erro',
        description: 'Configure a Evolution API primeiro',
        variant: 'destructive',
      })
      return
    }

    if (selectedCustomers.length === 0) {
      toast({
        title: 'Erro',
        description: 'Selecione pelo menos um cliente',
        variant: 'destructive',
      })
      return
    }

    if (!message.trim()) {
      toast({
        title: 'Erro',
        description: 'Digite uma mensagem',
        variant: 'destructive',
      })
      return
    }

    if (!config.instanceName) {
      toast({
        title: 'Erro',
        description: 'Configure o nome da instância',
        variant: 'destructive',
      })
      return
    }

    setIsSending(true)
    setProgress({ sent: 0, total: selectedCustomers.length })

    try {
      const client = new EvolutionAPIClient(config)
      const customersToSend = customers.filter((c) =>
        selectedCustomers.includes(c.id)
      )

      // Obter intervalo e imagem da campanha se houver uma selecionada
      let sendInterval = 15 // Padrão: 15 segundos
      let campaignImage: string | undefined
      if (selectedCampaign && selectedCampaign !== 'none') {
        const selectedCampaignData = campaigns.find((c) => c.id === selectedCampaign)
        if (selectedCampaignData) {
          if (selectedCampaignData.sendInterval) {
            sendInterval = selectedCampaignData.sendInterval
          }
          if (selectedCampaignData.image) {
            campaignImage = selectedCampaignData.image
          }
        }
      }

      console.log('[CampaignSender] Preparando envio:', {
        totalCustomers: customersToSend.length,
        hasCampaign: selectedCampaign !== 'none',
        campaignImage: campaignImage?.substring(0, 50) + (campaignImage && campaignImage.length > 50 ? '...' : ''),
        sendInterval,
        instanceName: config.instanceName,
        apiUrl: config.apiUrl,
      })

      const results = await client.sendBulkMessage(
        config.instanceName!,
        customersToSend,
        message,
        (sent, total) => {
          setProgress({ sent, total })
        },
        sendInterval,
        campaignImage // Passa a imagem da campanha se houver
      )

      console.log('[CampaignSender] Resultado do envio:', {
        sent: results.sent,
        failed: results.failed,
        total: results.results.length,
      })

      // Salva histórico de envios
      const history = getTenantData<WhatsAppSend[]>(currentTenant.id, 'whatsapp_sends') || []
      const newSends: WhatsAppSend[] = results.results.map((result) => {
        const customer = customersToSend.find((c) => c.id === result.customerId)!
        return {
          id: `send-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          campaignId: selectedCampaign && selectedCampaign !== 'none' ? selectedCampaign : undefined,
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

      // Atualiza métricas da campanha se houver
      if (selectedCampaign && selectedCampaign !== 'none') {
        const allCampaigns = getTenantData<Campaign[]>(currentTenant.id, 'campaigns') || []
        const campaignIndex = allCampaigns.findIndex((c) => c.id === selectedCampaign)
        if (campaignIndex !== -1) {
          allCampaigns[campaignIndex] = {
            ...allCampaigns[campaignIndex],
            metrics: {
              ...allCampaigns[campaignIndex].metrics,
              sent: allCampaigns[campaignIndex].metrics.sent + results.sent,
              delivered: allCampaigns[campaignIndex].metrics.delivered + results.sent,
              failed: allCampaigns[campaignIndex].metrics.failed + results.failed,
            },
          }
          setTenantData(currentTenant.id, 'campaigns', allCampaigns)
        }
      }

      toast({
        title: 'Sucesso',
        description: `${results.sent} mensagem(ns) enviada(s), ${results.failed} falha(s)`,
      })

      setMessage('')
      setSelectedCustomers([])
      setProgress(null)
    } catch (error) {
      console.error('Erro ao enviar mensagens:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao enviar mensagens',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  if (!currentTenant) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enviar Campanha WhatsApp</CardTitle>
        <CardDescription>
          Selecione clientes e envie mensagens em massa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!config?.connected && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-3">
              <MessageCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                  WhatsApp não conectado
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Configure e conecte a Evolution API na seção acima antes de enviar mensagens.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Campanha (opcional)</Label>
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma campanha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {whatsappCampaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCampaign && selectedCampaign !== 'none' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLoadCampaign}
            >
              Carregar mensagem da campanha
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Clientes ({selectedCustomers.length} selecionados)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedCustomers.length === customers.length ? 'Desselecionar Todos' : 'Selecionar Todos'}
            </Button>
          </div>
          <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
            {customers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum cliente cadastrado. Adicione clientes na página de Marketing.
              </p>
            ) : (
              customers.map((customer) => (
                <label
                  key={customer.id}
                  className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCustomers.includes(customer.id)}
                    onChange={() => handleSelectCustomer(customer.id)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">
                    {customer.name} - {customer.phone}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">Mensagem</Label>
          <Textarea
            id="message"
            placeholder="Digite sua mensagem aqui..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
          />
          <p className="text-xs text-muted-foreground">
            {message.length} caracteres
          </p>
        </div>

        {progress && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Enviando...</span>
              <span className="text-sm text-muted-foreground">
                {progress.sent} / {progress.total}
              </span>
            </div>
            <div className="w-full bg-background rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${(progress.sent / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <Button
          onClick={handleSend}
          disabled={isSending || !config?.connected || selectedCustomers.length === 0 || !message.trim()}
          className="w-full"
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Enviar Mensagens
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

