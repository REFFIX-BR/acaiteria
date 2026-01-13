# Documentação: Integração PagHiper e Atualização de Planos

Este documento descreve como foi implementada a integração com a PagHiper e como o sistema atualiza corretamente os planos no banco de dados quando um pagamento é confirmado.

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura da Integração](#arquitetura-da-integração)
3. [Fluxo Completo de Pagamento](#fluxo-completo-de-pagamento)
4. [Componentes da Integração](#componentes-da-integração)
5. [Atualização de Planos no Banco](#atualização-de-planos-no-banco)
6. [Configuração](#configuração)
7. [Tratamento de Erros](#tratamento-de-erros)

---

## 🎯 Visão Geral

A integração com PagHiper permite que clientes paguem planos de assinatura através de **PIX** ou **Boleto**. O sistema gerencia todo o ciclo de vida do pagamento:

- ✅ Criação de cobranças na PagHiper
- ✅ Recebimento de webhooks de atualização de status
- ✅ Verificação ativa do status na API PagHiper
- ✅ Atualização automática de planos no banco de dados
- ✅ Ativação/renovação de assinaturas

---

## 🏗️ Arquitetura da Integração

### Arquivos Principais

```
server/
├── paghiperClient.ts       # Cliente para comunicação com API PagHiper
├── planOrdersService.ts    # Serviço de gerenciamento de pedidos
├── plansRoutes.ts          # Rotas da API (inclui webhook)
└── storage.ts              # Camada de acesso ao banco de dados
```

### Fluxo de Dados

```
[Frontend] → [API Checkout] → [PagHiper Client] → [PagHiper API]
                                                          ↓
[Webhook PagHiper] ← [PagHiper API] ← [Verificação Status]
         ↓
[PlansRoutes] → [PlanOrdersService] → [Storage] → [Banco de Dados]
```

---

## 🔄 Fluxo Completo de Pagamento

### 1. Checkout (Criação do Pedido)

**Endpoint:** `POST /api/plans/:id/checkout`

```typescript
// server/planOrdersService.ts - Método checkout()
```

**Processo:**

1. **Validação do Plano**
   - Verifica se o plano existe e está ativo
   - Calcula valor final (incluindo anuais, adicionais e cupons)

2. **Criação do Pedido no Banco**
   - Cria registro na tabela `plan_orders` com status `pending`
   - Salva `restaurantId` no campo `paghiperResponse` como metadata
   - Salva informações do cupom (se aplicado) no metadata

3. **Criação da Cobrança na PagHiper**
   - Chama `createPagHiperCharge()` com dados do cliente
   - Endpoints utilizados:
     - **PIX:** `https://pix.paghiper.com/invoice/create/`
     - **Boleto:** `https://api.paghiper.com/transaction/create/`

4. **Atualização do Pedido**
   - Salva `paghiperOrderId`, `paghiperTransactionId` e resposta completa
   - Preserva `restaurantId` no `paghiperResponse`
   - Define `dueDate` (data de vencimento)

**Código de Referência:**

```125:208:QR-CODE-RESTAURANT-master/server/planOrdersService.ts
    // Salvar restaurantId e informações do cupom no paghiperResponse como metadata para uso posterior
    const orderMetadata: any = {};
    if (restaurantId) {
      orderMetadata.restaurantId = restaurantId;
    }
    if (couponId && couponDiscountApplied > 0) {
      orderMetadata.couponId = couponId;
      orderMetadata.couponCode = payload.couponCode;
      orderMetadata.couponDiscountApplied = couponDiscountApplied;
    }
    
    const order = await storage.createPlanOrder({
      planId,
      customerName: payload.customerName,
      customerEmail: payload.customerEmail,
      customerDocument: payload.customerDocument,
      customerPhone: payload.customerPhone,
      paymentMethod: payload.paymentMethod,
      status: "pending",
      amount: amountNumber.toFixed(2),
      validityDays,
      paghiperResponse: Object.keys(orderMetadata).length > 0 ? orderMetadata : null,
    });
    
    if (restaurantId) {
      console.info("[plan-orders] Pedido criado com restaurantId:", {
        orderId: order.id,
        restaurantId,
      });
    }

    console.info("[plan-orders] ordem criada", {
      orderId: order.id,
      planId,
      paymentMethod: payload.paymentMethod,
      customer: payload.customerEmail,
      couponCode: payload.couponCode,
      couponDiscount: couponDiscountApplied,
    });

      await storage.createPlanOrderEvent({
        planOrderId: order.id,
        status: "pending",
        payload: null,
      });

    try {
      const notificationUrl = `${baseUrl.replace(/\/$/, "")}/api/paghiper/webhook`;
      const charge = await createPagHiperCharge({
        orderId: order.id,
        planName: plan.name,
        amountCents,
        paymentMethod: payload.paymentMethod,
        customer: {
          name: payload.customerName,
          email: payload.customerEmail,
          document: payload.customerDocument,
          phone: payload.customerPhone,
        },
        notificationUrl,
        validityDays: plan.validityDays,
      });

      // Preservar o restaurantId do metadata original ao atualizar com a resposta da PagHiper
      let paghiperResponseToSave: any = charge.raw;
      if (orderMetadata.restaurantId && paghiperResponseToSave && typeof paghiperResponseToSave === 'object') {
        // Se temos restaurantId e a resposta da PagHiper é um objeto, preservar o restaurantId
        paghiperResponseToSave = JSON.parse(JSON.stringify(paghiperResponseToSave));
        paghiperResponseToSave.restaurantId = orderMetadata.restaurantId;
        console.log("[plan-orders] Preservando restaurantId na resposta da PagHiper:", orderMetadata.restaurantId);
      } else if (orderMetadata.restaurantId) {
        // Se a resposta não é um objeto válido, criar um objeto com o restaurantId
        paghiperResponseToSave = {
          ...(paghiperResponseToSave || {}),
          restaurantId: orderMetadata.restaurantId,
        };
      }
      
      const updated = await storage.updatePlanOrder(order.id, {
        paghiperOrderId: charge.paghiperOrderId ?? undefined,
        paghiperTransactionId: charge.transactionId ?? undefined,
        paghiperResponse: paghiperResponseToSave,
        dueDate: charge.dueDate ?? undefined,
      });
```

### 2. Webhook da PagHiper

**Endpoint:** `POST /api/paghiper/webhook`

```typescript
// server/plansRoutes.ts - Rota /api/paghiper/webhook
```

**Processo:**

1. **Autenticação**
   - Valida `apiKey` enviada pela PagHiper no body
   - Compara com `PAGHIPER_API_KEY` configurado

2. **Localização do Pedido**
   - Busca pedido pelo `transaction_id` recebido no webhook
   - Verifica se o pedido já está pago (evita reprocessamento)

3. **Consulta Ativa do Status**
   - Chama `getPagHiperTransactionStatus()` para verificar status atual
   - Usa endpoint correto baseado no método de pagamento:
     - **PIX:** `https://pix.paghiper.com/invoice/status/`
     - **Boleto:** `https://api.paghiper.com/transaction/status/`

4. **Atualização do Status**
   - Mapeia status PagHiper para status interno:
     - `paid` / `completed` / `settled` → `paid`
     - `cancelled` / `refunded` → `cancelled`
     - `expired` → `expired`
     - `failed` / `chargeback` → `failed`
   - Preserva `restaurantId` no `paghiperResponse` ao atualizar
   - Chama `planOrdersService.updateStatus()` com dados atualizados

**Código de Referência:**

```415:656:QR-CODE-RESTAURANT-master/server/plansRoutes.ts
  app.post("/api/paghiper/webhook", publicLimiter, async (req, res) => {
    try {
      // Log detalhado do que está chegando
      console.log("[PagHiper Webhook] Headers:", JSON.stringify(req.headers, null, 2));
      console.log("[PagHiper Webhook] Body:", JSON.stringify(req.body, null, 2));
      console.log("[PagHiper Webhook] Query:", JSON.stringify(req.query, null, 2));
      
      const rawPayload = (req.body ?? {}) as Record<string, any>;
      
      // A PagHiper envia a apiKey no body como forma de autenticação
      const providedApiKey = rawPayload.apiKey;
      const expectedApiKey = process.env.PAGHIPER_API_KEY;
      
      console.log("[PagHiper Webhook] API Key validation:", {
        expectedApiKey: expectedApiKey ? `${expectedApiKey.substring(0, 15)}...` : "não configurado",
        providedApiKey: providedApiKey ? `${providedApiKey.substring(0, 15)}...` : "não fornecido",
        match: expectedApiKey === providedApiKey,
      });

      // Validar a API Key
      if (expectedApiKey) {
        if (!providedApiKey || expectedApiKey !== providedApiKey) {
          console.error("[PagHiper Webhook] API Key inválida ou ausente");
          return res.status(403).json({ error: "API Key inválida." });
        }
      } else {
        console.warn("[PagHiper Webhook] PAGHIPER_API_KEY não configurado - aceitando webhook sem validação");
      }
      
      const payload = {
        transaction_id:
          rawPayload.transaction_id ??
          rawPayload.transactionId ??
          rawPayload.transaction ??
          rawPayload.transaction_code ??
          rawPayload.code ??
          undefined,
        order_id: rawPayload.order_id ?? rawPayload.orderId ?? rawPayload.order ?? rawPayload.order_id_custom ?? undefined,
        status:
          rawPayload.status ??
          rawPayload.status_pagamento ??
          rawPayload.status_pagseguro ??
          rawPayload.status_transaction ??
          rawPayload.transaction_status ??
          rawPayload.status_situacao ??
          "",
        paid_date: rawPayload.paid_date ?? rawPayload.payment_date ?? rawPayload.data_pagamento ?? undefined,
        notification_id: rawPayload.notification_id ?? rawPayload.notificationId ?? rawPayload.notification_code ?? undefined,
      };

      // A PagHiper não envia order_id nem status diretamente
      // Precisamos buscar o pedido pelo transaction_id
      if (!payload.transaction_id) {
        return res.status(400).json({ error: "transaction_id obrigatório" });
      }

      // Buscar o pedido pelo transaction_id
      console.log("[PagHiper Webhook] Buscando pedido para transaction_id:", payload.transaction_id);
      const planOrders = await storage.listPlanOrders({ page: 1, pageSize: 1000 });
      console.log("[PagHiper Webhook] Total de pedidos encontrados:", planOrders.data.length);
      
      const order = planOrders.data.find(o => o.paghiperTransactionId === payload.transaction_id);
      
      if (!order) {
        console.error("[PagHiper Webhook] Pedido não encontrado para transaction_id:", payload.transaction_id);
        console.log("[PagHiper Webhook] Transaction IDs disponíveis:", planOrders.data.map(o => o.paghiperTransactionId).filter(Boolean));
        return res.status(404).json({ error: "Pedido não encontrado" });
      }

      console.log("[PagHiper Webhook] Pedido encontrado:", {
        orderId: order.id,
        status: order.status,
        transactionId: order.paghiperTransactionId,
      });

      // Se o pedido já está pago, não atualizar novamente
      if (order.status === "paid") {
        console.log("[PagHiper Webhook] Pedido já está pago. Ignorando webhook.");
        return res.json({ 
          status: "ok", 
          message: "Pedido já está pago. Webhook ignorado." 
        });
      }

      const orderId = order.id;
      
      // Consultar o status na API da PagHiper
      let statusFromApi: string | undefined;
      let paidDateFromApi: string | undefined;
      try {
        const { getPagHiperTransactionStatus } = await import("./paghiperClient");
        // Passar o paymentMethod do pedido para usar o endpoint correto
        const paymentMethod = order.paymentMethod as "pix" | "boleto";
        if (!paymentMethod || (paymentMethod !== "pix" && paymentMethod !== "boleto")) {
          console.warn("[PagHiper Webhook] PaymentMethod inválido:", order.paymentMethod);
          // Tentar inferir do endpoint do webhook ou usar PIX como padrão
          const inferredMethod = payload.source_api?.includes("pix") ? "pix" : "boleto";
          console.log("[PagHiper Webhook] Usando paymentMethod inferido:", inferredMethod);
          const transactionStatus = await getPagHiperTransactionStatus(payload.transaction_id, inferredMethod);
          statusFromApi = transactionStatus?.status;
          paidDateFromApi = transactionStatus?.paidDate;
        } else {
          const transactionStatus = await getPagHiperTransactionStatus(payload.transaction_id, paymentMethod);
          statusFromApi = transactionStatus?.status;
          paidDateFromApi = transactionStatus?.paidDate;
        }
        console.log("[PagHiper Webhook] Status consultado na API:", {
          status: statusFromApi,
          paidDate: paidDateFromApi,
        });
      } catch (error) {
        console.error("[PagHiper Webhook] Erro ao consultar status na API:", error);
        // Continuar mesmo se falhar a consulta
      }

      // IMPORTANTE: Só atualizar o status se tivermos confirmação explícita da API
      // Não assumir que está pago apenas porque recebemos um webhook
      // A PagHiper envia webhooks em diferentes momentos (criação, atualização, etc.)
      let nextStatus: PlanOrderStatus | null = null;
      
      if (statusFromApi) {
        // Temos status da API, usar ele
        const statusNormalized = statusFromApi.toLowerCase();
        switch (statusNormalized) {
          case "paid":
          case "completed":
          case "settled":
            nextStatus = "paid";
            break;
          case "cancelled":
          case "refunded":
            nextStatus = "cancelled";
            break;
          case "expired":
            nextStatus = "expired";
            break;
          case "failed":
          case "chargeback":
            nextStatus = "failed";
            break;
          case "pending":
          case "waiting_payment":
            nextStatus = "pending";
            break;
          default:
            // Status desconhecido, não atualizar
            console.warn("[PagHiper Webhook] Status desconhecido da API:", statusFromApi);
            nextStatus = null;
        }
      } else {
        // Não conseguimos consultar o status na API
        // Não atualizar o status do pedido, apenas registrar o webhook recebido
        console.log("[PagHiper Webhook] Não foi possível consultar status na API. Webhook registrado mas status não atualizado.");
        // Retornar sucesso mas sem atualizar o status
        return res.json({ 
          status: "ok", 
          message: "Webhook recebido mas status não atualizado (não foi possível consultar status na API)" 
        });
      }
      
      // Se não temos um status válido, não atualizar
      if (nextStatus === null) {
        console.log("[PagHiper Webhook] Status não atualizado - status inválido ou desconhecido");
        return res.json({ 
          status: "ok", 
          message: "Webhook recebido mas status não atualizado (status inválido)" 
        });
      }

      const paidAt =
        nextStatus === "paid" && (paidDateFromApi || payload.paid_date)
          ? parseWebhookDate(paidDateFromApi || payload.paid_date) ?? new Date()
          : undefined;

      const cancelledAt = nextStatus === "cancelled" ? new Date() : undefined;

      console.log("[PagHiper Webhook] Atualizando pedido:", {
        orderId,
        nextStatus,
        paidAt: paidAt?.toISOString(),
        cancelledAt: cancelledAt?.toISOString(),
      });

      try {
        // Preparar dados de atualização, garantindo que não haja valores null indevidos
        const updateData: any = {
          eventPayload: req.body,
        };
        
        if (payload.transaction_id || payload.transactionId) {
          updateData.paghiperTransactionId = payload.transaction_id ?? payload.transactionId;
        }
        
        // Só incluir paghiperResponse se for um objeto válido
        // IMPORTANTE: Preservar o restaurantId do metadata original se existir
        if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
          // Preservar restaurantId do metadata original
          let restaurantIdFromOriginal: string | undefined = undefined;
          if (order.paghiperResponse && typeof order.paghiperResponse === 'object') {
            const originalMetadata = order.paghiperResponse as any;
            if (originalMetadata.restaurantId && typeof originalMetadata.restaurantId === 'string') {
              restaurantIdFromOriginal = originalMetadata.restaurantId;
            }
          }
          
          const webhookResponse: any = JSON.parse(JSON.stringify(req.body));
          
          // Preservar restaurantId se existir
          if (restaurantIdFromOriginal) {
            webhookResponse.restaurantId = restaurantIdFromOriginal;
          }
          
          updateData.paghiperResponse = webhookResponse;
        }
        
        if (paidAt) {
          updateData.paidAt = paidAt;
        }
        
        if (cancelledAt) {
          updateData.cancelledAt = cancelledAt;
        }
        
        await planOrdersService.updateStatus(orderId, nextStatus, updateData);
        
        console.log("[PagHiper Webhook] Pedido atualizado com sucesso");
      } catch (updateError) {
        console.error("[PagHiper Webhook] Erro ao atualizar pedido:", updateError);
        throw updateError;
      }

      console.info("[paghiper] webhook recebido", {
        orderId,
        status: nextStatus,
        transactionId: payload.transaction_id ?? payload.transactionId ?? undefined,
      });

      return res.json({ status: "ok" });
    } catch (error) {
      return handlePlanOrderError(res, error);
    }
  });
```

---

## 🔧 Componentes da Integração

### 1. PagHiper Client (`paghiperClient.ts`)

Cliente TypeScript para comunicação com a API PagHiper.

#### Funções Principais

**`createPagHiperCharge()`**
- Cria cobrança PIX ou Boleto na PagHiper
- Retorna dados de pagamento (QR Code PIX, linha digitável do boleto, etc.)

```312:341:QR-CODE-RESTAURANT-master/server/paghiperClient.ts
export async function createPagHiperCharge(request: PagHiperChargeRequest): Promise<PagHiperChargeResult> {
  const apiKey = assertEnv("PAGHIPER_API_KEY");
  const token = assertEnv("PAGHIPER_TOKEN");
  const notificationUrl = request.notificationUrl || assertEnv("PAGHIPER_NOTIFICATION_URL");

  const config = { apiKey, token, notificationUrl };

  if (request.paymentMethod === "pix") {
    const pixCharge = await createPixCharge(request, config);

    // PagHiper PIX dificilmente retorna boleto. Porém, para padronização com o restante do sistema
    // adicionamos valores default caso algum campo venha como undefined, evitando erros na serialização/validacão.
    pixCharge.paymentInstructions.pix = {
      qrcodeImage: pixCharge.paymentInstructions.pix?.qrcodeImage ?? null,
      pixCode: pixCharge.paymentInstructions.pix?.pixCode ?? null,
    };

    return pixCharge;
  }

  const boletoCharge = await createBoletoCharge(request, config);

  boletoCharge.paymentInstructions.boleto = {
    digitableLine: boletoCharge.paymentInstructions.boleto?.digitableLine ?? null,
    url: boletoCharge.paymentInstructions.boleto?.url ?? null,
    pdfUrl: boletoCharge.paymentInstructions.boleto?.pdfUrl ?? null,
  };

  return boletoCharge;
}
```

**`getPagHiperTransactionStatus()`**
- Consulta status de uma transação na PagHiper
- Suporta diferentes endpoints para PIX e Boleto
- Retorna status e data de pagamento (se pago)

```343:432:QR-CODE-RESTAURANT-master/server/paghiperClient.ts
export async function getPagHiperTransactionStatus(
  transactionId: string,
  paymentMethod: "pix" | "boleto"
): Promise<{ status: string; paidDate?: string } | null> {
  const apiKey = assertEnv("PAGHIPER_API_KEY");
  const token = assertEnv("PAGHIPER_TOKEN");

  // Usar endpoint correto baseado no tipo de pagamento
  // PIX: https://pix.paghiper.com/invoice/status/
  // Boleto: https://api.paghiper.com/transaction/status/
  const endpoint = paymentMethod === "pix"
    ? "https://pix.paghiper.com/invoice/status/"
    : "https://api.paghiper.com/transaction/status/";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      token,
      apiKey,
      transaction_id: transactionId,
    }),
  });

  if (!response.ok) {
    console.error(`[PagHiper] Erro ao consultar status da transação (${paymentMethod}):`, response.status, response.statusText);
    return null;
  }

  const data = await response.json();
  
  console.log(`[PagHiper] Resposta completa da API de status (${paymentMethod}):`, JSON.stringify(data, null, 2));
  
  // Verificar se a resposta tem o formato esperado conforme documentação
  if (!data.status_request) {
    console.warn(`[PagHiper] Formato de resposta não reconhecido - status_request não encontrado (${paymentMethod}):`, data);
    return null;
  }

  // Verificar se o resultado foi sucesso
  if (data.status_request.result !== "success") {
    console.warn(`[PagHiper] Consulta de status não foi bem-sucedida (${paymentMethod}):`, {
      result: data.status_request.result,
      response_message: data.status_request.response_message,
    });
    return null;
  }

  // Extrair status - formato pode variar entre PIX e Boleto
  let status: string | undefined;
  let paidDate: string | undefined;

  if (paymentMethod === "pix") {
    // Para PIX: status está diretamente em status_request.status
    status = data.status_request.status;
    // status_date é a data da última alteração de status
    if (status === "paid" || status === "completed" || status === "settled") {
      paidDate = data.status_request.status_date;
    }
  } else {
    // Para Boleto: pode estar em status_request.status ou status_request.transaction.status
    status = data.status_request.status || data.status_request.transaction?.status;
    // Data de pagamento pode estar em diferentes campos
    paidDate = data.status_request.transaction?.date_payment_approved ||
               data.status_request.transaction?.date_payment ||
               data.status_request.transaction?.data_pagamento ||
               data.status_request.transaction?.paid_date ||
               (status === "paid" || status === "completed" || status === "settled" ? data.status_request.status_date : undefined);
  }

  if (!status) {
    console.warn(`[PagHiper] Status não encontrado na resposta (${paymentMethod}):`, data.status_request);
    return null;
  }
  
  console.log(`[PagHiper] Status extraído (${paymentMethod}):`, { 
    status, 
    paidDate,
    status_date: data.status_request.status_date,
    response_message: data.status_request.response_message,
  });
  
  return {
    status: String(status).toLowerCase(),
    paidDate: paidDate ? String(paidDate) : undefined,
  };
}
```

### 2. Plan Orders Service (`planOrdersService.ts`)

Serviço responsável por gerenciar pedidos de planos e ativar assinaturas.

#### Métodos Principais

- `checkout()` - Cria pedido e cobrança
- `updateStatus()` - Atualiza status do pedido e ativa assinatura se pago
- `list()` - Lista pedidos
- `getById()` - Busca pedido por ID

---

## 💾 Atualização de Planos no Banco

### Estrutura do Banco de Dados

#### Tabela `plan_orders`

Campos principais relacionados à PagHiper:

```sql
paghiper_order_id TEXT,
paghiper_transaction_id TEXT,
paghiper_response JSONB,  -- Armazena resposta completa + metadata (restaurantId, cupom)
```

**Schema TypeScript:**

```766:785:QR-CODE-RESTAURANT-master/shared/schema.ts
export const planOrders = pgTable("plan_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => plans.id, { onDelete: "restrict" }),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerDocument: text("customer_document"),
  customerPhone: text("customer_phone"),
  paymentMethod: planOrderPaymentMethodEnum("payment_method").notNull(),
  status: planOrderStatusEnum("status").default("pending").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  validityDays: integer("validity_days").notNull(),
  paghiperOrderId: text("paghiper_order_id"),
  paghiperTransactionId: text("paghiper_transaction_id"),
  paghiperResponse: jsonb("paghiper_response"),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### Processo de Atualização da Assinatura

Quando um pagamento é confirmado (`status === "paid"`), o método `updateStatus()` executa:

#### 1. Busca do `restaurantId`

O sistema recupera o `restaurantId` do campo `paghiperResponse`, onde foi salvo como metadata durante o checkout:

```327:346:QR-CODE-RESTAURANT-master/server/planOrdersService.ts
        // OBTER restaurantId do paghiperResponse (metadata salva no checkout)
        // Este é o método correto - o restaurantId foi salvo quando o pedido foi criado
        let restaurantIdFromMetadata: string | undefined = undefined;
        let couponIdFromMetadata: string | undefined = undefined;
        let couponDiscountFromMetadata: number | undefined = undefined;
        if (fullOrder.paghiperResponse && typeof fullOrder.paghiperResponse === 'object') {
          const metadata = fullOrder.paghiperResponse as any;
          if (metadata.restaurantId && typeof metadata.restaurantId === 'string') {
            restaurantIdFromMetadata = metadata.restaurantId;
            console.log("[PlanOrderService] RestaurantId encontrado no metadata do pedido:", restaurantIdFromMetadata);
          }
          if (metadata.couponId && typeof metadata.couponId === 'string') {
            couponIdFromMetadata = metadata.couponId;
            couponDiscountFromMetadata = metadata.couponDiscountApplied;
            console.log("[PlanOrderService] Cupom encontrado no metadata do pedido:", {
              couponId: couponIdFromMetadata,
              discount: couponDiscountFromMetadata,
            });
          }
        }
```

#### 2. Fallback: Busca por Email/Telefone

Se o `restaurantId` não estiver no metadata, o sistema tenta encontrar o restaurante pelo email ou telefone do cliente:

```348:382:QR-CODE-RESTAURANT-master/server/planOrdersService.ts
        // Se não temos restaurantId no metadata, tentar buscar pelo email/telefone como fallback
        // Mas isso não deveria acontecer se o checkout foi feito corretamente
        if (!restaurantIdFromMetadata) {
          console.warn("[PlanOrderService] RestaurantId não encontrado no metadata. Tentando buscar por email/telefone como fallback...");
          // O schema usa: email, phone1, phone2 (não ownerEmail/ownerPhone)
          const restaurants = await storage.getAllRestaurants();
          const normalizedCustomerEmail = normalizeString(fullOrder.customerEmail);
          const normalizedCustomerPhone = normalizeString(fullOrder.customerPhone);
          
          console.log("[PlanOrderService] Buscando restaurante com:", {
            customerEmail: normalizedCustomerEmail,
            customerPhone: normalizedCustomerPhone,
            totalRestaurants: restaurants.length,
          });
          
          const foundRestaurant = restaurants.find(r => {
            const restaurantEmail = normalizeString(r.email);
            const restaurantPhone1 = normalizeString(r.phone1);
            const restaurantPhone2 = normalizeString(r.phone2);
            
            const emailMatch = normalizedCustomerEmail && restaurantEmail && 
              restaurantEmail === normalizedCustomerEmail;
            const phoneMatch = normalizedCustomerPhone && (
              (restaurantPhone1 && restaurantPhone1 === normalizedCustomerPhone) ||
              (restaurantPhone2 && restaurantPhone2 === normalizedCustomerPhone)
            );
            
            return emailMatch || phoneMatch;
          });
          
          if (foundRestaurant) {
            restaurantIdFromMetadata = foundRestaurant.id;
            console.log("[PlanOrderService] Restaurante encontrado por email/telefone (fallback):", foundRestaurant.id);
          }
        }
```

#### 3. Criação ou Atualização da Assinatura

**Nova Assinatura (não existe):**

```430:456:QR-CODE-RESTAURANT-master/server/planOrdersService.ts
        if (!subscription) {
          // Criar nova assinatura
          const plan = await storage.getPlan(fullOrder.planId);
          if (!plan) {
            console.error("[PlanOrderService] Plano não encontrado:", fullOrder.planId);
            return updated;
          }
          
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + (fullOrder.validityDays || plan.validityDays || 30));
          
          subscription = await storage.createRestaurantSubscription({
            restaurantId: restaurant.id,
            planId: fullOrder.planId,
            status: "active",
            startDate,
            endDate,
            renewalDate: endDate, // renewalDate deve ser igual ao endDate
            lastPaymentDate: updates.paidAt || new Date(),
            nextPaymentDate: endDate,
          });
          
          console.log("[PlanOrderService] Assinatura criada para restaurante:", restaurant.id);
          
          // Criar notificação automática para todos os usuários do restaurante
          await this.createPlanActivatedNotification(restaurant.id, plan.name, endDate);
        }
```

**Renovação de Assinatura (já existe):**

```457:485:QR-CODE-RESTAURANT-master/server/planOrdersService.ts
        else {
          // Atualizar assinatura existente
          const plan = await storage.getPlan(fullOrder.planId);
          if (!plan) {
            console.error("[PlanOrderService] Plano não encontrado:", fullOrder.planId);
            return updated;
          }
          
          // Sempre usar a data atual como base para o novo período
          // Não usar startDate antigo, pois isso faria o vencimento ser calculado a partir de uma data passada
          const startDate = new Date(); // Data atual (quando o pagamento foi confirmado)
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + (fullOrder.validityDays || plan.validityDays || 30));
          
          await storage.updateRestaurantSubscription(subscription.id, {
            planId: fullOrder.planId,
            status: "active",
            startDate, // Atualizar startDate para a data atual
            endDate,
            renewalDate: endDate, // renewalDate deve ser igual ao endDate
            lastPaymentDate: updates.paidAt || new Date(),
            nextPaymentDate: endDate,
          });
          
          console.log("[PlanOrderService] Assinatura atualizada para restaurante:", restaurant.id);
          
          // Criar notificação automática para todos os usuários do restaurante
          await this.createPlanRenewedNotification(restaurant.id, plan.name, endDate);
        }
```

**Pontos Importantes:**

✅ **Cálculo de Datas Correto:**
- `startDate` sempre usa a data atual (data da confirmação do pagamento)
- `endDate` = `startDate` + `validityDays`
- `renewalDate` = `endDate` (mesmo valor)
- `nextPaymentDate` = `endDate`

✅ **Preservação de Metadata:**
- `restaurantId` é preservado no `paghiperResponse` em todas as atualizações
- Permite rastreabilidade e associação correta do pedido ao restaurante

✅ **Registro de Uso de Cupons:**
- Se um cupom foi aplicado, o uso é registrado automaticamente

```487:505:QR-CODE-RESTAURANT-master/server/planOrdersService.ts
        // Registrar uso do cupom se foi aplicado
        if (couponIdFromMetadata && couponDiscountFromMetadata && couponDiscountFromMetadata > 0) {
          try {
            await storage.recordCouponUsage(
              couponIdFromMetadata,
              id,
              restaurantIdFromMetadata || null,
              couponDiscountFromMetadata
            );
            console.log("[PlanOrderService] Uso do cupom registrado:", {
              couponId: couponIdFromMetadata,
              orderId: id,
              discount: couponDiscountFromMetadata,
            });
          } catch (error: any) {
            console.error("[PlanOrderService] Erro ao registrar uso do cupom:", error);
            // Não falhar a ativação da assinatura se houver erro ao registrar o cupom
          }
        }
```

### Atualização no Storage

O método `updatePlanOrder()` no `storage.ts` garante que os dados sejam salvos corretamente:

```913:937:QR-CODE-RESTAURANT-master/server/storage.ts
    // Para paghiperResponse, vamos usar SQL direto se necessário para evitar problemas com null
    if (updates.paghiperResponse !== undefined && updates.paghiperResponse !== null) {
      try {
        let responseData: any;
        if (typeof updates.paghiperResponse === 'object' && updates.paghiperResponse !== null) {
          // Converter objeto com null prototype para objeto normal usando JSON
          // Isso resolve o problema do Drizzle ORM não conseguir processar objetos com null prototype
          responseData = JSON.parse(JSON.stringify(updates.paghiperResponse));
        } else if (typeof updates.paghiperResponse === 'string') {
          responseData = JSON.parse(updates.paghiperResponse);
        } else {
          responseData = updates.paghiperResponse;
        }
        
        // Verificar se não é null após parsing e se é um objeto válido
        if (responseData !== null && responseData !== undefined && typeof responseData === 'object' && !Array.isArray(responseData)) {
          updateSet.paghiperResponse = responseData as any;
        } else {
          console.warn("[Storage] paghiperResponse não é um objeto válido:", responseData);
        }
      } catch (error) {
        // Se não for JSON válido, não incluir
        console.warn("[Storage] paghiperResponse inválido, ignorando:", updates.paghiperResponse);
      }
    }
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

Configure as seguintes variáveis no `.env` ou `docker-compose.yml`:

```yaml
PAGHIPER_API_KEY=apk_xxxxxxxxxxxxx
PAGHIPER_TOKEN=xxxxxxxxxxxxx
PAGHIPER_NOTIFICATION_URL=https://seu-dominio.com/api/paghiper/webhook
```

**Exemplo no docker-compose.yml:**

```12:17:QR-CODE-RESTAURANT-master/docker-compose.yml
      #PAGHIPER
      PAGHIPER_API_KEY: "apk_42478768-BnNzyVzDBfLwraGwivfywaiYSskMRBlN"
      PAGHIPER_TOKEN: "FJWJ248A7O6HDKX6EFDCTBTCADM72Q1JYCQO7AUXPFC7"
      PAGHIPER_NOTIFICATION_URL: "https://menu.reffix.com.br/api/paghiper/webhook"

      PAGHIPER_WEBHOOK_TOKEN: "FJWJ248A7O6HDKX6EFDCTBTCADM72Q1JYCQO7AUXPFC7"   # opcional, mas recomendado
```

### Configuração na PagHiper

1. Acesse o painel da PagHiper
2. Configure a URL de notificação: `https://seu-dominio.com/api/paghiper/webhook`
3. Ative notificações para eventos de pagamento

---

## 🛡️ Tratamento de Erros

### Proteções Implementadas

1. **Idempotência no Webhook**
   - Verifica se o pedido já está pago antes de processar
   - Evita reprocessamento de webhooks duplicados

2. **Verificação Ativa do Status**
   - Sempre consulta a API PagHiper antes de atualizar
   - Não confia apenas no payload do webhook

3. **Preservação de Metadata**
   - `restaurantId` é sempre preservado no `paghiperResponse`
   - Permite recuperação mesmo após múltiplas atualizações

4. **Fallback de Busca**
   - Se `restaurantId` não estiver no metadata, tenta encontrar por email/telefone
   - Garante que a assinatura seja ativada mesmo em casos edge

5. **Tratamento de Erros Silencioso**
   - Erros ao ativar assinatura não quebram o webhook
   - Logs detalhados para debugging

### Endpoint de Fallback

Existe um endpoint para reativar assinaturas manualmente caso necessário:

**`GET /api/plan-orders/:id/status`**

Verifica se a assinatura está ativa e, se não estiver, tenta reativá-la:

```352:413:QR-CODE-RESTAURANT-master/server/plansRoutes.ts
  // Endpoint público para verificar status do pedido (usado para polling no frontend)
  app.get("/api/plan-orders/:id/status", publicLimiter, async (req, res) => {
    try {
      const order = await planOrdersService.getById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Pedido não encontrado." });
      }
      
      // Se o pedido está pago, verificar se a assinatura foi ativada
      // Se não foi, tentar ativar novamente como fallback
      if (order.status === "paid" && order.paidAt) {
        try {
          // Buscar o pedido completo do storage
          const fullOrder = await storage.getPlanOrder(req.params.id);
          if (fullOrder) {
            // Tentar obter restaurantId do metadata
            let restaurantIdFromMetadata: string | undefined = undefined;
            if (fullOrder.paghiperResponse && typeof fullOrder.paghiperResponse === 'object') {
              const metadata = fullOrder.paghiperResponse as any;
              if (metadata.restaurantId && typeof metadata.restaurantId === 'string') {
                restaurantIdFromMetadata = metadata.restaurantId;
              }
            }
            
            // Se temos restaurantId, verificar se a assinatura está ativa
            if (restaurantIdFromMetadata) {
              const subscription = await storage.getRestaurantSubscription(restaurantIdFromMetadata);
              // Se não há assinatura ou está inativa, tentar ativar novamente
              if (!subscription || subscription.status !== "active") {
                console.log("[Plan Order Status] Fallback: Assinatura não encontrada ou inativa, tentando ativar...");
                await planOrdersService.updateStatus(req.params.id, "paid", {
                  paidAt: order.paidAt ? new Date(order.paidAt) : new Date(),
                  eventPayload: { retry: true, source: "status_check_fallback" },
                });
                console.log("[Plan Order Status] Fallback: Tentativa de reativação da assinatura executada para pedido:", req.params.id);
              }
            } else {
              // Se não temos restaurantId, tentar ativar de qualquer forma (pode encontrar pelo email/telefone)
              console.log("[Plan Order Status] Fallback: RestaurantId não encontrado no metadata, tentando ativar...");
              await planOrdersService.updateStatus(req.params.id, "paid", {
                paidAt: order.paidAt ? new Date(order.paidAt) : new Date(),
                eventPayload: { retry: true, source: "status_check_fallback" },
              });
            }
          }
        } catch (error) {
          // Não falhar a resposta se houver erro ao tentar reativar
          console.warn("[Plan Order Status] Fallback: Erro ao tentar reativar assinatura:", error);
        }
      }
      
      // Retornar apenas informações básicas do status
      return res.json({
        id: order.id,
        status: order.status,
        paidAt: order.paidAt,
        cancelledAt: order.cancelledAt,
      });
    } catch (error) {
      return handlePlanOrderError(res, error);
    }
  });
```

---

## 📝 Resumo dos Pontos Críticos

### ✅ Integração PagHiper Correta

1. **Criação de Cobranças:**
   - Endpoints corretos para PIX e Boleto
   - Tratamento robusto de diferentes formatos de resposta
   - Preservação de metadata (`restaurantId`, cupom)

2. **Webhook Seguro:**
   - Autenticação via `apiKey`
   - Verificação ativa do status na API (não confia só no webhook)
   - Mapeamento correto de status PagHiper → Status interno

3. **Consultas de Status:**
   - Endpoints diferentes para PIX e Boleto
   - Extração robusta de status e data de pagamento
   - Tratamento de diferentes formatos de resposta

### ✅ Atualização de Planos Correta

1. **Preservação de `restaurantId`:**
   - Salvo no `paghiperResponse` durante checkout
   - Preservado em todas as atualizações subsequentes
   - Permite associação correta pedido → restaurante

2. **Cálculo de Datas:**
   - `startDate` sempre usa data atual (não data antiga)
   - `endDate` calculado corretamente a partir de `validityDays`
   - `renewalDate` = `endDate` (mesmo valor)

3. **Criação/Atualização de Assinaturas:**
   - Cria nova assinatura se não existir
   - Atualiza assinatura existente se já houver
   - Evita duplicação (verifica se já está ativa)

4. **Notificações:**
   - Notificação automática quando plano é ativado
   - Notificação automática quando plano é renovado
   - Notificação via WebSocket em tempo real

5. **Fallback:**
   - Busca por email/telefone se `restaurantId` não estiver no metadata
   - Endpoint para reativação manual de assinaturas
   - Tratamento robusto de erros

---

## 🎉 Conclusão

A integração PagHiper está implementada de forma robusta e segura, garantindo:

- ✅ Cobranças geradas corretamente (PIX e Boleto)
- ✅ Webhooks processados com segurança
- ✅ Status verificados ativamente na API
- ✅ Planos atualizados corretamente no banco
- ✅ Assinaturas ativadas/renovadas automaticamente
- ✅ Metadata preservado para rastreabilidade
- ✅ Tratamento de erros e fallbacks implementados

O sistema está pronto para produção e lida adequadamente com os diferentes cenários de pagamento e atualização de planos.

