import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Lock, Shield } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useTenantStore } from '@/stores/tenantStore'
import { PaymentInstructions } from './PaymentInstructions'
import { getApiUrl } from '@/lib/api/config'

interface CheckoutModalProps {
  open: boolean
  onClose: () => void
  planName: string
  planPrice: number
  planType: 'basic' | 'premium' | 'enterprise'
  onPaymentSuccess: () => void
}

const paymentSchema = z.object({
  method: z.enum(['pix', 'boleto']),
  customerName: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  customerEmail: z.string().email('Email inválido'),
  customerDocument: z.string().min(11, 'CPF inválido').max(18, 'CPF/CNPJ inválido'),
  customerPhone: z.string().min(10, 'Telefone inválido').max(15, 'Telefone inválido'),
})

type PaymentFormData = z.infer<typeof paymentSchema>

interface PaymentResponse {
  success: boolean
  orderId?: string
  paymentInstructions?: {
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
  error?: string
  message?: string
}

export function CheckoutModal({
  open,
  onClose,
  planName,
  planPrice,
  planType,
  onPaymentSuccess,
}: CheckoutModalProps) {
  const { toast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'boleto' | null>(null)
  const [paymentInstructions, setPaymentInstructions] = useState<any>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      method: 'pix',
    },
  })

  const method = watch('method')

  // Preencher dados do usuário/tenant se disponíveis
  useEffect(() => {
    if (open && currentUser && currentTenant) {
      setValue('customerName', currentUser.name || '')
      setValue('customerEmail', currentUser.email || '')
    }
  }, [open, currentUser, currentTenant, setValue])

  // Reset form quando fechar
  useEffect(() => {
    if (!open) {
      reset()
      setShowInstructions(false)
      setOrderId(null)
      setPaymentMethod(null)
      setPaymentInstructions(null)
    }
  }, [open, reset])

  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length <= 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    }
    return cleaned.slice(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length <= 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
    }
    return cleaned.slice(0, 11).replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }

  const onSubmit = async (data: PaymentFormData) => {
    setIsProcessing(true)

    try {
      const apiUrl = getApiUrl()
      
      // Obter token JWT do localStorage
      let token = localStorage.getItem('auth_token')
      
      if (!token) {
        console.warn('[Checkout] Token JWT não encontrado. O usuário precisa fazer login no backend primeiro.')
        toast({
          title: 'Erro de autenticação',
          description: 'Você precisa fazer login novamente para gerar o pagamento. Por favor, faça logout e login novamente.',
          variant: 'destructive',
        })
        setIsProcessing(false)
        return
      }

      const response = await fetch(`${apiUrl}/api/payment/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          method: data.method,
          planType,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerDocument: data.customerDocument.replace(/\D/g, ''),
          customerPhone: data.customerPhone.replace(/\D/g, ''),
        }),
      })

      const result: PaymentResponse = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao processar pagamento')
      }

      if (!result.orderId || !result.paymentInstructions) {
        throw new Error('Resposta inválida da API')
      }

      // Mostrar instruções de pagamento
      setOrderId(result.orderId)
      setPaymentMethod(data.method)
      setPaymentInstructions(result.paymentInstructions)
      setShowInstructions(true)

    } catch (error: any) {
      console.error('Erro ao processar pagamento:', error)
      
      let errorMessage = 'Ocorreu um erro ao processar o pagamento. Tente novamente.'
      
      if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_NAME_NOT_RESOLVED')) {
        errorMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet ou entre em contato com o suporte.'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePaymentConfirmed = () => {
    toast({
      title: 'Pagamento confirmado!',
      description: 'Sua assinatura foi ativada com sucesso.',
    })
    onPaymentSuccess()
    // Fechar modal após um breve delay
    setTimeout(() => {
      onClose()
    }, 2000)
  }

  // Se já mostrou as instruções, exibir componente de instruções
  if (showInstructions && orderId && paymentMethod && paymentInstructions) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Instruções de Pagamento
            </DialogTitle>
            <DialogDescription>
              Siga as instruções abaixo para finalizar o pagamento
            </DialogDescription>
          </DialogHeader>

          <PaymentInstructions
            orderId={orderId}
            paymentMethod={paymentMethod}
            paymentInstructions={paymentInstructions}
            onPaymentConfirmed={handlePaymentConfirmed}
          />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Finalizar Pagamento
          </DialogTitle>
          <DialogDescription>
            Complete o pagamento para ativar sua assinatura do {planName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo do Plano */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Plano</span>
              <span className="text-sm font-semibold">{planName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Valor</span>
              <span className="text-lg font-bold text-primary">
                R$ {planPrice.toFixed(2).replace('.', ',')}/mês
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Método de Pagamento */}
            <div className="space-y-2">
              <Label>Método de Pagamento *</Label>
              <Select
                value={method}
                onValueChange={(value) => {
                  setValue('method', value as 'pix' | 'boleto')
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto Bancário</SelectItem>
                </SelectContent>
              </Select>
              {errors.method && (
                <p className="text-sm text-destructive">{errors.method.message}</p>
              )}
            </div>

            {/* Nome Completo */}
            <div className="space-y-2">
              <Label htmlFor="customerName">Nome Completo *</Label>
              <Input
                id="customerName"
                placeholder="Seu nome completo"
                {...register('customerName')}
              />
              {errors.customerName && (
                <p className="text-sm text-destructive">{errors.customerName.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="customerEmail">Email *</Label>
              <Input
                id="customerEmail"
                type="email"
                placeholder="seu@email.com"
                {...register('customerEmail')}
              />
              {errors.customerEmail && (
                <p className="text-sm text-destructive">{errors.customerEmail.message}</p>
              )}
            </div>

            {/* CPF/CNPJ */}
            <div className="space-y-2">
              <Label htmlFor="customerDocument">CPF/CNPJ *</Label>
              <Input
                id="customerDocument"
                placeholder="000.000.000-00"
                {...register('customerDocument', {
                  onChange: (e) => {
                    const formatted = formatCPF(e.target.value)
                    setValue('customerDocument', formatted)
                  },
                })}
                maxLength={18}
              />
              {errors.customerDocument && (
                <p className="text-sm text-destructive">{errors.customerDocument.message}</p>
              )}
            </div>

            {/* Telefone */}
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Telefone *</Label>
              <Input
                id="customerPhone"
                type="tel"
                placeholder="(00) 00000-0000"
                {...register('customerPhone', {
                  onChange: (e) => {
                    const formatted = formatPhone(e.target.value)
                    setValue('customerPhone', formatted)
                  },
                })}
                maxLength={15}
              />
              {errors.customerPhone && (
                <p className="text-sm text-destructive">{errors.customerPhone.message}</p>
              )}
            </div>

            {/* Informações sobre PIX */}
            {method === 'pix' && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-blue-600">Pagamento via PIX</p>
                <p className="text-xs text-muted-foreground">
                  O pagamento é processado instantaneamente. Após o pagamento, sua assinatura será ativada automaticamente.
                </p>
              </div>
            )}

            {/* Informações sobre Boleto */}
            {method === 'boleto' && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-orange-600">Pagamento via Boleto</p>
                <p className="text-xs text-muted-foreground">
                  O boleto pode levar até 2 dias úteis para ser confirmado. Sua assinatura será ativada automaticamente após a confirmação do pagamento.
                </p>
              </div>
            )}

            {/* Segurança */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Seus dados estão protegidos e criptografados</span>
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Gerar Pagamento'
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
