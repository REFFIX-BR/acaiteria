import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Check, Copy, Download, Loader2 } from 'lucide-react'

interface PaymentInstructionsProps {
  orderId: string
  paymentMethod: 'pix' | 'boleto'
  paymentInstructions: {
    pix?: {
      qrcodeImage?: string | null
      pixCode?: string | null
    }
    boleto?: {
      digitableLine?: string | null
      url?: string | null
      pdfUrl?: string | null
    }
  }
  onPaymentConfirmed: () => void
}

export function PaymentInstructions({
  orderId,
  paymentMethod,
  paymentInstructions,
  onPaymentConfirmed,
}: PaymentInstructionsProps) {
  const { toast } = useToast()
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'cancelled'>('pending')
  const [isPolling, setIsPolling] = useState(true)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'

  // Polling para verificar status do pagamento
  useEffect(() => {
    if (!isPolling || paymentStatus !== 'pending') return

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${apiUrl}/api/payment/orders/${orderId}/status`)
        
        if (!response.ok) {
          console.error('Erro ao verificar status:', response.statusText)
          return
        }

        const data = await response.json()

        if (data.status === 'paid') {
          setPaymentStatus('paid')
          setIsPolling(false)
          onPaymentConfirmed()
        } else if (data.status === 'cancelled' || data.status === 'expired' || data.status === 'failed') {
          setPaymentStatus('cancelled')
          setIsPolling(false)
        }
      } catch (error) {
        console.error('Erro ao verificar status do pagamento:', error)
      }
    }, 5000) // Verifica a cada 5 segundos

    return () => clearInterval(interval)
  }, [orderId, isPolling, paymentStatus, apiUrl, onPaymentConfirmed])

  const handleCopyPixCode = async () => {
    if (paymentInstructions.pix?.pixCode) {
      try {
        await navigator.clipboard.writeText(paymentInstructions.pix.pixCode)
        toast({
          title: 'Código copiado!',
          description: 'Código PIX copiado para a área de transferência',
        })
      } catch (error) {
        toast({
          title: 'Erro ao copiar',
          description: 'Não foi possível copiar o código',
          variant: 'destructive',
        })
      }
    }
  }

  const handleCopyBoleto = async () => {
    if (paymentInstructions.boleto?.digitableLine) {
      try {
        await navigator.clipboard.writeText(paymentInstructions.boleto.digitableLine)
        toast({
          title: 'Linha digitável copiada!',
          description: 'Linha digitável copiada para a área de transferência',
        })
      } catch (error) {
        toast({
          title: 'Erro ao copiar',
          description: 'Não foi possível copiar a linha digitável',
          variant: 'destructive',
        })
      }
    }
  }

  const handleDownloadBoleto = () => {
    if (paymentInstructions.boleto?.pdfUrl) {
      window.open(paymentInstructions.boleto.pdfUrl, '_blank')
    } else if (paymentInstructions.boleto?.url) {
      window.open(paymentInstructions.boleto.url, '_blank')
    }
  }

  if (paymentStatus === 'paid') {
    return (
      <Card className="border-green-500 bg-green-500/10">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 text-center justify-center py-8">
            <div className="p-3 rounded-full bg-green-500">
              <Check className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-green-600 mb-2">Pagamento Confirmado!</h3>
              <p className="text-muted-foreground">
                Sua assinatura foi ativada com sucesso. Redirecionando...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (paymentMethod === 'pix') {
    const pixCode = paymentInstructions.pix?.pixCode
    const qrcodeImage = paymentInstructions.pix?.qrcodeImage

    return (
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Pagamento via PIX</h3>
            <p className="text-sm text-muted-foreground">
              Escaneie o QR Code ou copie o código para realizar o pagamento
            </p>
          </div>

          {/* QR Code */}
          {pixCode && (
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-lg border-2 border-dashed">
                {qrcodeImage ? (
                  <img
                    src={qrcodeImage}
                    alt="QR Code PIX"
                    className="w-64 h-64"
                  />
                ) : (
                  <QRCodeSVG value={pixCode} size={256} level="H" />
                )}
              </div>
            </div>
          )}

          {/* Código PIX */}
          {pixCode && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Código PIX</Label>
              <div className="flex gap-2">
                <Input
                  value={pixCode}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyPixCode}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Status de aguardando pagamento */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            {isPolling && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Aguardando confirmação do pagamento...</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (paymentMethod === 'boleto') {
    const digitableLine = paymentInstructions.boleto?.digitableLine
    const pdfUrl = paymentInstructions.boleto?.pdfUrl || paymentInstructions.boleto?.url

    return (
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Boleto Bancário</h3>
            <p className="text-sm text-muted-foreground">
              Copie a linha digitável ou baixe o boleto para pagar
            </p>
          </div>

          {/* Linha Digitável */}
          {digitableLine && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Linha Digitável</Label>
              <div className="flex gap-2">
                <Input
                  value={digitableLine}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyBoleto}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Botão para baixar boleto */}
          {pdfUrl && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleDownloadBoleto}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar Boleto PDF
            </Button>
          )}

          {/* Status de aguardando pagamento */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            {isPolling && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Aguardando confirmação do pagamento (pode levar até 2 dias úteis)...</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}

