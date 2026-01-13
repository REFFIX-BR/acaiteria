import type { Tenant } from '@/types'

/**
 * Camada de abstração para armazenamento isolado por tenant
 * Simula uma API com LocalStorage/IndexedDB
 */

const STORAGE_PREFIX = 'acaiteria:'

function getTenantKey(tenantId: string, key: string): string {
  return `${STORAGE_PREFIX}tenant:${tenantId}:${key}`
}

function getGlobalKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`
}

/**
 * Armazena dados de um tenant específico
 */
export function setTenantData<T>(tenantId: string, key: string, data: T): void {
  try {
    const storageKey = getTenantKey(tenantId, key)
    localStorage.setItem(storageKey, JSON.stringify(data))
  } catch (error) {
    console.error('Erro ao salvar dados:', error)
    throw error
  }
}

/**
 * Recupera dados de um tenant específico
 */
export function getTenantData<T>(tenantId: string, key: string): T | null {
  try {
    const storageKey = getTenantKey(tenantId, key)
    const item = localStorage.getItem(storageKey)
    return item ? JSON.parse(item) : null
  } catch (error) {
    console.error('Erro ao recuperar dados:', error)
    return null
  }
}

/**
 * Remove dados de um tenant específico
 */
export function removeTenantData(tenantId: string, key: string): void {
  try {
    const storageKey = getTenantKey(tenantId, key)
    localStorage.removeItem(storageKey)
  } catch (error) {
    console.error('Erro ao remover dados:', error)
  }
}

/**
 * Lista todas as chaves de um tenant
 */
export function listTenantKeys(tenantId: string): string[] {
  const keys: string[] = []
  const prefix = getTenantKey(tenantId, '')
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(prefix)) {
      const tenantKey = key.replace(prefix, '')
      keys.push(tenantKey)
    }
  }
  
  return keys
}

/**
 * Armazena dados globais (não relacionados a tenant)
 */
export function setGlobalData<T>(key: string, data: T): void {
  try {
    const storageKey = getGlobalKey(key)
    localStorage.setItem(storageKey, JSON.stringify(data))
  } catch (error) {
    console.error('Erro ao salvar dados globais:', error)
    throw error
  }
}

/**
 * Recupera dados globais
 */
export function getGlobalData<T>(key: string): T | null {
  try {
    const storageKey = getGlobalKey(key)
    const item = localStorage.getItem(storageKey)
    return item ? JSON.parse(item) : null
  } catch (error) {
    console.error('Erro ao recuperar dados globais:', error)
    return null
  }
}

/**
 * Gerencia tenants (lista, criar, etc)
 */
export function getAllTenants(): Tenant[] {
  const tenants = getGlobalData<Tenant[]>('tenants') || []
  return tenants
}

export function saveTenant(tenant: Tenant): void {
  const tenants = getAllTenants()
  const existingIndex = tenants.findIndex(t => t.id === tenant.id)
  
  if (existingIndex >= 0) {
    tenants[existingIndex] = tenant
  } else {
    tenants.push(tenant)
  }
  
  setGlobalData('tenants', tenants)
}

export function getTenantById(id: string): Tenant | null {
  const tenants = getAllTenants()
  return tenants.find(t => t.id === id) || null
}

export function getTenantBySlug(slug: string): Tenant | null {
  const tenants = getAllTenants()
  return tenants.find(t => t.slug === slug) || null
}

/**
 * Limpa todos os dados de um tenant (útil para testes/reset)
 */
export function clearTenantData(tenantId: string): void {
  const keys = listTenantKeys(tenantId)
  keys.forEach(key => removeTenantData(tenantId, key))
}

