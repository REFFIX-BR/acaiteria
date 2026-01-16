import { useState, useEffect, useCallback, useRef } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData, removeTenantData } from '@/lib/storage/storage'
import { normalizeInstanceName } from '@/lib/whatsapp/evolutionApi'
import { useToast } from '@/hooks/use-toast'
import { getApiUrl } from '@/lib/api/config'
import { authenticatedFetch } from '@/lib/api/auth'
import type { ConnectionState, WhatsAppInstance, WhatsAppConfig } from '@/types'

export function useWhatsAppConnection() {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { toast } = useToast()
  const [state, setState] = useState<ConnectionState>({ status: 'disconnected' })
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const monitoringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledFlagRef = useRef(false)

  // Carrega instância do storage
  useEffect(() => {
    if (currentTenant) {
      const savedInstance = getTenantData<WhatsAppInstance>(currentTenant.id, 'whatsapp_instance')
      if (savedInstance) {
        setInstance(savedInstance)
        // Verifica se estava conectado
        if (savedInstance.status === 'connected') {
          setState({ status: 'connected' })
        } else if (savedInstance.status === 'connecting') {
          setState({ status: 'waiting' })
        }
      }
    }
  }, [currentTenant])

  // Salva instância no storage
  const saveInstance = useCallback((instanceData: Partial<WhatsAppInstance>) => {
    if (!currentTenant) return

    const now = new Date()
    const existingInstance = getTenantData<WhatsAppInstance>(currentTenant.id, 'whatsapp_instance')
    
    const updatedInstance: WhatsAppInstance = {
      ...(existingInstance || {
        id: `instance-${Date.now()}`,
        restaurantId: currentTenant.id,
        instanceName: '',
        status: 'created',
        integration: 'WHATSAPP-BAILEYS',
        createdAt: now,
      }),
      ...instanceData,
      instanceName: instanceData.instanceName || existingInstance?.instanceName || '',
      status: instanceData.status || existingInstance?.status || 'created',
      updatedAt: now,
    }

    setTenantData(currentTenant.id, 'whatsapp_instance', updatedInstance)
    setInstance(updatedInstance)
  }, [currentTenant])

  // Inicia monitoramento automático
  const startMonitoring = useCallback((instanceName: string) => {
    // Limpa intervalo anterior
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current)
    }

    cancelledFlagRef.current = false

    // Timeout de 5 minutos (conforme documento)
    const timeoutId = setTimeout(() => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current)
        monitoringIntervalRef.current = null
      }
      setState({ status: 'error', error: 'Tempo de conexão expirado' })
      toast({
        title: 'Tempo expirado',
        description: 'O tempo para conectar o WhatsApp expirou. Tente novamente.',
        variant: 'destructive',
      })
    }, 300000) // 5 minutos

    monitoringIntervalRef.current = setInterval(async () => {
      if (cancelledFlagRef.current) {
        if (monitoringIntervalRef.current) {
          clearInterval(monitoringIntervalRef.current)
          monitoringIntervalRef.current = null
        }
        clearTimeout(timeoutId)
        return
      }

      try {
        const apiUrl = getApiUrl()
        const response = await authenticatedFetch(`${apiUrl}/api/whatsapp/instances/${instanceName}/status`)
        
        if (response.ok) {
          const data = await response.json()
          
          if (data.success && data.isConnected) {
            // Conectado!
            if (monitoringIntervalRef.current) {
              clearInterval(monitoringIntervalRef.current)
              monitoringIntervalRef.current = null
            }
            clearTimeout(timeoutId)

            setState({ status: 'connected' })
            saveInstance({ status: 'connected', lastSeen: new Date() })
            
            toast({
              title: 'Conectado!',
              description: 'WhatsApp conectado com sucesso',
            })
          }
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error)
      }
    }, 5000) // Verifica a cada 5 segundos (conforme documento)
  }, [currentTenant, saveInstance, toast])

  // Criar instância via QR Code
  const createWithQRCode = useCallback(async () => {
    if (!currentTenant) {
      toast({
        title: 'Erro',
        description: 'Tenant não encontrado',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    setState({ status: 'generating' })

    try {
      // Gera nome da instância baseado no nome do tenant
      const instanceName = normalizeInstanceName(currentTenant.name)
      const apiUrl = getApiUrl()

      // Cria instância via backend
      const response = await authenticatedFetch(`${apiUrl}/api/whatsapp/instances/create`, {
        method: 'POST',
        body: JSON.stringify({
          instanceName,
          useQRCode: true,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setState({ status: 'error', error: result.error || 'Erro ao criar instância' })
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao criar instância',
          variant: 'destructive',
        })
        return
      }

      // Salva instância no storage
      saveInstance({
        instanceName,
        status: 'connecting',
      })

      // Se o QR Code já veio na resposta, usar
      if (result.connectionCode?.qrcode) {
        setState({ 
          status: 'waiting', 
          qrcode: result.connectionCode.qrcode 
        })
        startMonitoring(instanceName)
      } else {
        // Se não veio, tentar obter novamente
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        const connectResponse = await authenticatedFetch(`${apiUrl}/api/whatsapp/instances/${instanceName}/connect`)
        const connectResult = await connectResponse.json()
        
        if (connectResponse.ok && connectResult.success && connectResult.connectionCode?.qrcode) {
          setState({ 
            status: 'waiting', 
            qrcode: connectResult.connectionCode.qrcode 
          })
          startMonitoring(instanceName)
        } else {
          setState({ status: 'error', error: 'Erro ao obter QR Code' })
          toast({
            title: 'Erro',
            description: 'Erro ao obter QR Code',
            variant: 'destructive',
          })
        }
      }
    } catch (error) {
      console.error('Erro ao criar instância:', error)
      setState({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      })
      toast({
        title: 'Erro',
        description: 'Erro ao criar instância',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [currentTenant, saveInstance, startMonitoring, toast])

  // Conectar via Pairing Code
  const connectWithPairingCode = useCallback(async (phoneNumber: string) => {
    if (!currentTenant) {
      toast({
        title: 'Erro',
        description: 'Tenant não encontrado',
        variant: 'destructive',
      })
      return
    }

    // Gera nome da instância baseado no nome do tenant
    const instanceName = normalizeInstanceName(currentTenant.name)

    setIsLoading(true)
    setState({ status: 'generating' })

    try {
      const apiUrl = getApiUrl()

      // Conecta com Pairing Code via backend
      const response = await authenticatedFetch(`${apiUrl}/api/whatsapp/instances/connect-pairing`, {
        method: 'POST',
        body: JSON.stringify({
          instanceName,
          phoneNumber,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setState({ status: 'error', error: result.error || 'Erro ao gerar Pairing Code' })
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao gerar Pairing Code',
          variant: 'destructive',
        })
        return
      }

      // Salva instância no storage
      saveInstance({
        instanceName,
        phoneNumber,
        status: 'connecting',
      })

      if (result.connectionCode?.pairingCode) {
        setState({ 
          status: 'waiting', 
          pairingCode: result.connectionCode.pairingCode 
        })
        startMonitoring(instanceName)
      } else {
        setState({ status: 'error', error: 'Código de pairing não recebido' })
        toast({
          title: 'Erro',
          description: 'Código de pairing não recebido',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Erro ao conectar com Pairing Code:', error)
      setState({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      })
      toast({
        title: 'Erro',
        description: 'Erro ao gerar Pairing Code',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [currentTenant, saveInstance, startMonitoring, toast])

  // Cancelar conexão
  const cancelConnection = useCallback(() => {
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current)
      monitoringIntervalRef.current = null
    }
    
    cancelledFlagRef.current = true
    setState({ status: 'disconnected' })
    
    if (instance && currentTenant) {
      saveInstance({ status: 'disconnected' })
    }
    
    toast({
      title: 'Conexão cancelada',
      description: 'Você pode tentar conectar novamente quando quiser',
    })
  }, [instance, currentTenant, saveInstance, toast])

  // Desconectar
  const logoutInstance = useCallback(async (instanceName: string) => {
    if (!currentTenant) return

    setIsLoggingOut(true)

    try {
      const apiUrl = getApiUrl()
      const response = await authenticatedFetch(`${apiUrl}/api/whatsapp/instances/${instanceName}/logout`, {
        method: 'POST',
      })

      const result = await response.json()

      if (response.ok && result.success) {
        saveInstance({ status: 'disconnected' })
        setState({ status: 'disconnected' })
        toast({
          title: 'Desconectado',
          description: 'WhatsApp desconectado com sucesso',
        })
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao desconectar',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Erro ao desconectar:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao desconectar',
        variant: 'destructive',
      })
    } finally {
      setIsLoggingOut(false)
    }
  }, [currentTenant, saveInstance, toast])

  // Deletar instância
  const deleteInstance = useCallback(async (instanceName: string) => {
    if (!currentTenant) return

    setIsDeleting(true)

    try {
      const apiUrl = getApiUrl()

      // Tenta deletar na API via backend (pode não existir)
      try {
        const response = await authenticatedFetch(`${apiUrl}/api/whatsapp/instances/${instanceName}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          // Ignora erro se não existir na API
          console.warn('[WhatsApp] Erro ao deletar instância na API (pode não existir):', await response.json().catch(() => ({})))
        }
      } catch (error) {
        // Ignora erro se não conseguir deletar na API
        console.warn('[WhatsApp] Erro ao deletar instância na API:', error)
      }

      // Remove do storage
      removeTenantData(currentTenant.id, 'whatsapp_instance')
      setInstance(null)
      setState({ status: 'disconnected' })

      toast({
        title: 'Instância deletada',
        description: 'Instância removida com sucesso',
      })
    } catch (error) {
      console.error('Erro ao deletar instância:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao deletar instância',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }, [currentTenant, toast])

  // Sincronizar status
  const refreshInstance = useCallback(async (instanceName: string) => {
    if (!currentTenant) return

    setIsRefreshing(true)

    try {
      const apiUrl = getApiUrl()
      const response = await authenticatedFetch(`${apiUrl}/api/whatsapp/instances/${instanceName}/status`)

      if (response.ok) {
        const result = await response.json()

        if (result.success) {
          const newStatus = result.isConnected ? 'connected' : 'disconnected'
          saveInstance({ 
            status: newStatus as any,
            lastSeen: new Date()
          })
          
          if (result.isConnected) {
            setState({ status: 'connected' })
          } else {
            setState({ status: 'disconnected' })
          }

          toast({
            title: 'Status atualizado',
            description: `WhatsApp está ${result.isConnected ? 'conectado' : 'desconectado'}`,
          })
        } else {
          toast({
            title: 'Erro',
            description: result.error || 'Erro ao verificar status',
            variant: 'destructive',
          })
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast({
          title: 'Erro',
          description: errorData.error || 'Erro ao verificar status',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao verificar status',
        variant: 'destructive',
      })
    } finally {
      setIsRefreshing(false)
    }
  }, [currentTenant, saveInstance, toast])

  // Limpar intervalos ao desmontar
  useEffect(() => {
    return () => {
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current)
      }
    }
  }, [])

  return {
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
    isRefreshing,
  }
}

