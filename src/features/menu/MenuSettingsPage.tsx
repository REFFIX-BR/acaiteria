import { useState, useRef } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData, saveTenant } from '@/lib/storage/storage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { Palette, Eye, Link2, Copy, Check, Upload, Image as ImageIcon, X } from 'lucide-react'
import { getMenuPublicUrl, copyMenuUrl } from '@/lib/menu/menuUrl'

interface MenuSettings {
  showPrices: boolean
  showDescriptions: boolean
  showImages: boolean
  allowWhatsAppOrder: boolean
  whatsAppNumber: string
  customMessage: string
  backgroundColor: string
  textColor: string
  accentColor: string
}

export default function MenuSettingsPage() {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { setTenant } = useTenantStore()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const defaultSettings: MenuSettings = {
    showPrices: true,
    showDescriptions: true,
    showImages: true,
    allowWhatsAppOrder: true,
    whatsAppNumber: '',
    customMessage: 'Olá! Gostaria de fazer um pedido.',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    accentColor: currentTenant?.primaryColor || '#8b5cf6',
  }

  const [settings, setSettings] = useState<MenuSettings>(() => {
    if (!currentTenant) return defaultSettings
    const saved = getTenantData<MenuSettings>(currentTenant.id, 'menuSettings')
    return saved || defaultSettings
  })

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentTenant) return

    // Valida tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione uma imagem válida',
        variant: 'destructive',
      })
      return
    }

    // Valida tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Erro',
        description: 'A imagem deve ter no máximo 5MB',
        variant: 'destructive',
      })
      return
    }

    try {
      console.log('[MenuSettings] Iniciando upload de logo:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        tenantId: currentTenant.id,
        tenantSlug: currentTenant.slug,
      })

      // Fazer upload para MinIO
      const { uploadImage } = await import('@/lib/api/upload')
      const logoUrl = await uploadImage(file, 'logo', {
        tenantId: currentTenant.id,
        tenantSlug: currentTenant.slug,
      })

      console.log('[MenuSettings] Upload concluído, URL recebida:', logoUrl)

      // Atualiza o tenant com o novo logo
      const updatedTenant = {
        ...currentTenant,
        logo: logoUrl,
      }
      
      // Salva no backend
      try {
        const { getApiUrl } = await import('@/lib/api/config')
        const { getAuthToken } = await import('@/lib/api/auth')
        const apiUrl = getApiUrl()
        const token = getAuthToken()

        if (token) {
          await fetch(`${apiUrl}/api/tenants`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              logo: logoUrl,
            }),
          })
        }
      } catch (error) {
        console.error('Erro ao salvar logo no backend:', error)
        // Continua mesmo se falhar no backend
      }
      
      saveTenant(updatedTenant)
      setTenant(updatedTenant)
      
      toast({
        title: 'Sucesso',
        description: 'Logo atualizado com sucesso',
      })
    } catch (error) {
      console.error('Erro ao fazer upload do logo:', error)
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao fazer upload da imagem',
        variant: 'destructive',
      })
    }
  }

  const handleRemoveLogo = () => {
    if (!currentTenant) return

    const updatedTenant = {
      ...currentTenant,
      logo: undefined,
    }
    
    saveTenant(updatedTenant)
    setTenant(updatedTenant)
    
    toast({
      title: 'Sucesso',
      description: 'Logo removido com sucesso',
    })
  }

  const handleSave = () => {
    if (!currentTenant) {
      toast({
        title: 'Erro',
        description: 'Tenant não encontrado',
        variant: 'destructive',
      })
      return
    }

    try {
      setTenantData(currentTenant.id, 'menuSettings', settings)
      toast({
        title: 'Sucesso',
        description: 'Configurações do cardápio salvas com sucesso',
      })
    } catch (error) {
      console.error('Erro ao salvar configurações:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao salvar configurações',
        variant: 'destructive',
      })
    }
  }

  const handleCopyLink = async () => {
    if (!currentTenant) return

    const success = await copyMenuUrl(currentTenant.slug)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({
        title: 'Link copiado!',
        description: 'O link do cardápio foi copiado para a área de transferência',
      })
    }
  }

  if (!currentTenant) {
    return null
  }

  const menuUrl = getMenuPublicUrl(currentTenant.slug)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações do Cardápio Digital</h1>
          <p className="text-muted-foreground">
            Personalize a aparência e comportamento do seu cardápio público
          </p>
        </div>
      </div>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Logo da Açaiteria
          </CardTitle>
          <CardDescription>
            Faça upload do logo que aparecerá no cardápio público
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentTenant.logo ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img
                    src={currentTenant.logo}
                    alt={currentTenant.name}
                    className="h-24 w-24 rounded-lg object-contain border-2 border-border"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-2">
                    Logo atual
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Alterar Logo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveLogo}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remover
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Nenhum logo cadastrado
              </p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Carregar Logo
              </Button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="hidden"
          />
          <p className="text-xs text-muted-foreground">
            Formatos aceitos: JPG, PNG, GIF. Tamanho máximo: 5MB
          </p>
        </CardContent>
      </Card>

      {/* Link Público */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Link Público do Cardápio
          </CardTitle>
          <CardDescription>
            Compartilhe este link com seus clientes para acessarem o cardápio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={menuUrl}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              onClick={handleCopyLink}
              variant="outline"
              className="shrink-0"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </>
              )}
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={() => window.open(menuUrl, '_blank')}
            className="w-full"
          >
            <Eye className="h-4 w-4 mr-2" />
            Visualizar Cardápio
          </Button>
        </CardContent>
      </Card>

      {/* Visualização */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Visualização
          </CardTitle>
          <CardDescription>
            Configure o que será exibido no cardápio público
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Exibir Preços</Label>
              <p className="text-sm text-muted-foreground">
                Mostra os preços dos produtos no cardápio
              </p>
            </div>
            <Switch
              checked={settings.showPrices}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, showPrices: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Exibir Descrições</Label>
              <p className="text-sm text-muted-foreground">
                Mostra as descrições dos produtos
              </p>
            </div>
            <Switch
              checked={settings.showDescriptions}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, showDescriptions: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Exibir Imagens</Label>
              <p className="text-sm text-muted-foreground">
                Mostra as imagens dos produtos quando disponíveis
              </p>
            </div>
            <Switch
              checked={settings.showImages}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, showImages: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Personalização */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Personalização Visual
          </CardTitle>
          <CardDescription>
            Personalize as cores do seu cardápio digital
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="backgroundColor">Cor de Fundo</Label>
              <div className="flex gap-2">
                <Input
                  id="backgroundColor"
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) =>
                    setSettings({ ...settings, backgroundColor: e.target.value })
                  }
                  className="h-10 w-20 p-1 cursor-pointer"
                />
                <Input
                  value={settings.backgroundColor}
                  onChange={(e) =>
                    setSettings({ ...settings, backgroundColor: e.target.value })
                  }
                  placeholder="#ffffff"
                  className="flex-1 font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="textColor">Cor do Texto</Label>
              <div className="flex gap-2">
                <Input
                  id="textColor"
                  type="color"
                  value={settings.textColor}
                  onChange={(e) =>
                    setSettings({ ...settings, textColor: e.target.value })
                  }
                  className="h-10 w-20 p-1 cursor-pointer"
                />
                <Input
                  value={settings.textColor}
                  onChange={(e) =>
                    setSettings({ ...settings, textColor: e.target.value })
                  }
                  placeholder="#000000"
                  className="flex-1 font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accentColor">Cor de Destaque</Label>
              <div className="flex gap-2">
                <Input
                  id="accentColor"
                  type="color"
                  value={settings.accentColor}
                  onChange={(e) =>
                    setSettings({ ...settings, accentColor: e.target.value })
                  }
                  className="h-10 w-20 p-1 cursor-pointer"
                />
                <Input
                  value={settings.accentColor}
                  onChange={(e) =>
                    setSettings({ ...settings, accentColor: e.target.value })
                  }
                  placeholder="#8b5cf6"
                  className="flex-1 font-mono"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg">
          Salvar Configurações
        </Button>
      </div>
    </div>
  )
}
