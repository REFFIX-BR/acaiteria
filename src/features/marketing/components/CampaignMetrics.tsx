import { Card, CardContent } from '@/components/ui/card'
import type { Campaign } from '@/types'

interface CampaignMetricsProps {
  campaign: Campaign
}

export function CampaignMetrics({ campaign }: CampaignMetricsProps) {
  // Garantir que metrics sempre tenha valores padrão
  const metrics = campaign.metrics || {
    sent: 0,
    delivered: 0,
    failed: 0,
    clicks: 0,
    conversions: 0,
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2 border-t">
      <div className="text-center">
        <div className="text-xs text-muted-foreground">Enviados</div>
        <div className="text-lg font-semibold">{metrics.sent || 0}</div>
      </div>
      <div className="text-center">
        <div className="text-xs text-muted-foreground">Entregues</div>
        <div className="text-lg font-semibold text-green-600">{metrics.delivered || 0}</div>
      </div>
      <div className="text-center">
        <div className="text-xs text-muted-foreground">Falhas</div>
        <div className="text-lg font-semibold text-red-600">{metrics.failed || 0}</div>
      </div>
      {metrics.clicks !== undefined && metrics.clicks > 0 && (
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Cliques</div>
          <div className="text-lg font-semibold">{metrics.clicks}</div>
        </div>
      )}
      {metrics.conversions !== undefined && metrics.conversions > 0 && (
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Conversões</div>
          <div className="text-lg font-semibold text-blue-600">{metrics.conversions}</div>
        </div>
      )}
    </div>
  )
}

