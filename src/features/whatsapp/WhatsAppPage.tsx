import { WhatsAppConnection } from './components/WhatsAppConnection'
import { CampaignSender } from './components/CampaignSender'
import { SendHistory } from './components/SendHistory'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Smartphone, MessageSquare, BookOpen } from 'lucide-react'

export default function WhatsAppPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">WhatsApp Marketing</h1>
          <p className="text-muted-foreground">
            Conecte seu WhatsApp e envie campanhas personalizadas para seus clientes
          </p>
        </div>
        <Button variant="outline">
          <BookOpen className="w-4 h-4 mr-2" />
          Ver Tutorial
        </Button>
      </div>

      <Tabs defaultValue="connection" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connection">
            <Smartphone className="w-4 h-4 mr-2" />
            Conexão
          </TabsTrigger>
          <TabsTrigger value="campaigns">
            <MessageSquare className="w-4 h-4 mr-2" />
            Campanhas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="space-y-4">
          <WhatsAppConnection />
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <CampaignSender />
          <SendHistory />
        </TabsContent>
      </Tabs>
    </div>
  )
}
