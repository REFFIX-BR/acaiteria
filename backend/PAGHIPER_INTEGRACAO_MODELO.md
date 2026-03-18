# Integracao PagHiper (modelo reutilizavel)

Este guia foi feito para voce copiar para outro projeto com Node.js + Express.

## 1) Variaveis de ambiente

No `.env` do backend:

```env
PAGHIPER_API_KEY=...
PAGHIPER_TOKEN=...
PAGHIPER_NOTIFICATION_URL=https://seu-dominio.com/api/paghiper/webhook
```

## 2) Modulo pronto de integracao

Use o arquivo:

- `src/lib/paghiper/paghiperIntegration.ts`

Ele ja tem:

- Criacao de cobranca PIX e Boleto (`createPagHiperCharge`)
- Consulta de status (`getPagHiperTransactionStatus`)
- Mapeamento de status da PagHiper (`mapPagHiperStatusToInternal`)
- Validacao simples de webhook por `apiKey` (`isValidPagHiperWebhookApiKey`)

## 3) Exemplo de rota de checkout

```ts
import { Router } from 'express'
import { z } from 'zod'
import { createPagHiperCharge } from '../lib/paghiper/paghiperIntegration.js'

const router = Router()

const checkoutSchema = z.object({
  paymentMethod: z.enum(['pix', 'boleto']),
  amountCents: z.number().int().positive(),
  externalOrderId: z.string().min(1),
  description: z.string().min(1),
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    document: z.string().min(11),
    phone: z.string().min(10),
  }),
})

router.post('/checkout', async (req, res) => {
  try {
    const data = checkoutSchema.parse(req.body)

    const charge = await createPagHiperCharge({
      externalOrderId: data.externalOrderId,
      description: data.description,
      amountCents: data.amountCents,
      paymentMethod: data.paymentMethod,
      customer: data.customer,
      validityDays: 3,
    })

    // Salve no banco: transactionId, orderId, raw etc.
    return res.json({ success: true, charge })
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message })
  }
})

export default router
```

## 4) Exemplo de webhook

```ts
import { Router } from 'express'
import {
  getPagHiperTransactionStatus,
  isValidPagHiperWebhookApiKey,
  mapPagHiperStatusToInternal,
} from '../lib/paghiper/paghiperIntegration.js'

const router = Router()

router.post('/paghiper/webhook', async (req, res) => {
  try {
    if (!isValidPagHiperWebhookApiKey(req.body?.apiKey)) {
      return res.status(403).json({ error: 'API Key invalida' })
    }

    const transactionId = req.body?.transaction_id
    if (!transactionId) {
      return res.status(400).json({ error: 'transaction_id obrigatorio' })
    }

    // 1) Busque seu pedido no banco pelo transactionId
    // const order = await findOrderByTransactionId(transactionId)

    // 2) Descubra o metodo que foi usado no checkout
    const paymentMethod = 'pix' as const // ou 'boleto'

    // 3) Consulte a API para confirmar status real
    const status = await getPagHiperTransactionStatus(transactionId, paymentMethod)
    const mapped = mapPagHiperStatusToInternal(status.status)

    // 4) Atualize seu pedido no banco
    // await updateOrderStatus(order.id, mapped, status.paidDate)

    return res.json({ ok: true, status: mapped })
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message })
  }
})

export default router
```

## 5) Boas praticas importantes

- Nao confie apenas no body do webhook para status; sempre consulte `status` na API.
- Sempre armazene `transaction_id` da PagHiper no seu pedido.
- Mascare `apiKey/token` nos logs.
- Use rate limit no endpoint de webhook.
- Para PIX, respeite valor minimo (R$ 3,00).

## 6) Fluxo recomendado (resumo)

1. Cliente chama `/checkout`
2. Backend cria cobranca na PagHiper
3. Backend salva `transaction_id` + status `pending`
4. PagHiper chama seu webhook
5. Backend consulta status na API PagHiper
6. Backend atualiza pedido para `paid/cancelled/...`

---

Se quiser, no proximo passo eu tambem gero um **pacote completo com migrations SQL + modelo de tabela de pedidos + endpoints prontos** para voce colar em qualquer projeto novo.

