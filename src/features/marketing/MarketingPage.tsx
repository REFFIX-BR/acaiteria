import { useState } from 'react'
import { CampaignForm } from './components/CampaignForm'
import { CampaignList } from './components/CampaignList'
import { LeadCapture } from './components/LeadCapture'

export default function MarketingPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleSuccess = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketing</h1>
          <p className="text-muted-foreground">
            Campanhas e captação de clientes
          </p>
        </div>
        <CampaignForm onSuccess={handleSuccess} />
      </div>

      <CampaignList refreshTrigger={refreshTrigger} onRefresh={handleSuccess} />
      <LeadCapture />
    </div>
  )
}
