import type { Tenant, Subscription, PlanType } from '@/types'

const TRIAL_DAYS = 7

/**
 * Calcula a data de término do trial (7 dias após a criação)
 */
export function calculateTrialEndDate(startDate: Date): Date {
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + TRIAL_DAYS)
  return endDate
}

/**
 * Cria uma subscription inicial com trial de 7 dias
 */
export function createInitialSubscription(createdAt: Date): Subscription {
  return {
    planType: 'trial',
    trialStartDate: createdAt,
    trialEndDate: calculateTrialEndDate(createdAt),
    isActive: true,
    isTrial: true,
  }
}

/**
 * Verifica se o trial ainda está ativo
 */
export function isTrialActive(subscription?: Subscription): boolean {
  if (!subscription || !subscription.isTrial) return false
  return new Date() < new Date(subscription.trialEndDate)
}

/**
 * Verifica se a subscription está ativa (trial ou paga)
 */
export function isSubscriptionActive(tenant: Tenant): boolean {
  if (!tenant.subscription) return false
  
  const { subscription } = tenant
  
  // Se está em trial, verifica se ainda está dentro do período
  if (subscription.isTrial) {
    return isTrialActive(subscription)
  }
  
  // Se tem subscription paga, verifica se ainda está válida
  if (subscription.subscriptionEndDate) {
    return new Date() < new Date(subscription.subscriptionEndDate)
  }
  
  return subscription.isActive
}

/**
 * Retorna os dias restantes do trial
 */
export function getTrialDaysRemaining(subscription?: Subscription): number {
  if (!subscription || !subscription.isTrial) return 0
  
  const now = new Date()
  const endDate = new Date(subscription.trialEndDate)
  
  if (now >= endDate) return 0
  
  const diffTime = endDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays
}

/**
 * Atualiza o plano do tenant
 */
export function upgradeSubscription(
  tenant: Tenant,
  planType: PlanType
): Tenant {
  const now = new Date()
  const subscriptionEndDate = new Date()
  
  // Define data de término baseado no plano (30 dias para todos os planos pagos)
  subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30)
  
  return {
    ...tenant,
    subscription: {
      planType,
      trialStartDate: tenant.subscription?.trialStartDate || tenant.createdAt,
      trialEndDate: tenant.subscription?.trialEndDate || calculateTrialEndDate(tenant.createdAt),
      subscriptionStartDate: now,
      subscriptionEndDate,
      isActive: true,
      isTrial: false,
    },
  }
}

/**
 * Retorna informações do plano atual
 */
export function getPlanInfo(tenant: Tenant) {
  const subscription = tenant.subscription
  const isActive = isSubscriptionActive(tenant)
  const isTrial = subscription?.isTrial ?? false
  const daysRemaining = isTrial ? getTrialDaysRemaining(subscription) : null
  
  return {
    isActive,
    isTrial,
    planType: subscription?.planType || 'trial',
    daysRemaining,
    isExpired: !isActive,
  }
}

