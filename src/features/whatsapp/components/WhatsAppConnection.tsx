import { useState } from 'react'
import { useWhatsAppConnection } from '@/hooks/use-whatsapp-connection'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Smartphone, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  LogOut, 
  Trash2,
  QrCode,
  Loader2,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react'
import { useTenantStore } from '@/stores/tenantStore'
import { useToast } from '@/hooks/use-toast'

export function WhatsAppConnection() {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { toast } = useToast()
  const [pairingPhone, setPairingPhone] = useState('11999999999')
  const [showWhyConnect, setShowWhyConnect] = useState(true)
  
  const {
    state,
    instance,
    createWithQRCode,
    connectWithPairingCode,
    deleteInstance,
    logoutInstance,
    refreshInstance,
    cancelConnection,
    isLoading,
    isLoggingOut,
    isDeleting,
    isRefreshing
  } = useWhatsAppConnection()

  const handleCreateQRCode = () => {
    createWithQRCode()
  }

  const handleConnectPairingCode = () => {
    connectWithPairingCode(pairingPhone)
  }
  
  if (!currentTenant) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Faça login para configurar o WhatsApp</p>
        </CardContent>
      </Card>
    )
  }

  // Estado: Conectado
  if (instance && instance.status === 'connected' && state.status === 'connected') {
    return (
      <Card className="border-green-500/50 bg-green-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              <div>
                <CardTitle className="text-green-500">WhatsApp Conectado</CardTitle>
                <CardDescription>Você está pronto para enviar campanhas</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-500/10 text-green-500">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Conectado
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <span className="text-sm font-medium">Instância:</span>
            <span className="text-sm text-muted-foreground">{instance.instanceName}</span>
          </div>
          
          {instance.phoneNumber && (
            <div className="flex items-center justify-between p-3 bg-background rounded-lg">
              <span className="text-sm font-medium">Número:</span>
              <span className="text-sm text-muted-foreground">{instance.phoneNumber}</span>
            </div>
          )}
          
          {instance.lastSeen && (
            <div className="flex items-center justify-between p-3 bg-background rounded-lg">
              <span className="text-sm font-medium">Última conexão:</span>
              <span className="text-sm text-muted-foreground">
                {new Date(instance.lastSeen).toLocaleString('pt-BR')}
              </span>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={() => logoutInstance(instance.instanceName)} 
              variant="outline"
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Desconectando...
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4 mr-2" />
                  Desconectar WhatsApp
                </>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => refreshInstance(instance.instanceName)}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Sincronizar status
                </>
              )}
            </Button>
            
            <Button 
              variant="ghost" 
              onClick={() => deleteInstance(instance.instanceName)}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir instância
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Estado: Aguardando Conexão (QR Code ou Pairing Code gerado)
  if (state.status === 'waiting' || state.status === 'generating') {
    return (
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Clock className="w-6 h-6 text-yellow-500" />
              <div>
                <CardTitle className="text-yellow-500">Aguardando Conexão</CardTitle>
                <CardDescription>
                  {state.status === 'generating' 
                    ? 'Gerando código de conexão...' 
                    : state.qrcode 
                      ? 'Escaneie o QR Code abaixo com o WhatsApp' 
                      : 'Digite o código no WhatsApp para conectar'}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* QR Code */}
          {state.qrcode && (
            <div className="flex flex-col items-center space-y-4 p-6 bg-background rounded-lg border-2 border-dashed">
              {state.qrcode.startsWith('data:image') ? (
                <img 
                  src={state.qrcode} 
                  alt="QR Code WhatsApp" 
                  className="w-64 h-64 border-4 border-primary/20 rounded-lg shadow-lg"
                />
              ) : (
                <div className="w-64 h-64 border-4 border-primary/20 rounded-lg shadow-lg bg-white p-4 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground text-center">
                    QR Code: {state.qrcode.substring(0, 50)}...
                  </p>
                </div>
              )}
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg w-full">
                <p className="text-sm font-medium mb-2">Como usar:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Abra o WhatsApp no celular</li>
                  <li>Vá em <strong>Configurações</strong> → <strong>Aparelhos Conectados</strong></li>
                  <li>Toque em <strong>Conectar um aparelho</strong></li>
                  <li>Escaneie o código acima</li>
                </ol>
              </div>
            </div>
          )}
          
          {/* Pairing Code */}
          {state.pairingCode && (
            <div className="flex flex-col items-center space-y-4 p-6 bg-background rounded-lg border-2 border-dashed">
              <div className="text-6xl font-bold text-center tracking-wider bg-primary/10 px-8 py-6 rounded-lg border-2 border-primary/30">
                {state.pairingCode}
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg w-full">
                <p className="text-sm font-medium mb-2">Como usar:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Abra o WhatsApp no celular</li>
                  <li>Vá em <strong>Configurações</strong> → <strong>Aparelhos Conectados</strong></li>
                  <li>Toque em <strong>Conectar um aparelho</strong></li>
                  <li>Selecione <strong>Digitar código manualmente</strong></li>
                  <li>Digite o código acima: <strong>{state.pairingCode}</strong></li>
                </ol>
              </div>
            </div>
          )}
          
          <Button onClick={cancelConnection} variant="outline" className="w-full">
            <XCircle className="w-4 h-4 mr-2" />
            Cancelar Conexão
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Estado inicial: Mostrar dois métodos lado a lado
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conectar WhatsApp</CardTitle>
        <CardDescription>
          Escolha um método para conectar seu WhatsApp ao sistema e começar a enviar campanhas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Seção "Por que conectar?" */}
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowWhyConnect(!showWhyConnect)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              <span className="font-medium">Por que conectar?</span>
            </div>
            {showWhyConnect ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
          {showWhyConnect && (
            <div className="px-4 pb-4 pt-0">
              <p className="text-sm text-muted-foreground">
                Ao conectar seu WhatsApp, você poderá enviar campanhas de marketing personalizadas 
                para todos os seus clientes automaticamente, aumentando seu engajamento e vendas.
              </p>
            </div>
          )}
        </div>

        {/* Dois métodos lado a lado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Método QR Code - Esquerda */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <QrCode className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">QR Code</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              A forma mais rápida. Gere um código QR e escaneie com o WhatsApp
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500" />
                <span>Instantâneo</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500" />
                <span>Mais fácil</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500" />
                <span>Recomendado</span>
              </li>
            </ul>
            <Button 
              onClick={handleCreateQRCode} 
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando QR Code...
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4 mr-2" />
                  Gerar QR Code
                </>
              )}
            </Button>
          </div>

          {/* Método Pairing Code - Direita */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Pairing Code</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Digite seu número e receba um código de 8 dígitos para digitar no WhatsApp
            </p>
            <div className="space-y-2">
              <Label htmlFor="pairing-phone">Número do WhatsApp</Label>
              <Input
                id="pairing-phone"
                type="tel"
                placeholder="11999999999"
                value={pairingPhone}
                onChange={(e) => setPairingPhone(e.target.value.replace(/\D/g, ''))}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Digite apenas números, sem espaços ou caracteres especiais
              </p>
            </div>
            <Button
              onClick={handleConnectPairingCode}
              variant="outline"
              className="w-full"
              disabled={isLoading || !pairingPhone}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando código...
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4 mr-2" />
                  Gerar Pairing Code
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
