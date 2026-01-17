import type { WhatsAppConfig, Customer, WhatsAppSend } from '@/types'

export interface InstanceStatus {
  instance: {
    instanceName: string
    status: 'created' | 'connecting' | 'open' | 'close'
    state?: string
  }
  qrcode?: {
    code: string
    base64?: string
  }
  pairingCode?: {
    code: string
  }
}

/**
 * Cliente para integração com Evolution API
 */
export class EvolutionAPIClient {
  private apiUrl: string
  private apiKey: string

  constructor(config: WhatsAppConfig) {
    this.apiUrl = config.apiUrl.replace(/\/$/, '') // Remove trailing slash
    this.apiKey = config.apiKey
  }

  /**
   * Verifica se a API está conectada
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json',
        },
      })
      return response.ok
    } catch (error) {
      console.error('Erro ao verificar conexão:', error)
      return false
    }
  }

  /**
   * Cria uma nova instância do WhatsApp
   */
  async createInstance(instanceName: string, qrcode: boolean = true, number?: string): Promise<{ success: boolean; data?: InstanceStatus; error?: string }> {
    try {
      const body: any = {
        instanceName,
        qrcode,
        integration: 'WHATSAPP-BAILEYS',
      }

      if (number && !qrcode) {
        body.number = number
      }

      const response = await fetch(`${this.apiUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (response.ok) {
        return {
          success: true,
          data: data as InstanceStatus,
        }
      } else {
        return {
          success: false,
          error: data.message || 'Erro ao criar instância',
        }
      }
    } catch (error) {
      console.error('Erro ao criar instância:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  }

  /**
   * Obtém o QR Code da instância
   */
  async getQRCode(instanceName: string): Promise<{ success: boolean; qrcode?: string; base64?: string; error?: string }> {
    try {
      const response = await fetch(`${this.apiUrl}/instance/connect/${instanceName}`, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok) {
        return {
          success: true,
          qrcode: data.qrcode?.code,
          base64: data.qrcode?.base64,
        }
      } else {
        return {
          success: false,
          error: data.message || 'Erro ao obter QR Code',
        }
      }
    } catch (error) {
      console.error('Erro ao obter QR Code:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  }

  /**
   * Gera um Pairing Code para conectar via número de telefone
   */
  async generatePairingCode(instanceName: string, phoneNumber: string): Promise<{ success: boolean; pairingCode?: string; error?: string }> {
    try {
      const response = await fetch(`${this.apiUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceName,
          qrcode: false,
          number: phoneNumber.replace(/\D/g, ''),
          integration: 'WHATSAPP-BAILEYS',
        }),
      })

      const data = await response.json()

      if (response.ok) {
        return {
          success: true,
          pairingCode: data.pairingCode?.code || data.pairing_code,
        }
      } else {
        return {
          success: false,
          error: data.message || 'Erro ao gerar Pairing Code',
        }
      }
    } catch (error) {
      console.error('Erro ao gerar Pairing Code:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  }

  /**
   * Verifica o status da instância
   */
  async getInstanceStatus(instanceName: string): Promise<{ success: boolean; status?: InstanceStatus; error?: string }> {
    try {
      const response = await fetch(`${this.apiUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok && Array.isArray(data)) {
        const instance = data.find((inst: any) => inst.instance.instanceName === instanceName)
        if (instance) {
          return {
            success: true,
            status: instance as InstanceStatus,
          }
        }
        return {
          success: false,
          error: 'Instância não encontrada',
        }
      } else {
        return {
          success: false,
          error: data.message || 'Erro ao verificar status',
        }
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  }

  /**
   * Obtém código de conexão (QR Code ou Pairing Code)
   */
  async getConnectionCode(instanceName: string): Promise<{ success: boolean; qrcode?: string; pairingCode?: string; error?: string }> {
    try {
      const response = await fetch(`${this.apiUrl}/instance/connect/${instanceName}`, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok) {
        let qrcode: string | undefined
        let pairingCode: string | undefined

        // QR Code pode vir em diferentes formatos
        if (data.qrcode?.base64) {
          qrcode = data.qrcode.base64.startsWith('data:') 
            ? data.qrcode.base64 
            : `data:image/png;base64,${data.qrcode.base64}`
        } else if (data.qrcode?.code) {
          qrcode = data.qrcode.code
        } else if (typeof data.qrcode === 'string') {
          qrcode = data.qrcode
        }

        // Pairing Code
        if (data.pairingCode?.code) {
          pairingCode = this.formatPairingCode(data.pairingCode.code)
        } else if (data.pairing_code) {
          pairingCode = this.formatPairingCode(data.pairing_code)
        } else if (data.pairingCode) {
          pairingCode = this.formatPairingCode(data.pairingCode)
        }

        return {
          success: true,
          qrcode,
          pairingCode,
        }
      } else {
        return {
          success: false,
          error: data.message || 'Erro ao obter código de conexão',
        }
      }
    } catch (error) {
      console.error('Erro ao obter código de conexão:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  }

  /**
   * Verifica o estado da conexão
   */
  async getConnectionState(instanceName: string): Promise<{ success: boolean; connectionStatus?: string; isConnected?: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.apiUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok) {
        let instance: any = null

        if (Array.isArray(data)) {
          instance = data.find((inst: any) => 
            inst.instance?.instanceName === instanceName || 
            inst.instanceName === instanceName
          )
        } else if (data.instance) {
          instance = data
        }

        if (instance) {
          const connectionStatus = 
            instance.instance?.state || 
            instance.instance?.status || 
            instance.state || 
            instance.status || 
            instance.connectionStatus || 
            'close'

          const isConnected = 
            connectionStatus === 'open' || 
            connectionStatus === 'connected' || 
            connectionStatus === 'CONNECTED'

          return {
            success: true,
            connectionStatus,
            isConnected,
          }
        }

        return {
          success: false,
          error: 'Instância não encontrada',
        }
      } else {
        return {
          success: false,
          error: data.message || 'Erro ao verificar estado da conexão',
        }
      }
    } catch (error) {
      console.error('Erro ao verificar estado da conexão:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  }

  /**
   * Desconecta uma instância (logout)
   */
  async logoutInstance(instanceName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.apiUrl}/instance/logout/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        return { success: true }
      } else {
        const data = await response.json()
        return {
          success: false,
          error: data.message || 'Erro ao desconectar instância',
        }
      }
    } catch (error) {
      console.error('Erro ao desconectar instância:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  }

  /**
   * Conecta via Pairing Code (cria instância com número)
   */
  async connectWithPairingCode(instanceName: string, phoneNumber: string): Promise<{ success: boolean; pairingCode?: string; error?: string }> {
    try {
      // Valida e formata número
      const validated = this.validateBrazilianPhone(phoneNumber)
      if (!validated.valid) {
        return {
          success: false,
          error: validated.error || 'Número de telefone inválido',
        }
      }

      // Cria instância com número
      const createResult = await this.createInstance(instanceName, false, validated.formatted)
      if (!createResult.success) {
        return createResult
      }

      // Aguarda um pouco para o código ser gerado
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Obtém o pairing code
      const codeResult = await this.getConnectionCode(instanceName)
      if (codeResult.success && codeResult.pairingCode) {
        return {
          success: true,
          pairingCode: codeResult.pairingCode,
        }
      }

      return {
        success: false,
        error: 'Erro ao obter Pairing Code',
      }
    } catch (error) {
      console.error('Erro ao conectar com Pairing Code:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  }

  /**
   * Deleta uma instância
   */
  async deleteInstance(instanceName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.apiUrl}/instance/delete/${instanceName}`, {
        method: 'DELETE',
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        return { success: true }
      } else {
        const data = await response.json()
        return {
          success: false,
          error: data.message || 'Erro ao deletar instância',
        }
      }
    } catch (error) {
      console.error('Erro ao deletar instância:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  }

  /**
   * Envia mensagem para um número
   */
  async sendMessage(
    instanceName: string,
    phone: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Formata o número (remove caracteres não numéricos, adiciona código do país se necessário)
      const formattedPhone = this.formatPhone(phone)

      const endpoint = `${this.apiUrl}/message/sendText/${instanceName}`
      const payload = {
        number: formattedPhone,
        text: message,
      }

      console.log('[EvolutionAPI] Enviando mensagem:', {
        endpoint,
        instanceName,
        phone: formattedPhone,
        messageLength: message.length,
        apiUrl: this.apiUrl,
      })

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      console.log('[EvolutionAPI] Resposta do envio:', {
        status: response.status,
        ok: response.ok,
        data,
      })

      if (response.ok) {
        return {
          success: true,
          messageId: data.key?.id || data.messageId || `msg-${Date.now()}`,
        }
      } else {
        const errorMessage = data.message || data.error || 'Erro ao enviar mensagem'
        console.error('[EvolutionAPI] Erro ao enviar mensagem:', {
          status: response.status,
          error: errorMessage,
          data,
        })
        return {
          success: false,
          error: errorMessage,
        }
      }
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao enviar mensagem:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  }

  /**
   * Envia mídia (imagem, vídeo ou documento) para um número
   */
  async sendMedia(
    instanceName: string,
    phone: string,
    mediaUrl: string,
    caption: string = '',
    mediaType: 'image' | 'video' | 'document' = 'image',
    fileName?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Formata o número (remove caracteres não numéricos, adiciona código do país se necessário)
      const formattedPhone = this.formatPhone(phone)

      // Detecta mimetype baseado na extensão ou tipo de mídia
      let mimetype = 'image/jpeg'
      if (mediaType === 'image') {
        const extension = mediaUrl.split('.').pop()?.toLowerCase()
        if (extension === 'png') mimetype = 'image/png'
        else if (extension === 'gif') mimetype = 'image/gif'
        else if (extension === 'webp') mimetype = 'image/webp'
        else mimetype = 'image/jpeg'
      } else if (mediaType === 'video') {
        mimetype = 'video/mp4'
      } else if (mediaType === 'document') {
        mimetype = 'application/pdf'
      }

      // Extrai nome do arquivo da URL se não fornecido
      const finalFileName = fileName || mediaUrl.split('/').pop() || `image.${mimetype.split('/')[1]}`

      const endpoint = `${this.apiUrl}/message/sendMedia/${instanceName}`
      const payload: any = {
        number: formattedPhone,
        mediatype: mediaType,
        mimetype,
        media: mediaUrl,
        fileName: finalFileName,
      }

      // Adiciona caption se fornecido
      if (caption) {
        payload.caption = caption
      }

      console.log('[EvolutionAPI] Enviando mídia:', {
        endpoint,
        fullUrl: endpoint,
        apiUrl: this.apiUrl,
        instanceName,
        phone: formattedPhone,
        mediaType,
        mimetype,
        mediaUrl: mediaUrl.substring(0, 80) + (mediaUrl.length > 80 ? '...' : ''),
        caption: caption.substring(0, 50) + (caption.length > 50 ? '...' : ''),
        payload: {
          ...payload,
          media: payload.media.substring(0, 80) + '...',
        },
      })

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      console.log('[EvolutionAPI] Resposta do envio de mídia:', {
        status: response.status,
        ok: response.ok,
        data,
      })

      if (response.ok) {
        return {
          success: true,
          messageId: data.key?.id || data.messageId || `msg-${Date.now()}`,
        }
      } else {
        const errorMessage = data.message || data.error || 'Erro ao enviar mídia'
        console.error('[EvolutionAPI] Erro ao enviar mídia:', {
          status: response.status,
          error: errorMessage,
          data,
        })
        return {
          success: false,
          error: errorMessage,
        }
      }
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao enviar mídia:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  }

  /**
   * Envia mensagem em massa para uma lista de clientes
   */
  async sendBulkMessage(
    instanceName: string,
    customers: Customer[],
    message: string,
    onProgress?: (sent: number, total: number, success: boolean) => void,
    sendInterval: number = 15, // Intervalo padrão de 15 segundos
    imageUrl?: string // URL da imagem da campanha (opcional)
  ): Promise<{ sent: number; failed: number; results: Array<{ customerId: string; success: boolean; error?: string }> }> {
    let sent = 0
    let failed = 0
    const results: Array<{ customerId: string; success: boolean; error?: string }> = []

    // Garantir que o intervalo seja no mínimo 15 segundos
    const interval = Math.max(15, sendInterval) * 1000 // Converter para milissegundos

    console.log('[EvolutionAPI] sendBulkMessage iniciado:', {
      totalCustomers: customers.length,
      hasImage: !!imageUrl,
      imageUrl: imageUrl?.substring(0, 50) + (imageUrl && imageUrl.length > 50 ? '...' : ''),
      sendInterval,
      instanceName,
    })

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i]
      
      // Se houver imagem, envia mídia, senão envia texto
      let result
      if (imageUrl) {
        console.log(`[EvolutionAPI] Enviando mídia para cliente ${i + 1}/${customers.length}:`, {
          customerId: customer.id,
          phone: customer.phone,
          imageUrl: imageUrl.substring(0, 50) + '...',
        })
        result = await this.sendMedia(
          instanceName,
          customer.phone,
          imageUrl,
          message, // Usa a mensagem como caption
          'image'
        )
      } else {
        console.log(`[EvolutionAPI] Enviando texto para cliente ${i + 1}/${customers.length}:`, {
          customerId: customer.id,
          phone: customer.phone,
        })
        result = await this.sendMessage(instanceName, customer.phone, message)
      }
      
      results.push({
        customerId: customer.id,
        success: result.success,
        error: result.error,
      })

      if (result.success) {
        sent++
      } else {
        failed++
      }

      if (onProgress) {
        onProgress(sent + failed, customers.length, result.success)
      }

      // Aguardar intervalo configurado entre mensagens (exceto na última)
      if (i < customers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, interval))
      }
    }

    return { sent, failed, results }
  }

  /**
   * Formata número de telefone para o formato esperado pela API
   */
  private formatPhone(phone: string): string {
    // Remove caracteres não numéricos
    let cleaned = phone.replace(/\D/g, '')

    // Se não começar com código do país, assume Brasil (55)
    if (cleaned.length === 11 && cleaned.startsWith('55') === false) {
      cleaned = '55' + cleaned
    }

    // Adiciona @s.whatsapp.net se necessário
    if (!cleaned.includes('@')) {
      cleaned = cleaned + '@s.whatsapp.net'
    }

    return cleaned
  }

  /**
   * Valida e formata número de telefone brasileiro
   */
  validateBrazilianPhone(phone: string): { valid: boolean; formatted?: string; error?: string } {
    // Remove caracteres não numéricos
    let cleaned = phone.replace(/\D/g, '')

    // Validação básica
    if (cleaned.length < 10) {
      return {
        valid: false,
        error: 'Número muito curto. Use pelo menos 10 dígitos.',
      }
    }

    // Se começa com 55 (código do Brasil), remove temporariamente para validação
    let hasCountryCode = false
    if (cleaned.startsWith('55')) {
      hasCountryCode = true
      cleaned = cleaned.substring(2)
    }

    // Valida DDD (2 dígitos) + número (8 ou 9 dígitos)
    if (cleaned.length < 10 || cleaned.length > 11) {
      return {
        valid: false,
        error: 'Formato inválido. Use: DDD + número (10 ou 11 dígitos).',
      }
    }

    // Formata para incluir código do país
    const formatted = '55' + cleaned

    return {
      valid: true,
      formatted,
    }
  }

  /**
   * Formata Pairing Code para exibição (XXXX-XXXX)
   */
  private formatPairingCode(code: string): string {
    // Remove espaços e hífens existentes
    const cleaned = code.replace(/[\s-]/g, '')
    
    // Se tiver 8 caracteres, formata como XXXX-XXXX
    if (cleaned.length === 8) {
      return `${cleaned.substring(0, 4)}-${cleaned.substring(4)}`
    }
    
    // Caso contrário, retorna como está
    return cleaned
  }
}

/**
 * Normaliza nome da instância (remove acentos, caracteres especiais, etc)
 */
export function normalizeInstanceName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, '-')      // Substitui caracteres especiais por hífen
    .replace(/-+/g, '-')              // Remove múltiplos hífens
    .replace(/^-|-$/g, '')            // Remove hífens no início e fim
}

