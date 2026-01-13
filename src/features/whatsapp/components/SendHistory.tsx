import { useMemo } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData } from '@/lib/storage/storage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { useState } from 'react'
import type { WhatsAppSend } from '@/types'

export function SendHistory() {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'delivered' | 'failed' | 'pending'>('all')

  const sends = useMemo(() => {
    if (!currentTenant) return []
    
    let filtered = getTenantData<WhatsAppSend[]>(currentTenant.id, 'whatsapp_sends') || []

    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => s.status === statusFilter)
    }

    // Ordena por data (mais recente primeiro)
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [currentTenant, statusFilter])

  const getStatusIcon = (status: WhatsAppSend['status']) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return null
    }
  }

  const getStatusLabel = (status: WhatsAppSend['status']) => {
    switch (status) {
      case 'sent':
        return 'Enviado'
      case 'delivered':
        return 'Entregue'
      case 'failed':
        return 'Falhou'
      case 'pending':
        return 'Pendente'
      default:
        return status
    }
  }

  if (!currentTenant) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Envios</CardTitle>
        <CardDescription>
          Visualize o histórico de mensagens enviadas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="sent">Enviados</SelectItem>
            <SelectItem value="delivered">Entregues</SelectItem>
            <SelectItem value="failed">Falhas</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
          </SelectContent>
        </Select>

        {sends.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum envio registrado
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sends.slice(0, 50).map((send) => (
                  <TableRow key={send.id}>
                    <TableCell>
                      {send.sentAt
                        ? format(new Date(send.sentAt), 'dd/MM/yyyy HH:mm')
                        : format(new Date(send.createdAt), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{send.phone}</TableCell>
                    <TableCell className="max-w-md truncate">{send.message}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(send.status)}
                        <span className="text-sm">{getStatusLabel(send.status)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {send.error || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {sends.length > 50 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Mostrando 50 de {sends.length} envios
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

