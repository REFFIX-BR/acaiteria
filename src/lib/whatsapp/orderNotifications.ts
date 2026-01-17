import type { Order } from '@/types'
import { getTenantData } from '@/lib/storage/storage'
import type { WhatsAppInstance } from '@/types'

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
    const { authenticatedFetch } = await import('@/lib/api/auth')
    
    const apiUrl = getApiUrl()
    const url = `${apiUrl}/api/whatsapp/messages/send`
    
    console.log('[WhatsApp] Enviando mensagem via backend:', {
      url,
      instance,
      phone,
      textLength: text.length,
    })

    const response = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
 * Gera mensagem personalizada baseada no status do pedido
 */
function generateStatusMessage(order: Order, status: Order['status']): string {
  const orderId = order.id.slice(-8)
  const customerName = order.customerName.split(' ')[0] // Primeiro nome apenas

  switch (status) {
    case 'accepted':
      return `✅ Olá ${customerName}! Seu pedido #${orderId} foi *aceito* e está sendo preparado com muito carinho! 🍇\n\nObrigado pela preferência! 😊`

    case 'preparing':
      return `👨‍🍳 ${customerName}, seu pedido #${orderId} está *em preparo*! Logo mais estará pronto para você! ⏱️\n\nAguarde, por favor! 🙏`

    case 'ready':
      if (order.deliveryType === 'delivery') {
        return `🚀 ${customerName}, seu pedido #${orderId} está *pronto* e já saiu para entrega! 🚚\n\nEntraremos em contato em breve. Obrigado! 😊`
      } else {
        return `✨ ${customerName}, seu pedido #${orderId} está *pronto para retirada*! 🎉\n\nPode vir buscar quando quiser. Esperamos você! 😊`
      }

    case 'delivered':
      return `🎉 ${customerName}, seu pedido #${orderId} foi *entregue*! Esperamos que tenha gostado! ❤️\n\nObrigado pela preferência! Volte sempre! 😊`

    case 'cancelled':
      return `❌ ${customerName}, infelizmente seu pedido #${orderId} foi *cancelado*.\n\nSe tiver alguma dúvida, entre em contato conosco. 😔`

    default:
      return `Olá ${customerName}! Seu pedido #${orderId} teve uma atualização.`
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

    // Busca a instância do WhatsApp primeiro (fonte mais confiável do status)
    const instance = getTenantData<WhatsAppInstance>(tenantId, 'whatsapp_instance')
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

