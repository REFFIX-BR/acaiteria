import { useState, useEffect, useCallback, useRef } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData, removeTenantData } from '@/lib/storage/storage'
import { EvolutionAPIClient, normalizeInstanceName } from '@/lib/whatsapp/evolutionApi'
import { useToast } from '@/hooks/use-toast'
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
        integration: 'WHATSAPP-BAILEYS',
        createdAt: now,
      }),
      ...instanceData,
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

    const config = currentTenant ? getTenantData<WhatsAppConfig>(currentTenant.id, 'whatsapp_config') : null
    if (!config || !config.apiUrl || !config.apiKey) {
      toast({
        title: 'Erro',
        description: 'Configuração da API não encontrada',
        variant: 'destructive',
      })
      return
    }

    const client = new EvolutionAPIClient(config)

    monitoringIntervalRef.current = setInterval(async () => {
      if (cancelledFlagRef.current) {
        if (monitoringIntervalRef.current) {
          clearInterval(monitoringIntervalRef.current)
          monitoringIntervalRef.current = null
        }
        return
      }

      try {
        const statusResult = await client.getConnectionState(instanceName)
        
        if (statusResult.success && statusResult.isConnected) {
          // Conectado!
          if (monitoringIntervalRef.current) {
            clearInterval(monitoringIntervalRef.current)
            monitoringIntervalRef.current = null
          }

          setState({ status: 'connected' })
          saveInstance({ status: 'connected', lastSeen: new Date() })
          
          toast({
            title: 'Conectado!',
            description: 'WhatsApp conectado com sucesso',
          })
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error)
      }
    }, 5000) // Verifica a cada 5 segundos
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

    const config = getTenantData<WhatsAppConfig>(currentTenant.id, 'whatsapp_config')
    if (!config || !config.apiUrl || !config.apiKey) {
      toast({
        title: 'Erro',
        description: 'Configure a URL e API Key primeiro',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    setState({ status: 'generating' })

    try {
      const instanceName = config.instanceName || normalizeInstanceName(currentTenant.name)
      const client = new EvolutionAPIClient(config)

      // Cria instância
      const createResult = await client.createInstance(instanceName, true)
      
      if (!createResult.success) {
        setState({ status: 'error', error: createResult.error })
        toast({
          title: 'Erro',
          description: createResult.error || 'Erro ao criar instância',
          variant: 'destructive',
        })
        return
      }

      // Salva instância no storage
      saveInstance({
        instanceName,
        status: 'connecting',
      })

      // Aguarda um pouco e obtém QR Code
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const codeResult = await client.getConnectionCode(instanceName)
      
      if (codeResult.success && codeResult.qrcode) {
        setState({ 
          status: 'waiting', 
          qrcode: codeResult.qrcode 
        })
        startMonitoring(instanceName)
      } else {
        setState({ status: 'error', error: codeResult.error })
        toast({
          title: 'Erro',
          description: codeResult.error || 'Erro ao obter QR Code',
          variant: 'destructive',
        })
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

    const config = getTenantData<WhatsAppConfig>(currentTenant.id, 'whatsapp_config')
    if (!config || !config.apiUrl || !config.apiKey) {
      toast({
        title: 'Erro',
        description: 'Configure a URL e API Key primeiro',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    setState({ status: 'generating' })

    try {
      const instanceName = config.instanceName || normalizeInstanceName(currentTenant.name)
      const client = new EvolutionAPIClient(config)

      // Conecta com Pairing Code
      const result = await client.connectWithPairingCode(instanceName, phoneNumber)
      
      if (result.success && result.pairingCode) {
        // Salva instância no storage
        saveInstance({
          instanceName,
          phoneNumber,
          status: 'connecting',
        })

        setState({ 
          status: 'waiting', 
          pairingCode: result.pairingCode 
        })
        startMonitoring(instanceName)
      } else {
        setState({ status: 'error', error: result.error })
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao gerar Pairing Code',
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
      const config = getTenantData<WhatsAppConfig>(currentTenant.id, 'whatsapp_config')
      if (!config) {
        toast({
          title: 'Erro',
          description: 'Configuração não encontrada',
          variant: 'destructive',
        })
        return
      }

      const client = new EvolutionAPIClient(config)
      const result = await client.logoutInstance(instanceName)

      if (result.success) {
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
      const config = getTenantData<WhatsAppConfig>(currentTenant.id, 'whatsapp_config')
      if (!config) {
        toast({
          title: 'Erro',
          description: 'Configuração não encontrada',
          variant: 'destructive',
        })
        return
      }

      const client = new EvolutionAPIClient(config)
      
      // Tenta deletar na API (pode não existir)
      await client.deleteInstance(instanceName).catch(() => {
        // Ignora erro se não existir
      })

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
      const config = getTenantData<WhatsAppConfig>(currentTenant.id, 'whatsapp_config')
      if (!config) {
        toast({
          title: 'Erro',
          description: 'Configuração não encontrada',
          variant: 'destructive',
        })
        return
      }

      const client = new EvolutionAPIClient(config)
      const statusResult = await client.getConnectionState(instanceName)

      if (statusResult.success) {
        const newStatus = statusResult.isConnected ? 'connected' : 'disconnected'
        saveInstance({ 
          status: newStatus as any,
          lastSeen: new Date()
        })
        
        if (statusResult.isConnected) {
          setState({ status: 'connected' })
        }

        toast({
          title: 'Status atualizado',
          description: `WhatsApp está ${statusResult.isConnected ? 'conectado' : 'desconectado'}`,
        })
      } else {
        toast({
          title: 'Erro',
          description: statusResult.error || 'Erro ao atualizar status',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar status',
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

