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
  const ringTimeoutRef = useRef<number | null>(null)
  const isRingingRef = useRef(false)
  const ringAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioUnlockedRef = useRef(false)
  const pendingRingRef = useRef(false)
  const broadcastRef = useRef<BroadcastChannel | null>(null)

  const stopRingtone = useCallback(() => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current)
      ringTimeoutRef.current = null
    }
    if (ringAudioRef.current) {
      ringAudioRef.current.pause()
      ringAudioRef.current.currentTime = 0
    }
    isRingingRef.current = false
  }, [])

  const startRingtone = useCallback(() => {
    if (isRingingRef.current) return
    isRingingRef.current = true

    if (ringAudioRef.current && audioUnlockedRef.current) {
      ringAudioRef.current.play().catch(() => {
        pendingRingRef.current = true
      })
    } else if (ringAudioRef.current) {
      pendingRingRef.current = true
    }

    ringTimeoutRef.current = window.setTimeout(() => {
      stopRingtone()
    }, 10 * 60 * 1000)
  }, [stopRingtone])

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
        
        // Inicia toque contínuo por até 10 minutos
        startRingtone()
        broadcastRef.current?.postMessage({ type: 'NEW_ORDER' })
        
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

      // Se não há mais pedidos pendentes, parar o toque
      if (pendingCount === 0) {
        stopRingtone()
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [currentTenant, lastPendingCount, toast, fetchPendingOrders, startRingtone, stopRingtone])

  // Solicita permissão de notificação quando o hook é montado
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Prepara áudio real do toque
  useEffect(() => {
    const audio = new Audio('/sounds/order-ring.mp3')
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = 0.7
    ringAudioRef.current = audio

    return () => {
      audio.pause()
      ringAudioRef.current = null
    }
  }, [])

  // Desbloqueia áudio com interação do usuário (requisito do navegador)
  useEffect(() => {
    const unlock = () => {
      if (!ringAudioRef.current || audioUnlockedRef.current) return
      ringAudioRef.current.play().then(() => {
        ringAudioRef.current?.pause()
        ringAudioRef.current && (ringAudioRef.current.currentTime = 0)
        audioUnlockedRef.current = true
        if (pendingRingRef.current) {
          pendingRingRef.current = false
          startRingtone()
        }
      }).catch(() => {
        // precisa de interação do usuário para liberar áudio
      })
    }

    window.addEventListener('click', unlock)
    window.addEventListener('keydown', unlock)
    window.addEventListener('touchstart', unlock)

    return () => {
      window.removeEventListener('click', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
    }
  }, [startRingtone])

  // Sincroniza toque entre abas
  useEffect(() => {
    const channel = new BroadcastChannel('order-notifications')
    broadcastRef.current = channel
    channel.onmessage = (event) => {
      if (event.data?.type === 'NEW_ORDER') {
        startRingtone()
      }
    }
    return () => {
      channel.close()
      broadcastRef.current = null
    }
  }, [startRingtone])

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current)
        ringTimeoutRef.current = null
      }
      isRingingRef.current = false
    }
  }, [])
}

