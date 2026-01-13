import { Card, CardContent } from '@/components/ui/card'
import type { Campaign } from '@/types'

interface CampaignMetricsProps {
  campaign: Campaign
}

export function CampaignMetrics({ campaign }: CampaignMetricsProps) {
  const metrics = campaign.metrics

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2 border-t">
      <div className="text-center">
        <div className="text-xs text-muted-foreground">Enviados</div>
        <div className="text-lg font-semibold">{metrics.sent}</div>
      </div>
      <div className="text-center">
        <div className="text-xs text-muted-foreground">Entregues</div>
        <div className="text-lg font-semibold text-green-600">{metrics.delivered}</div>
      </div>
      <div className="text-center">
        <div className="text-xs text-muted-foreground">Falhas</div>
        <div className="text-lg font-semibold text-red-600">{metrics.failed}</div>
      </div>
      {metrics.clicks !== undefined && (
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Cliques</div>
          <div className="text-lg font-semibold">{metrics.clicks}</div>
        </div>
      )}
      {metrics.conversions !== undefined && (
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Conversões</div>
          <div className="text-lg font-semibold text-blue-600">{metrics.conversions}</div>
        </div>
      )}
    </div>
  )
}

