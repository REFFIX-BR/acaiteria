/**
 * Configuração da URL da API
 * Detecta automaticamente baseado no domínio atual (sem depender de variáveis de ambiente)
 */
export function getApiUrl(): string {
  const currentOrigin = window.location.origin
  const hostname = window.location.hostname
  const protocol = window.location.protocol

  // Se já estiver no subdomínio api, usar a origem atual
  if (hostname.startsWith('api.')) {
    return currentOrigin
  }

  // Modo desenvolvimento (localhost)
  if (hostname.includes('localhost') || hostname === '127.0.0.1') {
    return 'http://localhost:3000'
  }

  // Se estiver acessando por IP, usar o mesmo IP na porta 3000
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipRegex.test(hostname)) {
    return `${protocol}//${hostname}:3000`
  }

  // Construir subdomínio api automaticamente
  // Exemplo: gestaoloja.reffix.com.br -> api.gestaoloja.reffix.com.br
  // Exemplo: menu.reffix.com.br -> api.menu.reffix.com.br
  const apiHostname = hostname.replace(/^([^.]+\.)?/, 'api.')
  return `${protocol}//${apiHostname}`
}

/**
 * URL base da API
 */
export const API_BASE_URL = getApiUrl()

