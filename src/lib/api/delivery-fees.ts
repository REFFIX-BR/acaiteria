import { getApiUrl } from './config'
import { authenticatedFetch } from './auth'

export interface DeliveryFee {
  id: string
  tenantId: string
  neighborhood: string
  fee: number
  createdAt: Date
  updatedAt: Date
}

export interface CreateDeliveryFeeData {
  neighborhood: string
  fee: number
}

export interface UpdateDeliveryFeeData {
  neighborhood?: string
  fee?: number
}

export interface DeliveryFeeByCEPResponse {
  success: boolean
  neighborhood: string | null
  city?: string
  state?: string
  address?: string
  fee: number
  message?: string
}

/**
 * Lista todas as taxas de entrega do tenant
 */
export async function getDeliveryFees(): Promise<DeliveryFee[]> {
  const apiUrl = getApiUrl()
  const response = await authenticatedFetch(`${apiUrl}/api/delivery-fees`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar taxas de entrega' }))
    throw new Error(error.error || 'Erro ao buscar taxas de entrega')
  }

  const data = await response.json()
  return (data.deliveryFees || []).map((fee: any) => ({
    ...fee,
    createdAt: new Date(fee.createdAt),
    updatedAt: new Date(fee.updatedAt),
  }))
}

/**
 * Cria uma nova taxa de entrega
 */
export async function createDeliveryFee(data: CreateDeliveryFeeData): Promise<DeliveryFee> {
  const apiUrl = getApiUrl()
  const response = await authenticatedFetch(`${apiUrl}/api/delivery-fees`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao criar taxa de entrega' }))
    throw new Error(error.error || 'Erro ao criar taxa de entrega')
  }

  const result = await response.json()
  return {
    ...result.deliveryFee,
    createdAt: new Date(result.deliveryFee.createdAt),
    updatedAt: new Date(result.deliveryFee.updatedAt),
  }
}

/**
 * Atualiza uma taxa de entrega
 */
export async function updateDeliveryFee(
  id: string,
  data: UpdateDeliveryFeeData
): Promise<DeliveryFee> {
  const apiUrl = getApiUrl()
  const response = await authenticatedFetch(`${apiUrl}/api/delivery-fees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao atualizar taxa de entrega' }))
    throw new Error(error.error || 'Erro ao atualizar taxa de entrega')
  }

  const result = await response.json()
  return {
    ...result.deliveryFee,
    createdAt: new Date(result.deliveryFee.createdAt),
    updatedAt: new Date(result.deliveryFee.updatedAt),
  }
}

/**
 * Deleta uma taxa de entrega
 */
export async function deleteDeliveryFee(id: string): Promise<void> {
  const apiUrl = getApiUrl()
  const response = await authenticatedFetch(`${apiUrl}/api/delivery-fees/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao deletar taxa de entrega' }))
    throw new Error(error.error || 'Erro ao deletar taxa de entrega')
  }
}

/**
 * Busca taxa de entrega por CEP (público - não requer autenticação)
 */
export async function getDeliveryFeeByCEP(
  cep: string,
  tenantId: string
): Promise<DeliveryFeeByCEPResponse> {
  const apiUrl = getApiUrl()
  const cleanCEP = cep.replace(/\D/g, '')
  
  const response = await fetch(`${apiUrl}/api/delivery-fees/by-cep/${cleanCEP}?tenantId=${tenantId}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar CEP' }))
    throw new Error(error.error || 'Erro ao buscar CEP')
  }

  return await response.json()
}

/**
 * Busca taxa de entrega por bairro (público - não requer autenticação)
 */
export async function getDeliveryFeeByNeighborhood(
  neighborhood: string,
  tenantId: string
): Promise<{ success: boolean; neighborhood: string; fee: number }> {
  const apiUrl = getApiUrl()
  const response = await fetch(
    `${apiUrl}/api/delivery-fees/by-neighborhood/${encodeURIComponent(neighborhood)}?tenantId=${tenantId}`
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar bairro' }))
    throw new Error(error.error || 'Erro ao buscar bairro')
  }

  return await response.json()
}

