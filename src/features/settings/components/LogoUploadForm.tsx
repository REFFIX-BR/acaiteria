import { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { saveTenant, getAllTenants } from '@/lib/storage/storage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LogoUploadFormRef {
  save: () => Promise<void>
}

export interface LogoUploadFormProps {
  onChanges?: (hasChanges: boolean) => void
}

export const LogoUploadForm = forwardRef<LogoUploadFormRef, LogoUploadFormProps>(
  ({ onChanges }, ref) => {
    const currentTenant = useTenantStore((state) => state.currentTenant)
    const { setTenant } = useTenantStore()
    const { toast } = useToast()
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
    const [hasChanges, setHasChanges] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Carrega logo atual do tenant
    useEffect(() => {
      if (currentTenant?.logo) {
        setLogoPreview(currentTenant.logo)
      }
    }, [currentTenant])

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !currentTenant) return

      // Valida tipo de arquivo
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Erro',
          description: 'Por favor, selecione uma imagem válida (JPG, PNG, etc.)',
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

      setIsUploading(true)
      setSelectedFile(file)

      try {
        // Preview local imediato
        const reader = new FileReader()
        reader.onload = (event) => {
          const previewUrl = event.target?.result as string
          setLogoPreview(previewUrl)
        }
        reader.readAsDataURL(file)

        // Fazer upload para MinIO
        console.log('[LogoUploadForm] Iniciando upload de logo:', {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          tenantId: currentTenant.id,
          tenantSlug: currentTenant.slug,
        })

        const { uploadImage } = await import('@/lib/api/upload')
        const logoUrl = await uploadImage(file, 'logo', {
          tenantId: currentTenant.id,
          tenantSlug: currentTenant.slug,
        })

        console.log('[LogoUploadForm] Upload concluído, URL recebida:', logoUrl)
        
        // Atualiza o preview com a URL do MinIO
        setLogoPreview(logoUrl)
        setHasChanges(true)
        onChanges?.(true)
      } catch (error) {
        console.error('[LogoUploadForm] Erro ao fazer upload:', error)
        toast({
          title: 'Erro',
          description: error instanceof Error ? error.message : 'Erro ao fazer upload da imagem',
          variant: 'destructive',
        })
        setSelectedFile(null)
        setLogoPreview(currentTenant.logo || null)
      } finally {
        setIsUploading(false)
      }
    }

    const handleRemoveLogo = () => {
      setLogoPreview(null)
      setHasChanges(true)
      onChanges?.(true)
    }

    const save = async () => {
      if (!currentTenant) return

      try {
        // Se há um arquivo selecionado mas ainda não foi feito upload, fazer agora
        if (selectedFile && logoPreview && logoPreview.startsWith('data:')) {
          console.log('[LogoUploadForm] Fazendo upload antes de salvar...')
          setIsUploading(true)
          
          try {
            const { uploadImage } = await import('@/lib/api/upload')
            const logoUrl = await uploadImage(selectedFile, 'logo', {
              tenantId: currentTenant.id,
              tenantSlug: currentTenant.slug,
            })
            setLogoPreview(logoUrl)
            setSelectedFile(null)
          } catch (uploadError) {
            console.error('[LogoUploadForm] Erro ao fazer upload:', uploadError)
            throw uploadError
          } finally {
            setIsUploading(false)
          }
        }

        const logoUrl = logoPreview && !logoPreview.startsWith('data:') ? logoPreview : undefined

        // Salva no backend
        try {
          const { getApiUrl } = await import('@/lib/api/config')
          const { getAuthToken } = await import('@/lib/api/auth')
          const apiUrl = getApiUrl()
          const token = getAuthToken()

          if (token) {
            const response = await fetch(`${apiUrl}/api/tenants`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                logo: logoUrl,
              }),
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              throw new Error(errorData.error || `Erro ao salvar logo no backend: ${response.status}`)
            }
          }
        } catch (error) {
          console.error('[LogoUploadForm] Erro ao salvar logo no backend:', error)
          // Continua para salvar no localStorage mesmo se falhar no backend
        }

        // Salva no localStorage
        const allTenants = getAllTenants()
        const tenantIndex = allTenants.findIndex(t => t.id === currentTenant.id)
        
        if (tenantIndex === -1) {
          throw new Error('Tenant não encontrado')
        }

        const updatedTenant = {
          ...allTenants[tenantIndex],
          logo: logoUrl,
        }

        allTenants[tenantIndex] = updatedTenant
        saveTenant(updatedTenant)
        setTenant(updatedTenant)
        
        setHasChanges(false)
        setSelectedFile(null)
        onChanges?.(false)

        toast({
          title: 'Sucesso',
          description: 'Logo atualizado com sucesso',
        })
      } catch (error) {
        console.error('[LogoUploadForm] Erro ao salvar logo:', error)
        toast({
          title: 'Erro',
          description: error instanceof Error ? error.message : 'Erro ao salvar logo',
          variant: 'destructive',
        })
        throw error
      }
    }

    useImperativeHandle(ref, () => ({
      save,
    }))

    if (!currentTenant) {
      return null
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Logo da Empresa
          </CardTitle>
          <CardDescription>
            Faça upload da logo que será exibida na plataforma e no cardápio digital
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preview da Logo */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {logoPreview ? (
                <div className="relative group">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="h-24 w-24 object-contain border-2 border-dashed rounded-lg bg-muted p-2"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleRemoveLogo}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="h-24 w-24 border-2 border-dashed rounded-lg bg-muted flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">
                A logo será exibida no cabeçalho da plataforma, no cardápio digital e em outros locais relevantes.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? 'Enviando...' : logoPreview ? 'Alterar Logo' : 'Carregar Logo'}
                </Button>
                {logoPreview && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveLogo}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remover
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Informações */}
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Formatos aceitos:</strong> JPG, PNG, GIF, WebP<br />
              <strong>Tamanho máximo:</strong> 5MB<br />
              <strong>Recomendação:</strong> Imagem quadrada (1:1) para melhor visualização
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }
)

LogoUploadForm.displayName = 'LogoUploadForm'

