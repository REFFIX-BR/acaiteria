/**
 * Configuração da URL da API
 * Detecta automaticamente baseado no domínio atual (sem depender de variáveis de ambiente)
 */
export function getApiUrl(): string {
  const currentOrigin = window.location.origin
  const hostname = window.location.hostname
  const protocol = window.location.protocol

  // Se já estiver no subdomínio backgestao, usar a origem atual
  if (hostname === 'backgestao.reffix.com.br') {
    console.log('[API Config] Já está no subdomínio backgestao:', currentOrigin)
    return currentOrigin
  }

  // Modo desenvolvimento (localhost)
  if (hostname.includes('localhost') || hostname === '127.0.0.1') {
    const devUrl = 'http://localhost:3000'
    console.log('[API Config] Modo desenvolvimento:', devUrl)
    return devUrl
  }

  // Se estiver acessando por IP, usar o mesmo IP na porta 3000
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipRegex.test(hostname)) {
    const ipUrl = `${protocol}//${hostname}:3000`
    console.log('[API Config] Acesso por IP:', ipUrl)
    return ipUrl
  }

  // Para domínios *.reffix.com.br, usar backgestao.reffix.com.br
  // Exemplo: gestaoloja.reffix.com.br -> backgestao.reffix.com.br
  let apiHostname: string
  if (hostname === 'reffix.com.br' || hostname.endsWith('.reffix.com.br')) {
    // Para qualquer domínio *.reffix.com.br, usar backgestao.reffix.com.br
    apiHostname = 'backgestao.reffix.com.br'
  } else {
    // Para outros domínios, usar localhost em desenvolvimento
    apiHostname = 'localhost:3000'
    const apiUrl = `http://${apiHostname}`
    console.log('[API Config] URL construída (fallback):', {
      hostname,
      apiHostname,
      apiUrl,
      currentOrigin
    })
    return apiUrl
  }
  
  const apiUrl = `${protocol}//${apiHostname}`
  console.log('[API Config] URL construída:', {
    hostname,
    apiHostname,
    apiUrl,
    currentOrigin
  })
  return apiUrl
}

/**
 * URL base da API
 */
export const API_BASE_URL = getApiUrl()

