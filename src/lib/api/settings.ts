import { getApiUrl } from './config'
import { getAuthToken } from './auth'

export async function getFinancialSummaryPasswordStatus(): Promise<{ hasPassword: boolean }> {
  const apiUrl = getApiUrl()
  const token = getAuthToken()
  if (!token) return { hasPassword: false }
  const res = await fetch(`${apiUrl}/api/settings/financial-summary-password-status`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return { hasPassword: false }
  const data = await res.json()
  return { hasPassword: !!data.hasPassword }
}

export async function setFinancialSummaryPassword(
  newPassword: string,
  confirmPassword: string
): Promise<{ success: boolean; error?: string }> {
  const apiUrl = getApiUrl()
  const token = getAuthToken()
  if (!token) return { success: false, error: 'Não autorizado' }
  const res = await fetch(`${apiUrl}/api/settings/financial-summary-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: 'set',
      newPassword,
      confirmPassword,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, error: data.error || 'Erro ao definir senha' }
  return { success: true }
}

export async function verifyFinancialSummaryPassword(
  password: string
): Promise<{ valid: boolean; error?: string }> {
  const apiUrl = getApiUrl()
  const token = getAuthToken()
  if (!token) return { valid: false, error: 'Não autorizado' }
  const res = await fetch(`${apiUrl}/api/settings/financial-summary-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: 'verify', password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { valid: false, error: data.error || 'Erro ao verificar' }
  return { valid: !!data.valid }
}
