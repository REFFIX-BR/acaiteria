import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTenantStore } from '@/stores/tenantStore'
import { saveTenant } from '@/lib/storage/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import type { Tenant } from '@/types'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { setTenant } = useTenantStore()
  
  const tenantFromState = location.state?.tenant as Tenant | undefined
  
  const [formData, setFormData] = useState({
    name: tenantFromState?.name || '',
    primaryColor: tenantFromState?.primaryColor || '#6366f1',
    secondaryColor: tenantFromState?.secondaryColor || '#8b5cf6',
    logo: '',
  })

  useEffect(() => {
    if (!tenantFromState) {
      navigate('/login')
    }
  }, [tenantFromState, navigate])

  const handleSave = () => {
    if (!tenantFromState) return

    const updatedTenant: Tenant = {
      ...tenantFromState,
      name: formData.name || tenantFromState.name,
      primaryColor: formData.primaryColor,
      secondaryColor: formData.secondaryColor,
      logo: formData.logo || undefined,
    }

    saveTenant(updatedTenant)
    setTenant(updatedTenant)
    
    toast({
      title: 'Configuração salva!',
      description: 'Sua açaiteria está pronta para uso',
    })

    navigate('/dashboard')
  }

  if (!tenantFromState) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Configure sua Açaiteria
          </CardTitle>
          <CardDescription className="text-center">
            Personalize a identidade visual da sua açaiteria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome da sua açaiteria"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="primaryColor">Cor Primária</Label>
            <div className="flex gap-3 items-center">
              <Input
                id="primaryColor"
                type="color"
                value={formData.primaryColor}
                onChange={(e) =>
                  setFormData({ ...formData, primaryColor: e.target.value })
                }
                className="w-20 h-10"
              />
              <Input
                value={formData.primaryColor}
                onChange={(e) =>
                  setFormData({ ...formData, primaryColor: e.target.value })
                }
                placeholder="#6366f1"
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="secondaryColor">Cor Secundária</Label>
            <div className="flex gap-3 items-center">
              <Input
                id="secondaryColor"
                type="color"
                value={formData.secondaryColor}
                onChange={(e) =>
                  setFormData({ ...formData, secondaryColor: e.target.value })
                }
                className="w-20 h-10"
              />
              <Input
                value={formData.secondaryColor}
                onChange={(e) =>
                  setFormData({ ...formData, secondaryColor: e.target.value })
                }
                placeholder="#8b5cf6"
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo">Logo (URL da imagem)</Label>
            <Input
              id="logo"
              type="url"
              value={formData.logo}
              onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
              placeholder="https://exemplo.com/logo.png"
            />
            {formData.logo && (
              <div className="mt-2">
                <img
                  src={formData.logo}
                  alt="Preview logo"
                  className="h-20 w-20 object-contain border rounded"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <Button onClick={handleSave} className="w-full">
              Salvar e Continuar
            </Button>
            <Button
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              className="w-full mt-2"
            >
              Pular (configurar depois)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

