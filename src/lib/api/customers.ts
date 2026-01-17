import { getApiUrl } from './config'
import { getAuthToken } from './auth'

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  createdAt: Date | string
}

/**
 * Busca todos os clientes do tenant autenticado
 */
export async function getCustomers(): Promise<Customer[]> {
  const apiUrl = getApiUrl()
  const token = getAuthToken()

  if (!token) {
    throw new Error('Token de autenticação não encontrado')
  }

  const response = await fetch(`${apiUrl}/api/customers`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar clientes' }))
    throw new Error(error.error || 'Erro ao buscar clientes')
  }

  const data = await response.json()
  return data.customers || []
}

/**
 * Cria um novo cliente
 */
export async function createCustomer(customer: {
  name: string
  phone: string
  email?: string
}): Promise<Customer> {
  const apiUrl = getApiUrl()
  const token = getAuthToken()

  if (!token) {
    throw new Error('Token de autenticação não encontrado')
  }

  const response = await fetch(`${apiUrl}/api/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(customer),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao criar cliente' }))
    throw new Error(error.error || 'Erro ao criar cliente')
  }

  const data = await response.json()
  return data.customer
}

/**
 * Atualiza um cliente existente
 */
export async function updateCustomer(
  id: string,
  customer: {
    name: string
    phone: string
    email?: string
  }
): Promise<Customer> {
  const apiUrl = getApiUrl()
  const token = getAuthToken()

  if (!token) {
    throw new Error('Token de autenticação não encontrado')
  }

  const response = await fetch(`${apiUrl}/api/customers/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(customer),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao atualizar cliente' }))
    throw new Error(error.error || 'Erro ao atualizar cliente')
  }

  const data = await response.json()
  return data.customer
}

/**
 * Deleta um cliente (soft delete)
 */
export async function deleteCustomer(id: string): Promise<void> {
  const apiUrl = getApiUrl()
  const token = getAuthToken()

  if (!token) {
    throw new Error('Token de autenticação não encontrado')
  }

  const response = await fetch(`${apiUrl}/api/customers/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao deletar cliente' }))
    throw new Error(error.error || 'Erro ao deletar cliente')
  }
}

