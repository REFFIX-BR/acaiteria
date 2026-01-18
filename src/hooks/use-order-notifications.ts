import { useEffect, useRef, useState, useCallback } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { authenticatedFetch } from '@/lib/api/auth'
import { getApiUrl } from '@/lib/api/config'
import { useToast } from '@/hooks/use-toast'
import type { Order } from '@/types'

/**
 * Hook para monitorar novos pedidos pendentes e tocar som de notificação
 * Funciona em todas as abas do sistema
 */
export function useOrderNotifications() {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { toast } = useToast()
  const [lastPendingCount, setLastPendingCount] = useState(0)
  const isInitialized = useRef(false)

  // Função para tocar som de notificação
  const playNotificationSound = useCallback(() => {
    try {
      // Cria um contexto de áudio
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Configura o som (frequência, duração, etc)
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)

      // Toca novamente após um pequeno delay para um som mais notável
      setTimeout(() => {
        const oscillator2 = audioContext.createOscillator()
        const gainNode2 = audioContext.createGain()
        
        oscillator2.connect(gainNode2)
        gainNode2.connect(audioContext.destination)
        
        oscillator2.frequency.value = 1000
        oscillator2.type = 'sine'
        
        gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime)
        gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
        
        oscillator2.start(audioContext.currentTime)
        oscillator2.stop(audioContext.currentTime + 0.5)
      }, 300)
    } catch (error) {
      console.error('[useOrderNotifications] Erro ao tocar som:', error)
    }
  }, [])

  // Busca pedidos pendentes do backend
  const fetchPendingOrders = useCallback(async (): Promise<number> => {
    if (!currentTenant) return 0

    try {
      const apiUrl = getApiUrl()
      const response = await authenticatedFetch(`${apiUrl}/api/orders`)

      if (response.ok) {
        const data = await response.json()
        const orders = data.orders || []
        // Filtra apenas pedidos pendentes
        return orders.filter((order: any) => order.status === 'pending').length
      }
    } catch (error) {
      console.error('[useOrderNotifications] Erro ao buscar pedidos:', error)
    }

    return 0
  }, [currentTenant])

  // Inicializa o contador quando o tenant carrega
  useEffect(() => {
    if (currentTenant && !isInitialized.current) {
      fetchPendingOrders().then((count) => {
        setLastPendingCount(count)
        isInitialized.current = true
      })
    }
  }, [currentTenant, fetchPendingOrders])

  // Monitora novos pedidos a cada 2 segundos
  useEffect(() => {
    if (!currentTenant || !isInitialized.current) return

    const interval = setInterval(async () => {
      const pendingCount = await fetchPendingOrders()

      // Detecta novos pedidos
      if (pendingCount > lastPendingCount && lastPendingCount >= 0) {
        const newOrdersCount = pendingCount - lastPendingCount
        
        // Toca som de notificação
        playNotificationSound()
        
        // Mostra notificação do navegador se permitido
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Novo Pedido!', {
            body: `${newOrdersCount} novo(s) pedido(s) pendente(s)`,
            icon: '/favicon.ico',
            tag: 'new-order',
            requireInteraction: false,
          })
        }
        
        // Mostra toast
        toast({
          title: 'Novo Pedido!',
          description: `${newOrdersCount} novo(s) pedido(s) recebido(s)`,
        })
      }

      if (pendingCount !== lastPendingCount) {
        setLastPendingCount(pendingCount)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [currentTenant, lastPendingCount, toast, fetchPendingOrders, playNotificationSound])

  // Solicita permissão de notificação quando o hook é montado
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])
}

