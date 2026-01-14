/**
 * Configuração da URL da API
 * Detecta automaticamente a URL base ou usa variável de ambiente
 */
export function getApiUrl(): string {
  // Prioridade 1: Variável de ambiente (definida no build)
  const envUrl = import.meta.env.VITE_API_URL
  
  if (envUrl) {
    console.log('[API Config] Usando VITE_API_URL:', envUrl)
    return envUrl
  }

  // Prioridade 2: Detectar automaticamente baseado no domínio atual
  const currentOrigin = window.location.origin
  const hostname = window.location.hostname
  const protocol = window.location.protocol

  // Se já estiver no subdomínio api, usar a origem atual
  if (hostname.startsWith('api.')) {
    console.log('[API Config] Detectado subdomínio api, usando:', currentOrigin)
    return currentOrigin
  }

  // Tentar construir o subdomínio api
  // Exemplo: gestaoloja.reffix.com.br -> api.gestaoloja.reffix.com.br
  // Exemplo: localhost:5173 -> localhost:3000 (dev)
  if (hostname.includes('localhost')) {
    const devUrl = 'http://localhost:3000'
    console.log('[API Config] Modo desenvolvimento, usando:', devUrl)
    return devUrl
  }

  // Construir subdomínio api
  const apiHostname = hostname.replace(/^([^.]+\.)?/, 'api.')
  const apiUrl = `${protocol}//${apiHostname}`
  console.log('[API Config] Construído subdomínio api:', apiUrl)
  return apiUrl
}

/**
 * URL base da API
 */
export const API_BASE_URL = getApiUrl()

