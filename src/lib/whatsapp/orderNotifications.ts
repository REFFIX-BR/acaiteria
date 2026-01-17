import type { Order } from '@/types'
import { getTenantData } from '@/lib/storage/storage'
import type { WhatsAppConfig, WhatsAppInstance } from '@/types'

/**
 * Formata número de telefone para o formato esperado pela API
 */
function formatPhone(phone: string): string {
  // Remove caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '')

  // Se não começar com código do país, assume Brasil (55)
  if (cleaned.length === 11 && !cleaned.startsWith('55')) {
    cleaned = '55' + cleaned
  } else if (cleaned.length === 10 && !cleaned.startsWith('55')) {
    // Se for número de 10 dígitos (sem 9 antes do número)
    cleaned = '55' + cleaned
  }

  return cleaned
}

/**
 * Envia mensagem via WhatsApp usando o endpoint api.reffix.com.br
 */
export async function sendWhatsAppMessage(
  instance: string,
  phone: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedPhone = formatPhone(phone)

    const response = await fetch(`https://api.reffix.com.br/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: text,
      }),
    })

    const data = await response.json()

    if (response.ok) {
      return { success: true }
    } else {
      return {
        success: false,
        error: data.message || 'Erro ao enviar mensagem',
      }
    }
  } catch (error) {
    console.error('Erro ao enviar mensagem WhatsApp:', error)
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
    // Busca a configuração do WhatsApp
    const config = getTenantData<WhatsAppConfig>(tenantId, 'whatsapp_config')
    if (!config || !config.connected) {
      return {
        success: false,
        error: 'WhatsApp não configurado ou desconectado',
      }
    }

    // Busca a instância do WhatsApp
    const instance = getTenantData<WhatsAppInstance>(tenantId, 'whatsapp_instance')
    if (!instance || !instance.instanceName || instance.status !== 'connected') {
      return {
        success: false,
        error: 'Instância do WhatsApp não encontrada ou desconectada',
      }
    }

    // Verifica se o pedido tem número de telefone
    if (!order.customerPhone) {
      return {
        success: false,
        error: 'Pedido sem número de telefone do cliente',
      }
    }

    // Gera a mensagem personalizada
    const message = generateStatusMessage(order, newStatus)

    // Envia a mensagem
    const result = await sendWhatsAppMessage(instance.instanceName, order.customerPhone, message)

    return result
  } catch (error) {
    console.error('Erro ao enviar notificação de status:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

