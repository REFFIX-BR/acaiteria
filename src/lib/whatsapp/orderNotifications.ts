import type { Order } from '@/types'
import type { WhatsAppInstance } from '@/types'
import { getApiUrl } from '@/lib/api/config'
import { getAuthToken } from '@/lib/api/auth'

/**
 * Envia mensagem via WhatsApp usando o endpoint do backend
 */
async function sendWhatsAppMessage(
  instance: string,
  phone: string,
  text: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Importa dinamicamente para evitar dependência circular
    const { getApiUrl } = await import('@/lib/api/config')
    const { getAuthToken } = await import('@/lib/api/auth')
    
    const apiUrl = getApiUrl()
    const url = `${apiUrl}/api/whatsapp/messages/send`
    
    // Verifica se localStorage está disponível
    const isLocalStorageAvailable = typeof window !== 'undefined' && window.localStorage !== null
    console.log('[WhatsApp] localStorage disponível:', isLocalStorageAvailable)
    
    // Obtém o token do localStorage (pode ser null)
    const token = getAuthToken()
    
    // Log detalhado sobre o token
    console.log('[WhatsApp] Token de autenticação:', {
      exists: !!token,
      length: token ? token.length : 0,
      preview: token ? `${token.substring(0, 20)}...` : null,
      localStorageKey: 'auth_token',
      localStorageValue: isLocalStorageAvailable ? localStorage.getItem('auth_token') : 'N/A (localStorage não disponível)',
    })
    
    console.log('[WhatsApp] Enviando mensagem via backend:', {
      url,
      instance,
      phone,
      textLength: text.length,
      hasToken: !!token,
    })

    // Constrói headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    // Adiciona token se existir
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Faz a requisição diretamente com fetch
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        instanceName: instance,
        phone: phone,
        text: text,
      }),
    })

    console.log('[WhatsApp] Resposta recebida:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    })

    const data = await response.json()

    if (response.ok) {
      console.log('[WhatsApp] Mensagem enviada com sucesso!', data)
      return { success: true }
    } else {
      const errorMsg = data.error || data.message || `Erro HTTP ${response.status}`
      console.error('[WhatsApp] Erro ao enviar mensagem:', errorMsg, data)
      return {
        success: false,
        error: errorMsg,
      }
    }
  } catch (error) {
    console.error('[WhatsApp] Erro ao enviar mensagem WhatsApp:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

/**
 * Formata os itens do pedido para exibição na mensagem
 */
function formatOrderItems(order: Order): string {
  if (!order.items || order.items.length === 0) {
    return ''
  }

  const itemsText = order.items.map((item) => {
    let itemText = `• ${item.quantity}x ${item.menuItemName}`
    
    if (item.size) {
      itemText += ` (${item.size})`
    }
    
    const extras: string[] = []
    if (item.additions && item.additions.length > 0) {
      extras.push(`Coberturas: ${item.additions.join(', ')}`)
    }
    if (item.complements && item.complements.length > 0) {
      extras.push(`Complementos: ${item.complements.join(', ')}`)
    }
    if (item.fruits && item.fruits.length > 0) {
      extras.push(`Frutas: ${item.fruits.join(', ')}`)
    }
    
    if (extras.length > 0) {
      itemText += `\n  ${extras.join(', ')}`
    }
    
    return itemText
  }).join('\n')

  return `\n\n*Resumo do pedido:*\n${itemsText}\n\n*Total: R$ ${order.total.toFixed(2).replace('.', ',')}*`
}

/**
 * Gera mensagem personalizada baseada no status do pedido
 */
function generateStatusMessage(order: Order, status: Order['status']): string {
  const customerName = order.customerName.split(' ')[0] // Primeiro nome apenas
  const itemsSummary = formatOrderItems(order)

  switch (status) {
    case 'accepted':
      return `✅ Olá ${customerName}! Seu pedido foi *aceito* e está sendo preparado com muito carinho! 🍇${itemsSummary}\n\nObrigado pela preferência! 😊`

    case 'preparing':
      return `👨‍🍳 ${customerName}, seu pedido está *em preparo*! Logo mais estará pronto para você! ⏱️${itemsSummary}\n\nAguarde, por favor! 🙏`

    case 'ready':
      if (order.deliveryType === 'delivery') {
        return `🚀 ${customerName}, seu pedido está *pronto* e já saiu para entrega! 🚚${itemsSummary}\n\nEntraremos em contato em breve. Obrigado! 😊`
      } else {
        return `✨ ${customerName}, seu pedido está *pronto para retirada*! 🎉${itemsSummary}\n\nPode vir buscar quando quiser. Esperamos você! 😊`
      }

    case 'delivered':
      return `🎉 ${customerName}, seu pedido foi *entregue*! Esperamos que tenha gostado! ❤️${itemsSummary}\n\nObrigado pela preferência! Volte sempre! 😊`

    case 'cancelled':
      return `❌ ${customerName}, infelizmente seu pedido foi *cancelado*.${itemsSummary}\n\nSe tiver alguma dúvida, entre em contato conosco. 😔`

    default:
      return `Olá ${customerName}! Seu pedido teve uma atualização.${itemsSummary}`
  }
}

/**
 * Envia notificação de mudança de status do pedido via WhatsApp
 */
export async function notifyOrderStatusChange(
  tenantId: string,
  order: Order,
  newStatus: Order['status']
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[WhatsApp Notificação] Iniciando notificação de mudança de status:', {
      tenantId,
      orderId: order.id,
      newStatus,
      customerPhone: order.customerPhone,
    })

    // Busca a instância do WhatsApp do backend
    let instance: WhatsAppInstance | null = null
    try {
      const apiUrl = getApiUrl()
      const token = getAuthToken()
      
      if (!token) {
        console.warn('[WhatsApp Notificação] Token de autenticação não encontrado')
        return {
          success: false,
          error: 'Token de autenticação não encontrado',
        }
      }

      const response = await fetch(`${apiUrl}/api/whatsapp/instances/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.instance) {
          instance = {
            ...result.instance,
            createdAt: new Date(result.instance.createdAt),
            updatedAt: new Date(result.instance.updatedAt),
          }
        }
      }
    } catch (error) {
      console.error('[WhatsApp Notificação] Erro ao buscar instância:', error)
    }
    
    console.log('[WhatsApp Notificação] Instância:', instance)
    
    if (!instance || !instance.instanceName || instance.status !== 'connected') {
      const error = 'Instância do WhatsApp não encontrada ou desconectada'
      console.warn('[WhatsApp Notificação]', error)
      return {
        success: false,
        error,
      }
    }


    // Verifica se o pedido tem número de telefone
    if (!order.customerPhone) {
      const error = 'Pedido sem número de telefone do cliente'
      console.warn('[WhatsApp Notificação]', error)
      return {
        success: false,
        error,
      }
    }

    // Gera a mensagem personalizada
    const message = generateStatusMessage(order, newStatus)
    console.log('[WhatsApp Notificação] Mensagem gerada:', message.substring(0, 100) + '...')

    // Envia a mensagem via backend (que tem a API key configurada)
    const result = await sendWhatsAppMessage(
      instance.instanceName, 
      order.customerPhone, 
      message,
      tenantId
    )
    
    if (result.success) {
      console.log('[WhatsApp Notificação] Notificação enviada com sucesso!')
    } else {
      console.error('[WhatsApp Notificação] Falha ao enviar notificação:', result.error)
    }

    return result
  } catch (error) {
    console.error('[WhatsApp Notificação] Erro ao enviar notificação de status:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

