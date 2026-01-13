import type { Tenant } from '@/types'

/**
 * Aplica tema do tenant ao documento
 */
export function applyTenantTheme(tenant: Tenant): void {
  const root = document.documentElement
  
  // Converte cores hex para HSL se necessário, ou usa diretamente
  // Para simplificar, vamos usar as cores hex diretamente via CSS variables
  root.style.setProperty('--tenant-primary', tenant.primaryColor)
  root.style.setProperty('--tenant-secondary', tenant.secondaryColor)
  
  // Aplica classe de tema customizado
  root.setAttribute('data-tenant-id', tenant.id)
  root.setAttribute('data-tenant-theme', 'custom')
}

/**
 * Remove tema do tenant (volta ao padrão)
 */
export function removeTenantTheme(): void {
  const root = document.documentElement
  root.removeAttribute('data-tenant-id')
  root.removeAttribute('data-tenant-theme')
  root.style.removeProperty('--tenant-primary')
  root.style.removeProperty('--tenant-secondary')
}

/**
 * Gera cores HSL a partir de hex
 */
export function hexToHsl(hex: string): string {
  // Remove # se existir
  hex = hex.replace('#', '')
  
  // Converte para RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

