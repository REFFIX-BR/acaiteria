/**
 * Gera URL pública do cardápio
 */
export function getMenuPublicUrl(tenantSlug: string, source?: 'counter' | 'digital'): string {
  // Usa window.location.origin que funciona tanto em dev quanto em produção
  // No cliente, window.location.origin será sempre a origem correta
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const baseUrlPath = `${baseUrl}/menu/${tenantSlug}`
  
  if (source === 'counter') {
    return `${baseUrlPath}?source=counter`
  }
  
  return baseUrlPath
}

/**
 * Copia URL para clipboard
 */
export async function copyMenuUrl(tenantSlug: string, source?: 'counter' | 'digital'): Promise<boolean> {
  try {
    const url = getMenuPublicUrl(tenantSlug, source)
    await navigator.clipboard.writeText(url)
    return true
  } catch (error) {
    console.error('Erro ao copiar URL:', error)
    return false
  }
}

/**
 * Obtém o source do pedido baseado na URL atual
 */
export function getOrderSourceFromUrl(): 'counter' | 'digital' {
  const urlParams = new URLSearchParams(window.location.search)
  const source = urlParams.get('source')
  return source === 'counter' ? 'counter' : 'digital'
}

