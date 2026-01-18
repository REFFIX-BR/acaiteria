/**
 * WhatsApp Instance Manager
 * Gerencia todas as interações com a Evolution API Manager
 */

interface EvolutionAPIConfig {
  managerUrl: string
  managerEmail?: string
  managerPassword?: string
  apiKey?: string
  globalApiKey?: string
}

interface CreateInstancePayload {
  instanceName: string
  qrcode?: boolean
  number?: string
  integration?: string
}

interface ConnectionCodeResponse {
  qrcode?: string // Data URL do QR Code (data:image/png;base64,...)
  pairingCode?: string // Código de 8 dígitos formatado (XXXX-XXXX)
}

interface InstanceStatusResponse {
  status: 'open' | 'close' | 'connecting' | 'created' | 'connected' | 'disconnected'
  instanceName: string
}

export class WhatsAppInstanceManager {
  private config: EvolutionAPIConfig
  private authToken: string | null = null
  private tokenExpiry: number | null = null

  constructor(config: EvolutionAPIConfig) {
    this.config = config
  }

  /**
   * Log da configuração (sem expor credenciais completas)
   */
  logConfiguration(): void {
    console.log('[WhatsApp Manager] Configuração:', {
      managerUrl: this.config.managerUrl,
      hasEmail: !!this.config.managerEmail,
      hasPassword: !!this.config.managerPassword,
      hasApiKey: !!this.config.apiKey,
      hasGlobalApiKey: !!this.config.globalApiKey,
    })
  }

  /**
   * Autentica no Manager API
   */
  async authenticate(): Promise<string | null> {
    // Se já temos um token válido, retornar
    if (this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.authToken
    }

    // Prioridade 1: Tentar fazer login mesmo com API Key (algumas versões da Evolution API exigem token JWT)
    // Se tiver email/password, tentar login primeiro
    if (this.config.managerEmail && this.config.managerPassword) {
      const loginEndpoints = [
        `${this.config.managerUrl}/auth/login`,
        `${this.config.managerUrl}/api/auth/login`,
        `${this.config.managerUrl}/api/v1/auth/login`,
        `${this.config.managerUrl}/manager/auth/login`,
        `${this.config.managerUrl}/public/auth/login`,
      ]

      for (const endpoint of loginEndpoints) {
        try {
          console.log(`[WhatsApp Manager] Tentando login em: ${endpoint}`)
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              email: this.config.managerEmail,
              password: this.config.managerPassword,
            }),
          })

          if (response.ok) {
            const data = await response.json() as any
            // Evolution API retorna token em data.token (testado com curl)
            const token = data.data?.token || data.token || data.accessToken || data.access_token
            
            if (token) {
              this.authToken = token
              // Token expira em 24 horas (padrão)
              this.tokenExpiry = Date.now() + 24 * 60 * 60 * 1000
              console.log('[WhatsApp Manager] Login bem-sucedido, token JWT obtido')
              return token
            }
          }
        } catch (error) {
          console.warn(`[WhatsApp Manager] Erro ao tentar login em ${endpoint}:`, error)
          continue
        }
      }
    }

    // Prioridade 2: API Key (fallback se login não funcionar)
    if (this.config.apiKey || this.config.globalApiKey) {
      const apiKey = this.config.apiKey || this.config.globalApiKey
      console.log('[WhatsApp Manager] Usando API Key para autenticação (fallback)')
      return apiKey || null
    }

    console.error('[WhatsApp Manager] Credenciais do Manager API não configuradas')
    return null
  }

  /**
   * Faz requisição autenticada (método público para uso nas rotas)
   */
  async authenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.authenticate()
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json', // Importante: força retorno JSON em vez de HTML
      ...(options.headers as Record<string, string> || {}),
    }

    if (token) {
      // Verificar se o token parece ser uma API Key (geralmente mais curto) ou JWT (mais longo, contém pontos)
      const isJWT = token.includes('.') && token.split('.').length === 3
      const isApiKey = !isJWT && (this.config.apiKey || this.config.globalApiKey)
      
      if (isApiKey) {
        // Evolution API usa 'apikey' como header para API Keys
        headers['apikey'] = token
        console.log('[WhatsApp Manager] Enviando requisição com API Key (header: apikey)')
      } else {
        // JWT token usa Authorization Bearer
        headers['Authorization'] = `Bearer ${token}`
        console.log('[WhatsApp Manager] Enviando requisição com Bearer token (JWT)')
      }
    } else {
      console.warn('[WhatsApp Manager] Nenhum token disponível para autenticação')
    }

    console.log('[WhatsApp Manager] Headers da requisição:', {
      url,
      hasApikey: !!headers['apikey'],
      hasAuthorization: !!headers['Authorization'],
      method: options.method || 'GET',
    })

    return fetch(url, {
      ...options,
      headers: headers as any,
    })
  }

  /**
   * Valida e formata número de telefone brasileiro
   */
  validateBrazilianPhone(phone: string): string {
    // Remove caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '')
    
    // Se já tem código do país (13 dígitos), retornar como está
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      return cleaned
    }
    
    // Se tem 10 ou 11 dígitos, adicionar código do país
    if (cleaned.length === 10 || cleaned.length === 11) {
      return `55${cleaned}`
    }
    
    // Se já tem 12 dígitos (sem o código do país mas com formato internacional), retornar
    if (cleaned.length === 12) {
      return cleaned
    }
    
    throw new Error(`Número de telefone inválido: ${phone} (${cleaned.length} dígitos após limpeza)`)
  }

  /**
   * Cria uma nova instância WhatsApp
   */
  async createInstance(payload: CreateInstancePayload): Promise<{ success: boolean; error?: string; instanceName?: string; instanceToken?: string }> {
    try {
      // A URL base já pode ter /api, então vamos tentar diferentes combinações
      const baseUrl = this.config.managerUrl.replace(/\/api\/?$/, '')
      
      // Baseado nos testes curl: endpoint correto é /api/instances/create (plural!) e requer Bearer token
      const createEndpoints = [
        `${this.config.managerUrl}/instances/create`, // Endpoint correto (plural) - PRIORIDADE
        `${baseUrl}/instances/create`, // Plural sem /api
        `${baseUrl}/instance/create`, // Singular sem /api (fallback)
        `${this.config.managerUrl}/instance/create`, // Singular com /api (fallback)
      ]

      const body: any = {
        name: payload.instanceName, // Evolution API usa 'name' em vez de 'instanceName'
        qrcode: payload.qrcode ?? true, // Sempre true para obter tanto QR Code quanto Pairing Code
        integration: payload.integration || 'WHATSAPP-BAILEYS',
      }

      // Se fornecer número, incluir no body (mesmo com qrcode: true, a API retorna pairingCode)
      if (payload.number) {
        body.number = this.validateBrazilianPhone(payload.number)
      }
      
      // Adicionar também instanceName para compatibilidade
      if (!body.name) {
        body.instanceName = payload.instanceName
      }

      // Obter token primeiro para usar Bearer (obrigatório para /api/instances/create)
      const authToken = await this.authenticate()
      if (!authToken) {
        return { success: false, error: 'Não foi possível autenticar no Manager API' }
      }
      
      for (const endpoint of createEndpoints) {
        try {
          console.log(`[WhatsApp Manager] Criando instância em: ${endpoint}`, {
            instanceName: payload.instanceName,
            qrcode: payload.qrcode,
            hasNumber: !!payload.number,
            body: JSON.stringify(body),
          })

          // Preparar headers com Bearer token (prioridade) ou API Key
          const headers: any = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
          
          if (authToken) {
            const isJWT = authToken.includes('.') && authToken.split('.').length === 3
            if (isJWT) {
              headers['Authorization'] = `Bearer ${authToken}`
              console.log('[WhatsApp Manager] Usando Bearer token para criar instância')
            } else {
              headers['apikey'] = authToken
              console.log('[WhatsApp Manager] Usando API Key para criar instância')
            }
          }

          const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          })
          
          console.log(`[WhatsApp Manager] Resposta do endpoint ${endpoint}:`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
          })

          if (response.ok) {
            // Tentar extrair token da resposta (API Key da instância)
            let instanceToken: string | null = null
            const responseClone = response.clone()
            try {
              const responseData = await response.json() as any
              console.log('[WhatsApp Manager] Resposta da criação:', {
                hasData: !!responseData.data,
                hasToken: !!(responseData.data?.token || responseData.token),
              })
              
              // Token está em data.token (formato da Evolution API)
              instanceToken = responseData.data?.token || responseData.token || null
              
              if (instanceToken) {
                console.log(`[WhatsApp Manager] Token da instância obtido: ${instanceToken.substring(0, 20)}...`)
              }
            } catch (parseError) {
              console.warn('[WhatsApp Manager] Erro ao parsear resposta da criação:', parseError)
              // Tentar ler como texto se JSON falhar
              try {
                const text = await responseClone.text()
                console.warn('[WhatsApp Manager] Resposta não é JSON:', text.substring(0, 200))
              } catch (textError) {
                console.warn('[WhatsApp Manager] Erro ao ler resposta:', textError)
              }
            }
            
            console.log(`[WhatsApp Manager] Instância criada com sucesso: ${payload.instanceName}`)
            return { 
              success: true, 
              instanceName: payload.instanceName,
              instanceToken: instanceToken || undefined,
            }
          }

          // Se erro 409 (Conflict), a instância já existe
          if (response.status === 409) {
            console.warn(`[WhatsApp Manager] Instância já existe: ${payload.instanceName}`)
            // Tentar deletar e recriar
            await this.deleteInstance(payload.instanceName)
            continue
          }

          let errorData: any = {}
          try {
            const text = await response.text()
            errorData = text ? JSON.parse(text) : {}
            console.warn(`[WhatsApp Manager] Erro ao criar instância em ${endpoint}:`, {
              status: response.status,
              statusText: response.statusText,
              error: errorData,
              responseText: text.substring(0, 500), // Primeiros 500 chars
            })
          } catch (parseError) {
            console.warn(`[WhatsApp Manager] Erro ao parsear resposta de ${endpoint}:`, parseError)
          }
        } catch (error) {
          console.warn(`[WhatsApp Manager] Erro ao criar instância em ${endpoint}:`, error)
          continue
        }
      }

      return { success: false, error: 'Não foi possível criar a instância em nenhum endpoint' }
    } catch (error) {
      console.error('[WhatsApp Manager] Erro ao criar instância:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  }

  /**
   * Obtém código de conexão (QR Code ou Pairing Code)
   */
  async getConnectionCode(instanceName: string): Promise<ConnectionCodeResponse> {
    // Remover /api do final da URL se existir
    const baseUrl = this.config.managerUrl.replace(/\/api\/?$/, '')
    
    // Endpoints baseados na documentação da Evolution API
    // Baseado nos testes curl: endpoint correto é /api/instances/connect/{nome}
    // OBS: Não usaremos fetchInstances como o usuário solicitou
    const connectEndpoints = [
      `${this.config.managerUrl}/instances/connect/${instanceName}`, // Endpoint correto (testado com curl!) - PRIORIDADE ÚNICA
    ]

    for (const endpoint of connectEndpoints) {
      try {
        console.log(`[WhatsApp Manager] Obtendo código de conexão de: ${endpoint}`)
        
        // Garantir que estamos usando Bearer token e Accept: application/json
        const authToken = await this.authenticate()
        const headers: any = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
        
        if (authToken) {
          const isJWT = authToken.includes('.') && authToken.split('.').length === 3
          if (isJWT) {
            headers['Authorization'] = `Bearer ${authToken}`
          } else {
            headers['apikey'] = authToken
          }
        }
        
        const response = await fetch(endpoint, {
          method: 'GET',
          headers,
        })

        console.log(`[WhatsApp Manager] Resposta do endpoint ${endpoint}:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          contentType: response.headers.get('content-type'),
        })

        if (response.ok) {
          // Verificar Content-Type
          const contentType = response.headers.get('content-type') || ''
          console.log(`[WhatsApp Manager] Content-Type da resposta: ${contentType}`)
          
          // Se for imagem, converter para base64
          if (contentType.includes('image/')) {
            const arrayBuffer = await response.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            const base64 = buffer.toString('base64')
            const imageType = contentType.includes('png') ? 'png' : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpeg' : 'png'
            console.log(`[WhatsApp Manager] Imagem recebida (${imageType}), convertendo para base64...`)
            return {
              qrcode: `data:image/${imageType};base64,${base64}`,
            }
          }
          
          // Se for HTML, tentar extrair dados ou retornar erro
          if (contentType.includes('text/html')) {
            const htmlText = await response.text()
            console.warn(`[WhatsApp Manager] Resposta HTML recebida de ${endpoint}:`, htmlText.substring(0, 500))
            // Continuar para o próximo endpoint
            continue
          }
          
          // Tentar parsear como JSON
          let data: any
          try {
            data = await response.json() as any
          } catch (jsonError) {
            // Se não for JSON, tentar como texto e verificar se é base64
            const text = await response.text()
            console.log(`[WhatsApp Manager] Resposta não é JSON, tentando como texto/base64:`, text.substring(0, 200))
            
            // Se parecer ser base64 direto
            if (/^[A-Za-z0-9+/=]+$/.test(text.trim()) && text.length > 100) {
              return {
                qrcode: `data:image/png;base64,${text.trim()}`,
              }
            }
            
            // Continuar para o próximo endpoint
            continue
          }
          
          // Se for lista de instâncias (fetchInstances sem nome), filtrar pela instância desejada
          if (Array.isArray(data)) {
            console.log(`[WhatsApp Manager] Lista de instâncias recebida (${data.length} instâncias), filtrando por: ${instanceName}`)
            const instance = data.find((inst: any) => 
              inst.instance?.instanceName === instanceName || 
              inst.instanceName === instanceName ||
              inst.name === instanceName
            )
            
            if (instance) {
              data = instance.instance || instance
              console.log(`[WhatsApp Manager] Instância encontrada na lista!`)
            } else {
              console.warn(`[WhatsApp Manager] Instância ${instanceName} não encontrada na lista`)
              continue
            }
          }
          
          console.log(`[WhatsApp Manager] Dados recebidos de ${endpoint}:`, {
            hasQrcode: !!(data.qrcode || data.base64),
            hasPairingCode: !!(data.pairingCode || data.code),
            keys: Object.keys(data),
            dataPreview: JSON.stringify(data).substring(0, 500),
          })
          
          // Coletar tanto QR Code quanto Pairing Code (podem vir juntos)
          let qrcode: string | undefined
          let pairingCode: string | undefined
          
          // Extrair QR Code (pode vir em formatos diferentes)
          if (data.qrcode?.base64 || data.qrcode?.code || data.base64) {
            const qrcodeBase64 = data.qrcode?.base64 || data.qrcode?.code || data.base64
            qrcode = qrcodeBase64.startsWith('data:') 
              ? qrcodeBase64 
              : `data:image/png;base64,${qrcodeBase64}`
            console.log(`[WhatsApp Manager] QR Code encontrado!`)
          }

          // Extrair Pairing Code
          if (data.pairingCode || data.code) {
            const code = data.pairingCode || data.code
            const codeStr = code.toString()
            // Formatar código: XXXX-XXXX (4 caracteres, hífen, 4 caracteres)
            // Funciona tanto para números quanto para alfanuméricos
            if (codeStr.length === 8) {
              pairingCode = `${codeStr.substring(0, 4)}-${codeStr.substring(4)}`
            } else {
              // Se não tiver 8 caracteres, usar como está
              pairingCode = codeStr
            }
            console.log(`[WhatsApp Manager] Pairing Code encontrado: ${pairingCode}`)
          }
          
          // Retornar ambos se disponíveis, ou o que tiver
          if (qrcode || pairingCode) {
            return { qrcode, pairingCode }
          }

          // Tentar extrair de response (retornar ambos se disponíveis)
          if (data.response?.qrcode || data.response?.pairingCode) {
            let qrcode: string | undefined
            let pairingCode: string | undefined
            
            if (data.response.qrcode) {
              qrcode = data.response.qrcode.startsWith('data:') 
                ? data.response.qrcode 
                : `data:image/png;base64,${data.response.qrcode}`
              console.log(`[WhatsApp Manager] QR Code encontrado em data.response!`)
            }
            
            if (data.response.pairingCode) {
              const codeStr = data.response.pairingCode.toString()
              // Formatar código: XXXX-XXXX (funciona para números e alfanuméricos)
              if (codeStr.length === 8) {
                pairingCode = `${codeStr.substring(0, 4)}-${codeStr.substring(4)}`
              } else {
                pairingCode = codeStr
              }
              console.log(`[WhatsApp Manager] Pairing Code encontrado em data.response: ${pairingCode}`)
            }
            
            if (qrcode || pairingCode) {
              return { qrcode, pairingCode }
            }
          }

          // Tentar outros formatos possíveis
          if (data.data?.qrcode || data.data?.base64) {
            const qrcodeBase64 = data.data.qrcode || data.data.base64
            console.log(`[WhatsApp Manager] QR Code encontrado em data.data!`)
            return {
              qrcode: qrcodeBase64.startsWith('data:') 
                ? qrcodeBase64 
                : `data:image/png;base64,${qrcodeBase64}`,
            }
          }

          // Formato do fetchInstances: data.qrcode.code ou data.qrcode.base64
          if (data.qrcode) {
            if (typeof data.qrcode === 'string') {
              // QR Code direto como string
              console.log(`[WhatsApp Manager] QR Code encontrado como string!`)
              return {
                qrcode: data.qrcode.startsWith('data:') 
                  ? data.qrcode 
                  : `data:image/png;base64,${data.qrcode}`,
              }
            } else if (data.qrcode.code) {
              // QR Code em formato objeto com .code
              console.log(`[WhatsApp Manager] QR Code encontrado em data.qrcode.code!`)
              const qrcodeValue = data.qrcode.code
              return {
                qrcode: qrcodeValue.startsWith('data:') 
                  ? qrcodeValue 
                  : `data:image/png;base64,${qrcodeValue}`,
              }
            } else if (data.qrcode.base64) {
              // QR Code em formato objeto com .base64
              console.log(`[WhatsApp Manager] QR Code encontrado em data.qrcode.base64!`)
              return {
                qrcode: `data:image/png;base64,${data.qrcode.base64}`,
              }
            }
          }

          // Formato do fetchInstances: data.pairingCode.code
          if (data.pairingCode) {
            if (typeof data.pairingCode === 'string') {
              const codeStr = data.pairingCode.toString()
              // Formatar código: XXXX-XXXX (funciona para números e alfanuméricos)
              const formatted = codeStr.length === 8 
                ? `${codeStr.substring(0, 4)}-${codeStr.substring(4)}`
                : codeStr
              console.log(`[WhatsApp Manager] Pairing Code encontrado como string: ${formatted}`)
              return { pairingCode: formatted }
            } else if (data.pairingCode.code) {
              const codeStr = data.pairingCode.code.toString()
              // Formatar código: XXXX-XXXX (funciona para números e alfanuméricos)
              const formatted = codeStr.length === 8 
                ? `${codeStr.substring(0, 4)}-${codeStr.substring(4)}`
                : codeStr
              console.log(`[WhatsApp Manager] Pairing Code encontrado em data.pairingCode.code: ${formatted}`)
              return { pairingCode: formatted }
            }
          }
        } else {
          // Log da resposta de erro para debug
          try {
            const errorText = await response.text()
            console.warn(`[WhatsApp Manager] Erro ao obter código de ${endpoint}:`, {
              status: response.status,
              statusText: response.statusText,
              error: errorText.substring(0, 500),
            })
          } catch (parseError) {
            console.warn(`[WhatsApp Manager] Erro ao parsear resposta de ${endpoint}:`, parseError)
          }
          // Continuar tentando outros endpoints mesmo se este falhar
          continue
        }
      } catch (error: any) {
        // Se for erro de JSON parse, já foi tratado acima
        if (error.message?.includes('Unexpected token')) {
          console.warn(`[WhatsApp Manager] Resposta não é JSON válido de ${endpoint}, tentando próximo endpoint...`)
          continue
        }
        console.warn(`[WhatsApp Manager] Erro ao obter código de ${endpoint}:`, error)
        continue
      }
    }

    throw new Error('Não foi possível obter código de conexão')
  }

  /**
   * Conecta via Pairing Code
   * Fluxo correto conforme documentação:
   * 1. Criar instância com número e qrcode: true
   * 2. Consultar /api/instances/connect/{instanceName} para obter pairingCode
   * @returns Objeto com connectionCode e instanceToken
   */
  async connectWithPairingCode(instanceName: string, phoneNumber: string): Promise<ConnectionCodeResponse & { instanceToken?: string }> {
    // Criar instância com número e qrcode: true (obrigatório para obter pairingCode)
    // Segundo a documentação: deve enviar number e qrcode: true
    const createResult = await this.createInstance({
      instanceName,
      qrcode: true, // OBRIGATÓRIO: mesmo com número, deve ser true para obter pairingCode
      number: phoneNumber,
    })

    if (!createResult.success) {
      throw new Error(createResult.error || 'Não foi possível criar instância')
    }

    // Aguardar alguns segundos para a instância estar pronta
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Consultar /api/instances/connect/{instanceName} para obter pairingCode (e/ou QR Code)
    // A API retorna ambos quando qrcode: true e number está presente
    const connectionCode = await this.getConnectionCode(instanceName)
    
    // Retornar também o token da instância para salvar no banco
    return {
      ...connectionCode,
      instanceToken: createResult.instanceToken,
    }
  }

  /**
   * Verifica status da conexão usando o token específico da instância
   * @param instanceName Nome da instância
   * @param instanceToken Token específico da instância (API Key) - obrigatório
   */
  async getConnectionState(instanceName: string, instanceToken?: string): Promise<InstanceStatusResponse> {
    // Endpoint correto: /instance/connectionState/{nome}
    // Base URL: usar api.reffix.com.br (sem /api)
    const baseUrl = this.config.managerUrl.replace(/\/api\/?$/, '').replace(/manager\./, 'api.')
    
    // Endpoint correto baseado na documentação
    const endpoint = `${baseUrl}/instance/connectionState/${instanceName}`
    
    try {
      // Usar token da instância se fornecido (prioridade)
      const headers: any = {
        'Accept': 'application/json',
      }
      
      if (instanceToken) {
        // Header correto: "apikey" (sem espaço - headers HTTP não podem ter espaços)
        headers['apikey'] = instanceToken
        console.log(`[WhatsApp Manager] Usando token da instância para verificar status: ${instanceToken.substring(0, 20)}...`)
      } else {
        // Fallback: usar autenticação global
        const token = await this.authenticate()
        if (token) {
          const isJWT = token.includes('.') && token.split('.').length === 3
          if (isJWT) {
            headers['Authorization'] = `Bearer ${token}`
          } else {
            headers['apikey'] = token
          }
          console.log('[WhatsApp Manager] Usando token global para verificar status (fallback)')
        } else {
          throw new Error('Token da instância não fornecido e autenticação global falhou')
        }
      }
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
      })

      if (response.ok) {
        const data = await response.json() as any
        console.log(`[WhatsApp Manager] Resposta do status:`, {
          keys: Object.keys(data),
          status: data.status || data.state || data.connectionState,
        })
        
        // Diferentes formatos de resposta
        const instance = data.instance || data.data?.instance || data
        const status = instance?.status || instance?.state || instance?.connectionState || data.status || data.state || data.connectionState || 'close'
        
        // Normalizar status
        let normalizedStatus: InstanceStatusResponse['status'] = 'close'
        if (status === 'open' || status === 'connected' || status === 'CONNECTED') {
          normalizedStatus = 'connected'
        } else if (status === 'close' || status === 'disconnected' || status === 'DISCONNECTED') {
          normalizedStatus = 'disconnected'
        } else if (status === 'connecting' || status === 'CONNECTING') {
          normalizedStatus = 'connecting'
        } else if (status === 'created' || status === 'CREATED') {
          normalizedStatus = 'created'
        }

        return {
          status: normalizedStatus,
          instanceName,
        }
      } else {
        const errorText = await response.text().catch(() => '')
        console.warn(`[WhatsApp Manager] Erro ao verificar status (HTTP ${response.status}):`, errorText)
        throw new Error(`Erro ao verificar status: HTTP ${response.status}`)
      }
    } catch (error) {
      console.error(`[WhatsApp Manager] Erro ao verificar status em ${endpoint}:`, error)
      throw error
    }
  }

  /**
   * Deleta uma instância
   * @param instanceName Nome da instância
   * @param instanceToken Token específico da instância (API Key) - opcional, mas recomendado para api.reffix.com.br
   */
  async deleteInstance(instanceName: string, instanceToken?: string): Promise<boolean> {
    // Endpoint correto: api.reffix.com.br/instance/delete/{instanceName}
    // Base URL: usar api.reffix.com.br (sem /api)
    const baseUrl = this.config.managerUrl.replace(/\/api\/?$/, '').replace(/manager\./, 'api.')
    
    const deleteEndpoints = [
      { url: `${baseUrl}/instance/delete/${instanceName}`, useInstanceToken: true }, // Endpoint correto - PRIORIDADE (requer instanceToken)
      { url: `${this.config.managerUrl}/instance/delete/${instanceName}`, useInstanceToken: false }, // Fallback
      { url: `${this.config.managerUrl}/instances/delete/${instanceName}`, useInstanceToken: false }, // Fallback alternativo
    ]

    let lastError: any = null
    let lastStatus: number | null = null

    for (const { url: endpoint, useInstanceToken } of deleteEndpoints) {
      try {
        console.log(`[WhatsApp Manager] Deletando instância em: ${endpoint}`)
        
        // Se usar instanceToken e estiver disponível, usar no header apikey
        let response: Response
        if (useInstanceToken && instanceToken) {
          const headers: any = {
            'Accept': 'application/json',
            'apikey': instanceToken,
          }
          console.log(`[WhatsApp Manager] Usando token da instância para deletar: ${instanceToken.substring(0, 20)}...`)
          response = await fetch(endpoint, {
            method: 'DELETE',
            headers,
          })
        } else {
          // Usar autenticação global (Bearer token ou API key global)
          response = await this.authenticatedRequest(endpoint, {
            method: 'DELETE',
          })
        }

        lastStatus = response.status
        console.log(`[WhatsApp Manager] Resposta do delete:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
        })

        // 200/204 = sucesso, 404 = já deletado (aceitável)
        if (response.ok) {
          console.log(`[WhatsApp Manager] ✅ Instância deletada com sucesso na Evolution API: ${instanceName}`)
          return true
        } else if (response.status === 404) {
          // 404 pode significar que já foi deletada ou não existe
          // Tentar ler resposta para entender melhor
          try {
            const errorText = await response.text()
            console.log(`[WhatsApp Manager] ⚠️  Status 404 ao deletar: ${errorText.substring(0, 200)}`)
            // Se todos os endpoints falharem, considerar como sucesso se foi 404
            // (instância pode já não existir mais)
          } catch (textError) {
            // Ignorar erro ao ler texto
          }
        } else {
          // Outros erros (400, 401, 403, 500, etc.) - tentar próximo endpoint
          try {
            const errorText = await response.text()
            console.warn(`[WhatsApp Manager] ❌ Erro ao deletar (HTTP ${response.status}):`, errorText.substring(0, 200))
          } catch (textError) {
            console.warn(`[WhatsApp Manager] ❌ Erro ao deletar (HTTP ${response.status})`)
          }
        }
      } catch (error) {
        lastError = error
        console.warn(`[WhatsApp Manager] ❌ Erro ao deletar instância em ${endpoint}:`, error)
        continue
      }
    }

    // Se todos os endpoints retornaram 404, considerar como sucesso
    // (instância pode já não existir mais na Evolution API)
    if (lastStatus === 404) {
      console.log(`[WhatsApp Manager] ⚠️  Instância não encontrada na Evolution API (404) - considerando como deletada: ${instanceName}`)
      return true
    }

    // Se chegou aqui, nenhum endpoint funcionou
    console.error(`[WhatsApp Manager] ❌ Não foi possível deletar instância em nenhum endpoint: ${instanceName}`, {
      lastStatus,
      lastError,
    })
    return false
  }

  /**
   * Envia mensagem de texto via WhatsApp
   * @param instanceName Nome da instância
   * @param instanceToken Token específico da instância (obrigatório)
   * @param phoneNumber Número do destinatário (com DDI, ex: 5524999999999)
   * @param message Texto da mensagem
   * @param options Opções adicionais (delay, quoted, etc)
   */
  async sendTextMessage(
    instanceName: string,
    instanceToken: string,
    phoneNumber: string,
    message: string,
    options?: {
      delay?: number
      quoted?: any
      linkPreview?: boolean
      mentionsEveryOne?: boolean
      mentioned?: string[]
    }
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    // Endpoint correto: api.reffix.com.br/message/sendText/{instanceName}
    // Base URL: usar api.reffix.com.br (sem /api)
    const baseUrl = this.config.managerUrl.replace(/\/api\/?$/, '').replace(/manager\./, 'api.')
    const endpoint = `${baseUrl}/message/sendText/${instanceName}`

    try {
      // Formatar número: remover caracteres não numéricos e garantir que tenha DDI
      // O número deve ter formato: 55 + DDD (2 dígitos) + número (8 ou 9 dígitos)
      // Exemplo: 5524999999999 (55 + 24 + 999999999)
      let cleanedNumber = phoneNumber.replace(/\D/g, '')
      
      // Se o número não começar com 55, adicionar
      if (!cleanedNumber.startsWith('55')) {
        cleanedNumber = `55${cleanedNumber}`
      }
      
      // Remover zeros à esquerda que podem ter sido adicionados (exceto o 55)
      // Exemplo: 55024999999999 -> 5524999999999
      if (cleanedNumber.length > 13 && cleanedNumber.startsWith('550')) {
        cleanedNumber = cleanedNumber.replace(/^550/, '55')
      }
      
      const formattedNumber = cleanedNumber
      
      console.log(`[WhatsApp Manager] Formatação do número:`, {
        original: phoneNumber,
        cleaned: cleanedNumber,
        formatted: formattedNumber,
        length: formattedNumber.length,
      })

      const body: any = {
        number: formattedNumber,
        text: message,
      }

      // Adicionar opções se fornecidas
      if (options?.delay !== undefined) {
        body.delay = options.delay
      }
      if (options?.quoted) {
        body.quoted = options.quoted
      }
      if (options?.linkPreview !== undefined) {
        body.linkPreview = options.linkPreview
      }
      if (options?.mentionsEveryOne !== undefined) {
        body.mentionsEveryOne = options.mentionsEveryOne
      }
      if (options?.mentioned) {
        body.mentioned = options.mentioned
      }

      console.log(`[WhatsApp Manager] Enviando mensagem via: ${endpoint}`, {
        number: formattedNumber,
        messageLength: message.length,
        hasOptions: !!options,
      })

      // Usar token da instância no header apikey (obrigatório para api.reffix.com.br)
      const headers: any = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'apikey': instanceToken,
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      console.log(`[WhatsApp Manager] Resposta do envio:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      })

      if (response.ok) {
        try {
          const data = await response.json() as any
          console.log(`[WhatsApp Manager] ✅ Mensagem enviada com sucesso`)
          return {
            success: true,
            messageId: data.messageId || data.id || data.key?.id,
          }
        } catch (parseError) {
          // Se não conseguir parsear JSON, considerar sucesso se status for 200
          console.log(`[WhatsApp Manager] ✅ Mensagem enviada (resposta não é JSON)`)
          return { success: true }
        }
      } else {
        const errorText = await response.text().catch(() => '')
        console.warn(`[WhatsApp Manager] ❌ Erro ao enviar mensagem (HTTP ${response.status}):`, errorText.substring(0, 200))
        return {
          success: false,
          error: `Erro ao enviar mensagem: HTTP ${response.status} - ${errorText.substring(0, 100)}`,
        }
      }
    } catch (error) {
      console.error(`[WhatsApp Manager] ❌ Erro ao enviar mensagem:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao enviar mensagem',
      }
    }
  }

  /**
   * Envia mensagem com imagem via Evolution API
   * @param instanceName Nome da instância
   * @param instanceToken Token específico da instância (API Key)
   * @param phoneNumber Número do destinatário (com ou sem DDI)
   * @param imageUrl URL da imagem a ser enviada
   * @param caption Texto legenda (opcional)
   */
  async sendImageMessage(
    instanceName: string,
    instanceToken: string,
    phoneNumber: string,
    imageUrl: string,
    caption?: string
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    // Tentar múltiplos endpoints possíveis
    const baseUrl = this.config.managerUrl.replace(/\/api\/?$/, '').replace(/manager\./, 'api.')
    const endpoints = [
      `${baseUrl}/message/sendMedia/${instanceName}`,
      `${baseUrl}/message/sendImage/${instanceName}`,
    ]

    try {
      // Formatar número: remover caracteres não numéricos e garantir que tenha DDI
      let cleanedNumber = phoneNumber.replace(/\D/g, '')
      
      if (!cleanedNumber.startsWith('55')) {
        cleanedNumber = `55${cleanedNumber}`
      }
      
      if (cleanedNumber.length > 13 && cleanedNumber.startsWith('550')) {
        cleanedNumber = cleanedNumber.replace(/^550/, '55')
      }
      
      const formattedNumber = cleanedNumber
      
      // Tentar cada endpoint até um funcionar
      for (const endpoint of endpoints) {
        try {
          console.log(`[WhatsApp Manager] Tentando enviar imagem via: ${endpoint}`, {
            number: formattedNumber,
            imageUrl,
            hasCaption: !!caption,
          })

          // Tentar formato 1: mediatype + media
          let body: any = {
            number: formattedNumber,
            mediatype: 'image',
            media: imageUrl,
          }

          if (caption) {
            body.caption = caption
          }

          const headers: any = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'apikey': instanceToken,
          }

          let response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          })

          // Se falhar, tentar formato alternativo
          if (!response.ok && endpoint.includes('sendMedia')) {
            console.log(`[WhatsApp Manager] Tentando formato alternativo para sendMedia...`)
            body = {
              number: formattedNumber,
              url: imageUrl,
              caption: caption || '',
            }
            
            response = await fetch(endpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify(body),
            })
          }

          console.log(`[WhatsApp Manager] Resposta do envio de imagem (${endpoint}):`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
          })

          if (response.ok) {
            const data = await response.json().catch(() => ({})) as any
            console.log(`[WhatsApp Manager] ✅ Imagem enviada com sucesso via ${endpoint}`)
            return {
              success: true,
              messageId: data.key?.id || data.messageId || data.id || undefined,
            }
          } else {
            // Se não for o último endpoint, continuar tentando
            if (endpoint !== endpoints[endpoints.length - 1]) {
              const errorText = await response.text().catch(() => '')
              console.warn(`[WhatsApp Manager] Endpoint ${endpoint} falhou (${response.status}), tentando próximo...`)
              continue
            }
            
            // Se for o último endpoint, retornar erro
            const errorText = await response.text().catch(() => 'Erro desconhecido')
            let errorMessage = `Erro ao enviar imagem: ${response.status} ${response.statusText}`
            
            try {
              const errorData = JSON.parse(errorText)
              errorMessage = errorData.error || errorData.message || errorMessage
            } catch {
              if (errorText) {
                errorMessage = errorText.substring(0, 200)
              }
            }
            
            console.error(`[WhatsApp Manager] ❌ Erro ao enviar imagem:`, errorMessage)
            return { success: false, error: errorMessage }
          }
        } catch (endpointError: any) {
          // Se não for o último endpoint, continuar tentando
          if (endpoint !== endpoints[endpoints.length - 1]) {
            console.warn(`[WhatsApp Manager] Erro ao tentar ${endpoint}, tentando próximo:`, endpointError.message)
            continue
          }
          throw endpointError
        }
      }

      // Se chegou aqui, nenhum endpoint funcionou
      return { success: false, error: 'Nenhum endpoint de envio de imagem funcionou' }
    } catch (error: any) {
      const errorMessage = error.message || 'Erro desconhecido ao enviar imagem'
      console.error(`[WhatsApp Manager] ❌ Exceção ao enviar imagem:`, errorMessage)
      return { success: false, error: errorMessage }
    }
  }
}

// Instância singleton
let instance: WhatsAppInstanceManager | null = null

export function getWhatsAppInstanceManager(): WhatsAppInstanceManager {
  if (!instance) {
    const managerUrl = process.env.EVOLUTION_API_URL || ''
    const managerEmail = process.env.MANAGER_EMAIL
    const managerPassword = process.env.MANAGER_PASSWORD
    const apiKey = process.env.EVOLUTION_API_KEY
    const globalApiKey = process.env.EVOLUTION_API_GLOBAL_KEY

    if (!managerUrl) {
      throw new Error('EVOLUTION_API_URL não configurada')
    }

    instance = new WhatsAppInstanceManager({
      managerUrl,
      managerEmail,
      managerPassword,
      apiKey,
      globalApiKey,
    })

    instance.logConfiguration()
  }

  return instance
}

