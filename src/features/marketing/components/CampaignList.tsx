import { useState, useMemo, useEffect } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData } from '@/lib/storage/storage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CampaignForm } from './CampaignForm'
import { CampaignMetrics } from './CampaignMetrics'
import { useToast } from '@/hooks/use-toast'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { Trash2, Megaphone, MessageCircle } from 'lucide-react'
import { format } from 'date-fns'
import type { Campaign } from '@/types'

interface CampaignListProps {
  refreshTrigger?: number
  onRefresh?: () => void
}

export function CampaignList({ refreshTrigger, onRefresh }: CampaignListProps) {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'completed'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'promotion' | 'whatsapp'>('all')

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Buscar campanhas do backend
  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!currentTenant) {
        setCampaigns([])
        setIsLoading(false)
        return
      }

      try {
        const { getApiUrl } = await import('@/lib/api/config')
        const { getAuthToken } = await import('@/lib/api/auth')
        const apiUrl = getApiUrl()
        const token = getAuthToken()

        if (!token) {
          setCampaigns([])
          setIsLoading(false)
          return
        }

        const response = await fetch(`${apiUrl}/api/campaigns`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setCampaigns(data.campaigns || [])
        } else {
          console.error('[CampaignList] Erro ao buscar campanhas:', response.status)
          setCampaigns([])
        }
      } catch (error) {
        console.error('[CampaignList] Erro ao buscar campanhas:', error)
        setCampaigns([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchCampaigns()
  }, [currentTenant, refreshTrigger])

  const filteredCampaigns = useMemo(() => {
    let filtered = [...campaigns]

    if (statusFilter !== 'all') {
      filtered = filtered.filter((c) => c.status === statusFilter)
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((c) => c.type === typeFilter)
    }

    // Ordena por data de criação (mais recente primeiro)
    return filtered.sort((a, b) => {
      // Backend retorna created_at, frontend pode usar createdAt
      const campaignA = a as Campaign & { created_at?: string }
      const campaignB = b as Campaign & { created_at?: string }
      const dateA = campaignA.created_at ? new Date(campaignA.created_at).getTime() : (campaignA.createdAt ? new Date(campaignA.createdAt).getTime() : 0)
      const dateB = campaignB.created_at ? new Date(campaignB.created_at).getTime() : (campaignB.createdAt ? new Date(campaignB.createdAt).getTime() : 0)
      return dateB - dateA
    })
  }, [campaigns, statusFilter, typeFilter])

  const handleDelete = async (id: string) => {
    if (!currentTenant) return

    confirm(
      'Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita.',
      async () => {
        try {
          const { getApiUrl } = await import('@/lib/api/config')
          const { getAuthToken } = await import('@/lib/api/auth')
          const apiUrl = getApiUrl()
          const token = getAuthToken()

          if (!token) {
            throw new Error('Não autenticado')
          }

          const response = await fetch(`${apiUrl}/api/campaigns/${id}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          if (!response.ok) {
            throw new Error('Erro ao excluir campanha')
          }

          // Atualizar lista local removendo a campanha deletada
          setCampaigns(prev => prev.filter(c => c.id !== id))

          toast({
            title: 'Sucesso',
            description: 'Campanha excluída com sucesso',
          })

          // Atualiza a lista em tempo real
          onRefresh?.()
        } catch (error) {
          console.error('Erro ao excluir campanha:', error)
          toast({
            title: 'Erro',
            description: 'Erro ao excluir campanha',
            variant: 'destructive',
          })
        }
      },
      {
        title: 'Excluir campanha',
        variant: 'destructive',
        confirmText: 'Excluir',
      }
    )
  }

  const handleToggleStatus = (campaign: Campaign) => {
    if (!currentTenant) return

    try {
      const allCampaigns = getTenantData<Campaign[]>(currentTenant.id, 'campaigns') || []
      const index = allCampaigns.findIndex((c) => c.id === campaign.id)
      if (index !== -1) {
        const newStatus = campaign.status === 'active' ? 'paused' : 'active'
        allCampaigns[index] = {
          ...campaign,
          status: newStatus,
        }
        setTenantData(currentTenant.id, 'campaigns', allCampaigns)
        
        toast({
          title: 'Sucesso',
          description: `Campanha ${newStatus === 'active' ? 'ativada' : 'pausada'}`,
        })
        
        // Atualiza a lista em tempo real
        onRefresh?.()
      }
    } catch (error) {
      console.error('Erro ao atualizar campanha:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar status da campanha',
        variant: 'destructive',
      })
    }
  }

  if (!currentTenant) {
    return null
  }

  const getStatusBadge = (status: Campaign['status']) => {
    switch (status) {
      case 'active':
        return <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-950/20 px-2 py-1 rounded">Ativa</span>
      case 'paused':
        return <span className="text-xs font-medium text-orange-600 bg-orange-50 dark:bg-orange-950/20 px-2 py-1 rounded">Pausada</span>
      case 'completed':
        return <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">Concluída</span>
      default:
        return null
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Campanhas</CardTitle>
          <CardDescription>
            Gerencie suas campanhas promocionais e de marketing
          </CardDescription>
        </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid gap-4 md:grid-cols-2">
          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="paused">Pausadas</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="promotion">Promoção</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de campanhas */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Carregando campanhas...
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma campanha cadastrada
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="p-4 border rounded-lg space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {campaign.type === 'promotion' ? (
                        <Megaphone className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <h3 className="font-semibold">{campaign.name}</h3>
                      {getStatusBadge(campaign.status)}
                    </div>
                    {campaign.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {campaign.description}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground">
                      <span>
                        Início: {format(new Date(campaign.startDate), 'dd/MM/yyyy')}
                      </span>
                      {campaign.endDate && (
                        <span className="ml-4">
                          Término: {format(new Date(campaign.endDate), 'dd/MM/yyyy')}
                        </span>
                      )}
                      {campaign.discount && (
                        <span className="ml-4 font-medium text-green-600">
                          Desconto: {campaign.discount}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleStatus(campaign)}
                    >
                      {campaign.status === 'active' ? 'Pausar' : 'Ativar'}
                    </Button>
                    <CampaignForm campaign={campaign} />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(campaign.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <CampaignMetrics campaign={campaign} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    {ConfirmDialogComponent}
    </>
  )
}

