/**
 * Cliente para comunicação com a API PagHiper
 * Documentação: https://dev.paghiper.com/reference/
 */

interface PagHiperConfig {
  apiKey: string
  token: string
  notificationUrl: string
}

interface PagHiperCustomer {
  name: string
  email: string
  document: string
  phone: string
}

interface PagHiperChargeRequest {
  orderId: string
  planName: string
  amountCents: number
  paymentMethod: 'pix' | 'boleto'
  customer: PagHiperCustomer
  notificationUrl: string
  validityDays: number
}

interface PagHiperItem {
  description: string
  quantity: number
  item_id: string
  price_cents: number
}

interface PagHiperPixResponse {
  create_request: {
    result: string
    response_message: string
    transaction_id?: string
    order_id?: string
    pix_code?: string
    qrcode_image_url?: string
    status_date?: string
    status?: string
  }
}

interface PagHiperBoletoResponse {
  create_request: {
    result: string
    response_message: string
    transaction_id?: string
    order_id?: string
    bank_slip?: {
      digitable_line?: string
      url_slip?: string
      url_slip_pdf?: string
    }
    status_date?: string
    status?: string
  }
}

interface PagHiperChargeResult {
  transactionId?: string
  paghiperOrderId?: string
  dueDate?: Date
  paymentInstructions: {
    pix?: {
      qrcodeImage?: string | null
      pixCode?: string | null
    }
    boleto?: {
      digitableLine?: string | null
      url?: string | null
      pdfUrl?: string | null
    }
  }
  raw: any
}

interface PagHiperStatusResponse {
  status_request: {
    result: string
    response_message?: string
    status?: string
    status_date?: string
    transaction?: {
      status?: string
      date_payment_approved?: string
      date_payment?: string
      data_pagamento?: string
      paid_date?: string
    }
  }
}

/**
 * Valida se variável de ambiente existe, caso contrário lança erro
 */
function assertEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Variável de ambiente ${key} não configurada`)
  }
  return value
}

/**
 * Cria uma cobrança PIX na PagHiper
 */
async function createPixCharge(
  request: PagHiperChargeRequest,
  config: PagHiperConfig
): Promise<PagHiperChargeResult> {
  const endpoint = 'https://pix.paghiper.com/invoice/create/'

  // Validar valor mínimo PIX (R$ 3,00)
  if (request.amountCents < 300) {
    throw new Error('Valor mínimo para PIX é R$ 3,00')
  }

  const items: PagHiperItem[] = [
    {
      description: request.planName,
      quantity: 1,
      item_id: request.orderId,
      price_cents: request.amountCents,
    },
  ]

  const body = {
    apiKey: config.apiKey,
    token: config.token,
    order_id: request.orderId,
    payer_email: request.customer.email,
    payer_name: request.customer.name,
    payer_cpf_cnpj: request.customer.document.replace(/\D/g, ''),
    payer_phone: request.customer.phone.replace(/\D/g, ''),
    notification_url: config.notificationUrl,
    fixed_description: true,
    days_due_date: Math.max(1, request.validityDays || 30),
    items,
  }

  console.log('[PagHiper] Criando cobrança PIX:', {
    orderId: request.orderId,
    amount: request.amountCents / 100,
    customer: request.customer.email,
  })

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = (await response.json()) as PagHiperPixResponse

  if (response.status !== 201 || data.create_request.result !== 'success') {
    console.error('[PagHiper] Erro ao criar cobrança PIX:', {
      status: response.status,
      result: data.create_request.result,
      message: data.create_request.response_message,
    })
    throw new Error(
      data.create_request.response_message || 'Erro ao criar cobrança PIX'
    )
  }

  console.log('[PagHiper] Cobrança PIX criada com sucesso:', {
    transactionId: data.create_request.transaction_id,
    orderId: data.create_request.order_id,
  })

  // Calcular data de vencimento
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (request.validityDays || 30))

  return {
    transactionId: data.create_request.transaction_id,
    paghiperOrderId: data.create_request.order_id,
    dueDate,
    paymentInstructions: {
      pix: {
        qrcodeImage: data.create_request.qrcode_image_url || null,
        pixCode: data.create_request.pix_code || null,
      },
    },
    raw: data,
  }
}

/**
 * Cria uma cobrança Boleto na PagHiper
 */
async function createBoletoCharge(
  request: PagHiperChargeRequest,
  config: PagHiperConfig
): Promise<PagHiperChargeResult> {
  const endpoint = 'https://api.paghiper.com/transaction/create/'

  const items: PagHiperItem[] = [
    {
      description: request.planName,
      quantity: 1,
      item_id: request.orderId,
      price_cents: request.amountCents,
    },
  ]

  const body = {
    apiKey: config.apiKey,
    token: config.token,
    order_id: request.orderId,
    payer_email: request.customer.email,
    payer_name: request.customer.name,
    payer_cpf_cnpj: request.customer.document.replace(/\D/g, ''),
    payer_phone: request.customer.phone.replace(/\D/g, ''),
    notification_url: config.notificationUrl,
    fixed_description: true,
    days_due_date: Math.max(1, request.validityDays || 30),
    type_bank_slip: 'boletoA4',
    late_payment_fine: 2.0,
    per_day_interest: true,
    items,
  }

  console.log('[PagHiper] Criando cobrança Boleto:', {
    orderId: request.orderId,
    amount: request.amountCents / 100,
    customer: request.customer.email,
  })

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = (await response.json()) as PagHiperBoletoResponse

  if (response.status !== 201 || data.create_request.result !== 'success') {
    console.error('[PagHiper] Erro ao criar cobrança Boleto:', {
      status: response.status,
      result: data.create_request.result,
      message: data.create_request.response_message,
    })
    throw new Error(
      data.create_request.response_message || 'Erro ao criar cobrança Boleto'
    )
  }

  console.log('[PagHiper] Cobrança Boleto criada com sucesso:', {
    transactionId: data.create_request.transaction_id,
    orderId: data.create_request.order_id,
  })

  // Calcular data de vencimento
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (request.validityDays || 30))

  return {
    transactionId: data.create_request.transaction_id,
    paghiperOrderId: data.create_request.order_id,
    dueDate,
    paymentInstructions: {
      boleto: {
        digitableLine: data.create_request.bank_slip?.digitable_line || null,
        url: data.create_request.bank_slip?.url_slip || null,
        pdfUrl: data.create_request.bank_slip?.url_slip_pdf || null,
      },
    },
    raw: data,
  }
}

/**
 * Cria uma cobrança na PagHiper (PIX ou Boleto)
 */
export async function createPagHiperCharge(
  request: PagHiperChargeRequest
): Promise<PagHiperChargeResult> {
  const apiKey = assertEnv('PAGHIPER_API_KEY')
  const token = assertEnv('PAGHIPER_TOKEN')
  const notificationUrl =
    request.notificationUrl || assertEnv('PAGHIPER_NOTIFICATION_URL')

  const config = { apiKey, token, notificationUrl }

  if (request.paymentMethod === 'pix') {
    const pixCharge = await createPixCharge(request, config)
    pixCharge.paymentInstructions.pix = {
      qrcodeImage: pixCharge.paymentInstructions.pix?.qrcodeImage ?? null,
      pixCode: pixCharge.paymentInstructions.pix?.pixCode ?? null,
    }
    return pixCharge
  }

  const boletoCharge = await createBoletoCharge(request, config)
  boletoCharge.paymentInstructions.boleto = {
    digitableLine:
      boletoCharge.paymentInstructions.boleto?.digitableLine ?? null,
    url: boletoCharge.paymentInstructions.boleto?.url ?? null,
    pdfUrl: boletoCharge.paymentInstructions.boleto?.pdfUrl ?? null,
  }

  return boletoCharge
}

/**
 * Consulta status de uma transação na PagHiper
 */
export async function getPagHiperTransactionStatus(
  transactionId: string,
  paymentMethod: 'pix' | 'boleto'
): Promise<{ status: string; paidDate?: string } | null> {
  const apiKey = assertEnv('PAGHIPER_API_KEY')
  const token = assertEnv('PAGHIPER_TOKEN')

  // Usar endpoint correto baseado no tipo de pagamento
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
      token,
      apiKey,
      transaction_id: transactionId,
    }),
  })

  if (!response.ok) {
    console.error(
      `[PagHiper] Erro ao consultar status da transação (${paymentMethod}):`,
      response.status,
      response.statusText
    )
    return null
  }

  const data = (await response.json()) as PagHiperStatusResponse

  console.log(
    `[PagHiper] Resposta completa da API de status (${paymentMethod}):`,
    JSON.stringify(data, null, 2)
  )

  // Verificar se a resposta tem o formato esperado
  if (!data.status_request) {
    console.warn(
      `[PagHiper] Formato de resposta não reconhecido - status_request não encontrado (${paymentMethod}):`,
      data
    )
    return null
  }

  // Verificar se o resultado foi sucesso
  if (data.status_request.result !== 'success') {
    console.warn(
      `[PagHiper] Consulta de status não foi bem-sucedida (${paymentMethod}):`,
      {
        result: data.status_request.result,
        response_message: data.status_request.response_message,
      }
    )
    return null
  }

  // Extrair status - formato pode variar entre PIX e Boleto
  let status: string | undefined
  let paidDate: string | undefined

  if (paymentMethod === 'pix') {
    // Para PIX: status está diretamente em status_request.status
    status = data.status_request.status
    // status_date é a data da última alteração de status
    if (
      status === 'paid' ||
      status === 'completed' ||
      status === 'settled'
    ) {
      paidDate = data.status_request.status_date
    }
  } else {
    // Para Boleto: pode estar em status_request.status ou status_request.transaction.status
    status =
      data.status_request.status || data.status_request.transaction?.status
    // Data de pagamento pode estar em diferentes campos
    paidDate =
      data.status_request.transaction?.date_payment_approved ||
      data.status_request.transaction?.date_payment ||
      data.status_request.transaction?.data_pagamento ||
      data.status_request.transaction?.paid_date ||
      (status === 'paid' ||
      status === 'completed' ||
      status === 'settled'
        ? data.status_request.status_date
        : undefined)
  }

  if (!status) {
    console.warn(
      `[PagHiper] Status não encontrado na resposta (${paymentMethod}):`,
      data.status_request
    )
    return null
  }

  console.log(`[PagHiper] Status extraído (${paymentMethod}):`, {
    status,
    paidDate,
    status_date: data.status_request.status_date,
    response_message: data.status_request.response_message,
  })

  return {
    status: String(status).toLowerCase(),
    paidDate: paidDate ? String(paidDate) : undefined,
  }
}

