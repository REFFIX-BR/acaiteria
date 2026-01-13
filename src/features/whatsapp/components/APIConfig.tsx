import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData } from '@/lib/storage/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Zap } from 'lucide-react'
import type { WhatsAppConfig } from '@/types'

const configSchema = z.object({
  apiUrl: z.string().min(1, 'URL é obrigatória'),
  apiKey: z.string().min(1, 'API Key é obrigatória'),
  instanceName: z.string().min(1, 'Nome da instância é obrigatório'),
})

type ConfigFormData = z.infer<typeof configSchema>

interface APIConfigProps {
  onSuccess?: () => void
}

export function APIConfig({ onSuccess }: APIConfigProps) {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
  })

  useEffect(() => {
    if (currentTenant) {
      const config = getTenantData<WhatsAppConfig>(currentTenant.id, 'whatsapp_config')
      if (config) {
        reset({
          apiUrl: config.apiUrl,
          apiKey: config.apiKey,
          instanceName: config.instanceName || '',
        })
      }
    }
  }, [currentTenant, reset])

  const onSubmit = async (data: ConfigFormData) => {
    if (!currentTenant) {
      toast({
        title: 'Erro',
        description: 'Tenant não encontrado',
        variant: 'destructive',
      })
      return
    }

    try {
      const config: WhatsAppConfig = {
        apiUrl: data.apiUrl,
        apiKey: data.apiKey,
        instanceName: data.instanceName,
        connected: false, // A conexão será gerenciada pelo componente WhatsAppConnection
      }

      setTenantData(currentTenant.id, 'whatsapp_config', config)

      toast({
        title: 'Sucesso',
        description: 'Configuração salva com sucesso. Agora você pode conectar o WhatsApp.',
      })
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao salvar configuração',
        variant: 'destructive',
      })
    }
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Conectar WhatsApp</CardTitle>
            <CardDescription>
              Configure a conexão com a Evolution API para envio de mensagens
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiUrl">URL da API *</Label>
            <Input
              id="apiUrl"
              type="text"
              placeholder="https://api.evolution.com"
              {...register('apiUrl')}
            />
            {errors.apiUrl && (
              <p className="text-sm text-destructive">{errors.apiUrl.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              URL base da sua instalação da Evolution API
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key *</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Sua chave de API"
              {...register('apiKey')}
            />
            {errors.apiKey && (
              <p className="text-sm text-destructive">{errors.apiKey.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Chave de autenticação da Evolution API
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instanceName">Nome da Instância *</Label>
            <Input
              id="instanceName"
              placeholder="Nome da instância do WhatsApp (ex: minha-acaiteria)"
              {...register('instanceName')}
            />
            {errors.instanceName && (
              <p className="text-sm text-destructive">{errors.instanceName.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Nome único para identificar esta instância
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Configuração'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

