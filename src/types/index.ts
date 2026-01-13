// Planos
export type PlanType = 'trial' | 'basic' | 'premium' | 'enterprise'

export interface Subscription {
  planType: PlanType
  trialStartDate: Date
  trialEndDate: Date
  subscriptionStartDate?: Date
  subscriptionEndDate?: Date
  isActive: boolean
  isTrial: boolean
}

// Tenant
export interface Tenant {
  id: string
  name: string
  slug: string
  logo?: string
  primaryColor: string
  secondaryColor: string
  createdAt: Date
  subscription?: Subscription
}

// Usuário
export interface User {
  id: string
  email: string
  password: string // Hash da senha (em produção, nunca armazenar senha em texto)
  name: string
  tenantId: string
  role: 'owner' | 'admin' | 'user'
  createdAt: Date
  lastLogin?: Date
}

// Configurações da Empresa
export interface CompanySettings {
  tradeName: string
  contactPhone: string
  cnpj: string
  adminEmail: string
}

// Horário de Funcionamento
export interface OperatingHours {
  day: string
  enabled: boolean
  startTime: string
  endTime: string
}

// Configurações do Sistema
export interface SystemSettings {
  company: CompanySettings
  operatingHours: OperatingHours[]
  timezone: string
}

// Produto/Ingrediente
export interface Product {
  id: string
  name: string
  category: string
  currentStock: number
  minStock: number
  unit: string
  price: number
  createdAt: Date
  updatedAt: Date
}

// Transação Financeira
export interface Transaction {
  id: string
  type: 'income' | 'expense'
  category: string
  amount: number
  description: string
  date: Date
  createdAt: Date
}

// Item do Cardápio
export interface SizeOption {
  id: string
  name: string
  price: number
}

export interface Addition {
  id: string
  name: string
  price: number
}

export interface Complement {
  id: string
  name: string
  price: number
}

export interface Fruit {
  id: string
  name: string
  price: number
}

export interface MenuItem {
  id: string
  name: string
  description: string
  basePrice: number
  image?: string
  sizes: SizeOption[]
  additions: Addition[]
  complements: Complement[]
  fruits: Fruit[]
  maxAdditions?: number // Limite de coberturas (undefined = sem limite)
  maxComplements?: number // Limite de complementos (undefined = sem limite)
  maxFruits?: number // Limite de frutas (undefined = sem limite)
  available: boolean
  category: string
  createdAt: Date
  updatedAt: Date
}

// Campanha
export interface CampaignMetrics {
  sent: number
  delivered: number
  failed: number
  clicks?: number
  conversions?: number
}

export interface Campaign {
  id: string
  name: string
  type: 'promotion' | 'whatsapp'
  status: 'active' | 'paused' | 'completed'
  startDate: Date
  endDate?: Date
  metrics: CampaignMetrics
  description?: string
  discount?: number
  createdAt: Date
}

// Cliente/Lead
export interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  createdAt: Date
}

// Configuração WhatsApp
export interface WhatsAppConfig {
  apiUrl: string
  apiKey: string
  instanceName?: string
  connected: boolean
}

// Instância WhatsApp
export interface WhatsAppInstance {
  id: string
  restaurantId: string
  instanceName: string
  phoneNumber?: string
  status: 'created' | 'connecting' | 'connected' | 'disconnected'
  integration: string
  lastSeen?: Date
  createdAt: Date
  updatedAt: Date
}

// Estado de Conexão
export interface ConnectionState {
  status: 'disconnected' | 'generating' | 'waiting' | 'connected' | 'error'
  pairingCode?: string
  qrcode?: string
  error?: string
}

// Histórico de Envio WhatsApp
export interface WhatsAppSend {
  id: string
  campaignId?: string
  customerId: string
  phone: string
  message: string
  status: 'pending' | 'sent' | 'delivered' | 'failed'
  sentAt?: Date
  deliveredAt?: Date
  error?: string
  createdAt: Date
}

// Pedido
export interface OrderItem {
  id: string
  menuItemId: string
  menuItemName: string
  size?: string
  additions: string[]
  complements: string[]
  fruits: string[]
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface Order {
  id: string
  tenantId: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  items: OrderItem[]
  subtotal: number
  total: number
  status: 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  paymentMethod?: 'cash' | 'card' | 'pix' | 'other'
  deliveryType: 'pickup' | 'delivery'
  deliveryAddress?: string
  notes?: string
  source: 'digital' | 'counter' // Origem do pedido: digital (cardápio online) ou counter (balcão)
  createdAt: Date
  updatedAt: Date
  acceptedAt?: Date
  readyAt?: Date
  deliveredAt?: Date
}
