import { getApiUrl } from './config'
import { getAuthToken } from './auth'

export type UploadType = 'logo' | 'menu-item'

export interface UploadResult {
  url: string
  key: string
}

/**
 * Faz upload de uma imagem para o MinIO via API
 * @param file Arquivo de imagem a ser enviado
 * @param tenantId ID do tenant (opcional, usado para rota autenticada)
 * @param tenantSlug Slug do tenant (opcional, usado para rota pública)
 * @param type Tipo de upload: 'logo' ou 'menu-item'
 * @returns URL pública da imagem no MinIO
 */
export async function uploadImage(
  file: File,
  type: UploadType,
  options?: {
    tenantId?: string
    tenantSlug?: string
  }
): Promise<string> {
  const apiUrl = getApiUrl()
  const token = getAuthToken()

  // Validação do arquivo
  if (!file.type.startsWith('image/')) {
    throw new Error('O arquivo deve ser uma imagem')
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('A imagem deve ter no máximo 5MB')
  }

  // Preparar FormData
  const formData = new FormData()
  formData.append('image', file)
  formData.append('type', type)

  // Escolher rota baseado na disponibilidade de autenticação
  let uploadUrl: string
  const headers: HeadersInit = {}

  if (token && options?.tenantId) {
    // Rota autenticada
    uploadUrl = `${apiUrl}/api/upload`
    headers['Authorization'] = `Bearer ${token}`
  } else if (options?.tenantSlug) {
    // Rota pública
    uploadUrl = `${apiUrl}/api/upload/public/${options.tenantSlug}`
  } else {
    throw new Error('É necessário fornecer tenantId ou tenantSlug')
  }

  // Fazer upload
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Erro ao fazer upload: ${response.status}`)
  }

  const result: UploadResult = await response.json()
  return result.url
}

