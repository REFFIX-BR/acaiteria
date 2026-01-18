import { WhatsAppConnection } from './components/WhatsAppConnection'
import { Button } from '@/components/ui/button'
import { BookOpen } from 'lucide-react'

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

          <WhatsAppConnection />
    </div>
  )
}
