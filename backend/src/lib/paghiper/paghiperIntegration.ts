/**
 * Integração genérica com PagHiper (PIX e Boleto).
 * Arquivo pensado para reutilização em outros projetos.
 */

export type PagHiperPaymentMethod = 'pix' | 'boleto'

export interface PagHiperConfig {
  apiKey: string
  token: string
  notificationUrl: string
}

export interface PagHiperCustomer {
  name: string
  email: string
  document: string
  phone: string
}

export interface PagHiperCreateChargeInput {
  externalOrderId: string
  description: string
  amountCents: number
  paymentMethod: PagHiperPaymentMethod
  customer: PagHiperCustomer
  validityDays?: number
}

export interface PagHiperCreateChargeResult {
  transactionId: string
  orderId: string
  dueDate?: string
  paymentInstructions: {
    pix?: {
      qrcodeImageUrl?: string | null
      pixCode?: string | null
    }
    boleto?: {
      digitableLine?: string | null
      bankSlipUrl?: string | null
      bankSlipPdfUrl?: string | null
    }
  }
  raw: unknown
}

export interface PagHiperStatusResult {
  status: string
  paidDate?: string
  raw: unknown
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`)
  return v
}

export function getPagHiperConfigFromEnv(
  overrides?: Partial<PagHiperConfig>
): PagHiperConfig {
  return {
    apiKey: overrides?.apiKey ?? requireEnv('PAGHIPER_API_KEY'),
    token: overrides?.token ?? requireEnv('PAGHIPER_TOKEN'),
    notificationUrl:
      overrides?.notificationUrl ?? requireEnv('PAGHIPER_NOTIFICATION_URL'),
  }
}

function mask(value: string) {
  if (!value || value.length < 8) return '***'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

function normalizeDocument(value: string) {
  return value.replace(/\D/g, '')
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}

function ensureSuccessPayload(data: any) {
  // PIX costuma retornar pix_create_request; Boleto create_request.
  const payload = data?.pix_create_request ?? data?.create_request
  if (!payload) {
    throw new Error('Resposta da PagHiper sem pix_create_request/create_request')
  }
  if (payload.result !== 'success') {
    throw new Error(payload.response_message || 'PagHiper retornou erro')
  }
  return payload
}

export async function createPagHiperCharge(
  input: PagHiperCreateChargeInput,
  config = getPagHiperConfigFromEnv()
): Promise<PagHiperCreateChargeResult> {
  if (input.paymentMethod === 'pix' && input.amountCents < 300) {
    throw new Error('PIX exige valor mínimo de R$ 3,00')
  }

  const endpoint =
    input.paymentMethod === 'pix'
      ? 'https://pix.paghiper.com/invoice/create/'
      : 'https://api.paghiper.com/transaction/create/'

  const body = {
    apiKey: config.apiKey,
    token: config.token,
    order_id: input.externalOrderId,
    payer_email: input.customer.email,
    payer_name: input.customer.name,
    payer_cpf_cnpj: normalizeDocument(input.customer.document),
    payer_phone: normalizePhone(input.customer.phone),
    notification_url: config.notificationUrl,
    fixed_description: true,
    days_due_date: Math.max(1, input.validityDays ?? 3),
    type_bank_slip: input.paymentMethod === 'boleto' ? 'boletoA4' : undefined,
    items: [
      {
        description: input.description,
        quantity: 1,
        item_id: input.externalOrderId,
        price_cents: input.amountCents,
      },
    ],
  }

  const safeLog = {
    ...body,
    apiKey: mask(body.apiKey),
    token: mask(body.token),
  }
  console.log('[PagHiper] create charge request:', safeLog)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  const rawText = await response.text()
  if (!rawText.trim()) throw new Error('Resposta vazia da PagHiper')

  let data: any
  try {
    data = JSON.parse(rawText)
  } catch {
    throw new Error('Resposta PagHiper não é JSON válido')
  }

  const payload = ensureSuccessPayload(data)
  const pixCode = payload.pix_code || {}
  const bankSlip = payload.bank_slip || {}

  return {
    transactionId: String(payload.transaction_id || ''),
    orderId: String(payload.order_id || ''),
    dueDate: payload.status_date ? String(payload.status_date) : undefined,
    paymentInstructions: {
      pix:
        input.paymentMethod === 'pix'
          ? {
              qrcodeImageUrl: pixCode.qrcode_image_url ?? null,
              pixCode: pixCode.emv ?? null,
            }
          : undefined,
      boleto:
        input.paymentMethod === 'boleto'
          ? {
              digitableLine: bankSlip.digitable_line ?? null,
              bankSlipUrl: bankSlip.url_slip ?? null,
              bankSlipPdfUrl: bankSlip.url_slip_pdf ?? null,
            }
          : undefined,
    },
    raw: data,
  }
}

export async function getPagHiperTransactionStatus(
  transactionId: string,
  paymentMethod: PagHiperPaymentMethod,
  config = getPagHiperConfigFromEnv()
): Promise<PagHiperStatusResult> {
  const endpoint =
    paymentMethod === 'pix'
      ? 'https://pix.paghiper.com/invoice/status/'
      : 'https://api.paghiper.com/transaction/status/'

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      apiKey: config.apiKey,
      token: config.token,
      transaction_id: transactionId,
    }),
  })

  if (!response.ok) {
    throw new Error(`Falha ao consultar status na PagHiper: ${response.status}`)
  }

  const data: any = await response.json()
  const statusRequest = data?.status_request
  if (!statusRequest || statusRequest.result !== 'success') {
    throw new Error(
      statusRequest?.response_message || 'Falha na resposta de status PagHiper'
    )
  }

  const statusRaw =
    statusRequest.status || statusRequest.transaction?.status || 'unknown'
  const paidDate =
    statusRequest.transaction?.date_payment_approved ||
    statusRequest.transaction?.date_payment ||
    statusRequest.transaction?.data_pagamento ||
    statusRequest.transaction?.paid_date ||
    statusRequest.status_date

  return {
    status: String(statusRaw).toLowerCase(),
    paidDate: paidDate ? String(paidDate) : undefined,
    raw: data,
  }
}

/**
 * Mapeia status da PagHiper para status interno de pedido.
 */
export function mapPagHiperStatusToInternal(status: string) {
  switch (String(status).toLowerCase()) {
    case 'paid':
    case 'completed':
    case 'settled':
      return 'paid'
    case 'cancelled':
    case 'refunded':
      return 'cancelled'
    case 'expired':
      return 'expired'
    case 'failed':
    case 'chargeback':
      return 'failed'
    case 'pending':
    case 'waiting_payment':
      return 'pending'
    default:
      return 'unknown'
  }
}

/**
 * Confere assinatura simples do webhook via apiKey enviada no body.
 */
export function isValidPagHiperWebhookApiKey(
  providedApiKey: string | undefined,
  expectedApiKey = process.env.PAGHIPER_API_KEY
) {
  if (!expectedApiKey) return true // fallback opcional para ambiente local
  return !!providedApiKey && providedApiKey === expectedApiKey
}

