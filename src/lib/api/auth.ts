import { getApiUrl } from './config'
import { getCurrentUser } from '@/lib/auth/auth'

/**
 * Verifica se o token JWT existe e é válido
 */
export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token')
}

/**
 * Salva o token JWT no localStorage
 */
export function setAuthToken(token: string): void {
  localStorage.setItem('auth_token', token)
}

/**
 * Remove o token JWT do localStorage
 */
export function removeAuthToken(): void {
  localStorage.removeItem('auth_token')
}

/**
 * Verifica se o token existe e tenta renová-lo se necessário
 * Retorna o token válido ou null se não conseguir obter
 */
export async function ensureAuthToken(): Promise<string | null> {
  let token = getAuthToken()

  // Se o token existe, verifica se é válido tentando usar o endpoint /me
  if (token) {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        // Token é válido
        console.log('[Auth] Token válido encontrado')
        return token
      }

      // Token inválido ou expirado
      if (response.status === 401) {
        console.log('[Auth] Token inválido ou expirado (401)')
        // Remove token inválido
        removeAuthToken()
      }
    } catch (error) {
      console.warn('[Auth] Erro ao verificar token:', error)
      // Em caso de erro de rede, mantém o token (pode ser problema temporário)
      // Mas se for erro de autenticação, remove o token
      if (error instanceof Error && error.message.includes('401')) {
        removeAuthToken()
      }
    }
  }

  // Tenta obter novo token fazendo login silencioso
  // Como não temos senha armazenada, retorna null
  // O componente deve lidar com isso redirecionando para login
  return await refreshToken()
}

/**
 * Tenta obter um novo token fazendo login silencioso
 * Usa as credenciais do usuário atual armazenadas localmente
 */
async function refreshToken(): Promise<string | null> {
  const currentUser = getCurrentUser()
  
  if (!currentUser) {
    console.warn('[Auth] Nenhum usuário encontrado para renovar token')
    return null
  }

  // Não temos a senha armazenada, então não podemos fazer login automático
  // Retornamos null e o componente deve pedir para o usuário fazer login novamente
  console.warn('[Auth] Não é possível renovar token automaticamente sem senha')
  return null
}

/**
 * Helper para construir headers de forma type-safe
 */
function buildHeaders(existingHeaders?: HeadersInit, token?: string): HeadersInit {
  const headers: Record<string, string> = {}
  
  // Copia headers existentes
  if (existingHeaders) {
    if (existingHeaders instanceof Headers) {
      existingHeaders.forEach((value, key) => {
        headers[key] = value
      })
    } else if (Array.isArray(existingHeaders)) {
      existingHeaders.forEach(([key, value]) => {
        headers[key] = value
      })
    } else {
      Object.assign(headers, existingHeaders)
    }
  }
  
  // Adiciona Authorization se tiver token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  // Adiciona Content-Type se não existir
  if (!headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json'
  }
  
  return headers
}

/**
 * Faz uma requisição autenticada com retry automático em caso de erro 401
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Garante que temos um token válido
  let token = await ensureAuthToken()
  
  if (!token) {
    throw new Error('AUTH_REQUIRED')
  }

  // Faz a requisição com o token
  let response = await fetch(url, {
    ...options,
    headers: buildHeaders(options.headers, token),
  })

  // Se receber 401, tenta renovar token e repetir a requisição uma vez
  if (response.status === 401) {
    console.log('[Auth] Recebido 401, tentando renovar token...')
    
    // Remove token inválido
    removeAuthToken()
    
    // Tenta obter novo token
    const newToken = await ensureAuthToken()
    
    if (newToken) {
      // Repete a requisição com o novo token
      response = await fetch(url, {
        ...options,
        headers: buildHeaders(options.headers, newToken),
      })
      
      // Se ainda receber 401, lança erro
      if (response.status === 401) {
        throw new Error('AUTH_REQUIRED')
      }
    } else {
      // Não conseguiu renovar, lança erro
      throw new Error('AUTH_REQUIRED')
    }
  }

  return response
}

