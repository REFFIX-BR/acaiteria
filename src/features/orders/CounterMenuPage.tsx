import { useMemo } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QRCodeSVG } from 'qrcode.react'
import { Store, Download, Copy, QrCode, Smartphone } from 'lucide-react'
import { getMenuPublicUrl, copyMenuUrl } from '@/lib/menu/menuUrl'
import { useToast } from '@/hooks/use-toast'

export default function CounterMenuPage() {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { toast } = useToast()

  const menuUrl = useMemo(() => {
    if (!currentTenant) return ''
    // URL do QR code com parâmetro source=counter para identificar pedidos do balcão
    return getMenuPublicUrl(currentTenant.slug, 'counter')
  }, [currentTenant])

  const handleCopyUrl = async () => {
    if (!currentTenant) return
    
    // Copia o link com source=counter para identificar pedidos do balcão
    const success = await copyMenuUrl(currentTenant.slug, 'counter')
    if (success) {
      toast({
        title: 'Link copiado!',
        description: 'Link do cardápio (balcão) copiado para a área de transferência',
      })
    } else {
      toast({
        title: 'Erro',
        description: 'Erro ao copiar link',
        variant: 'destructive',
      })
    }
  }

  const handleDownloadQR = () => {
    const svg = document.getElementById('qrcode-svg')
    if (!svg) return

    try {
      const svgData = new XMLSerializer().serializeToString(svg)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)
      
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob)
              const downloadLink = document.createElement('a')
              downloadLink.download = `qrcode-cardapio-${currentTenant?.slug || 'menu'}.png`
              downloadLink.href = url
              downloadLink.click()
              URL.revokeObjectURL(url)
            }
            URL.revokeObjectURL(svgUrl)
          }, 'image/png')
        }
      }
      
      img.onerror = () => {
        // Fallback: download como SVG
        const downloadLink = document.createElement('a')
        downloadLink.download = `qrcode-cardapio-${currentTenant?.slug || 'menu'}.svg`
        downloadLink.href = svgUrl
        downloadLink.click()
        setTimeout(() => URL.revokeObjectURL(svgUrl), 100)
      }
      
      img.src = svgUrl
    } catch (error) {
      console.error('Erro ao baixar QR code:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao baixar QR code. Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  if (!currentTenant) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Store className="h-8 w-8" />
          QR Code do Cardápio
        </h1>
        <p className="text-muted-foreground mt-2">
          Exiba este QR code para que os clientes escaneiem e façam pedidos diretamente pelo celular
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* QR Code Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Código QR
            </CardTitle>
            <CardDescription>
              Clientes escaneiam este código para acessar o cardápio digital
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* QR Code */}
            <div className="flex items-center justify-center p-8 bg-white dark:bg-gray-900 rounded-lg border-2 border-dashed">
              <QRCodeSVG
                id="qrcode-svg"
                value={menuUrl}
                size={280}
                level="H"
                includeMargin={true}
                fgColor="#000000"
                bgColor="#ffffff"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleDownloadQR}
                variant="outline"
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar QR Code
              </Button>
              <Button
                onClick={handleCopyUrl}
                variant="outline"
                className="flex-1"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar Link
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instructions Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Como Funciona
            </CardTitle>
            <CardDescription>
              Instruções para uso do QR code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Exiba o QR Code</h3>
                  <p className="text-sm text-muted-foreground">
                    Imprima ou exiba o QR code em um local visível na sua loja (balcão, mesa, parede)
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Cliente Escaneia</h3>
                  <p className="text-sm text-muted-foreground">
                    O cliente abre a câmera do celular ou app de QR code e escaneia o código
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Acessa o Cardápio</h3>
                  <p className="text-sm text-muted-foreground">
                    O cliente é direcionado automaticamente para o cardápio digital no navegador
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Faz o Pedido</h3>
                  <p className="text-sm text-muted-foreground">
                    O cliente escolhe os itens, adiciona ao carrinho e finaliza o pedido
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  5
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Pedido Chega Aqui</h3>
                  <p className="text-sm text-muted-foreground">
                    O pedido aparece automaticamente na página de Pedidos, marcado como <strong>"Balcão"</strong> (identificado pelo parâmetro na URL)
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Link do Cardápio (Balcão):</p>
                <p className="text-xs font-mono break-all text-muted-foreground mb-2">
                  {menuUrl}
                </p>
                <p className="text-xs text-muted-foreground">
                  ⚠️ Este link contém o parâmetro <code className="bg-background px-1 rounded">?source=counter</code> para identificar pedidos feitos no balcão
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tips Card */}
      <Card>
        <CardHeader>
          <CardTitle>Dicas para Melhor Uso</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Imprima o QR code em alta qualidade (mínimo 10x10cm) para facilitar a leitura</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Coloque o QR code em locais bem iluminados e de fácil acesso</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Considere colocar QR codes em várias mesas ou pontos da loja</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>O QR code funciona mesmo sem internet no momento da impressão - o link é permanente</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Você pode compartilhar o link diretamente via WhatsApp ou redes sociais</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
