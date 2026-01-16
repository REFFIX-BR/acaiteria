# Criação e Conexão de Instâncias WhatsApp

Este documento descreve em detalhes como funciona o processo de criação e conexão de instâncias WhatsApp no sistema, desde a requisição do usuário até a conexão final.

## Visão Geral do Fluxo

O processo de conexão do WhatsApp envolve os seguintes passos principais:

1. **Solicitação do Usuário** (Frontend)
2. **Criação da Instância** (Backend → Evolution API Manager)
3. **Obtenção do Código de Conexão** (QR Code ou Pairing Code)
4. **Monitoramento da Conexão** (Polling)
5. **Confirmação de Conexão**

## Componentes Envolvidos

### Frontend
- **Página**: `client/src/pages/admin/whatsapp.tsx`
- **Hook**: `client/src/hooks/use-whatsapp-connection.ts`
- **Componente de Tutorial**: `client/src/components/whatsapp/WhatsAppTutorial.tsx`

### Backend
- **Rotas**: `server/routes.ts` (endpoints `/api/whatsapp/instances/*`)
- **Manager**: `server/whatsapp-instance.ts` (classe `WhatsAppInstanceManager`)

### Evolution API Manager
- **URL**: Configurada via `EVOLUTION_API_URL` (ex: `https://manager.reffix.com.br/api`)
- **Autenticação**: Email/Password ou API Key

## Métodos de Conexão

O sistema oferece duas formas de conectar o WhatsApp:

### 1. QR Code (Recomendado)

**Vantagens:**
- ✅ Instantâneo
- ✅ Mais fácil de usar
- ✅ Não requer digitar número

**Fluxo:**
```
Usuário → Clica "Gerar QR Code" 
→ Backend cria instância na Evolution API 
→ Backend obtém QR Code 
→ Frontend exibe QR Code 
→ Usuário escaneia com WhatsApp 
→ Sistema detecta conexão
```

### 2. Pairing Code

**Vantagens:**
- ✅ Útil quando não há câmera disponível
- ✅ Permite escolher o número antes

**Fluxo:**
```
Usuário → Digita número → Clica "Gerar Pairing Code" 
→ Backend valida número 
→ Backend cria instância com número 
→ Backend obtém Pairing Code (8 dígitos) 
→ Frontend exibe código formatado (XXXX-XXXX) 
→ Usuário digita código no WhatsApp 
→ Sistema detecta conexão
```

## Processo Detalhado

### Passo 1: Solicitação do Frontend

#### Via QR Code

```typescript
// client/src/hooks/use-whatsapp-connection.ts
const createWithQRCode = useMutation({
  mutationFn: async () => {
    const instanceName = normalizeInstanceName(restaurant.name);
    const response = await fetch('/api/whatsapp/instances/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceName,
        useQRCode: true
      })
    });
    return await response.json();
  }
});
```

#### Via Pairing Code

```typescript
const connectWithPairingCode = useMutation({
  mutationFn: async (phoneNumber: string) => {
    const response = await fetch('/api/whatsapp/instances/connect-pairing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber })
    });
    return await response.json();
  }
});
```

### Passo 2: Geração do Nome da Instância

O nome da instância é gerado a partir do nome do restaurante:

```typescript
function normalizeInstanceName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')                    // Normaliza Unicode
    .replace(/[\u0300-\u036f]/g, '')     // Remove acentos
    .replace(/[^a-z0-9]/g, '-')          // Substitui especiais por hífen
    .replace(/-+/g, '-')                 // Remove múltiplos hífens
    .replace(/^-|-$/g, '');              // Remove hífens nas pontas
}
```

**Exemplos:**
- `"Restaurante São Paulo"` → `"restaurante-sao-paulo"`
- `"Café & Cia"` → `"cafe-cia"`
- `"Churrascaria do João"` → `"churrascaria-do-joao"`

### Passo 3: Processamento no Backend

#### Endpoint: `POST /api/whatsapp/instances/create`

**Fluxo interno:**

1. **Validação de Autenticação**
   ```typescript
   const restaurantId = req.session.restaurantId;
   if (!restaurantId) {
     return res.status(401).json({ error: "Unauthorized" });
   }
   ```

2. **Verificação de Instância Existente**
   ```typescript
   const existingInstance = await storage.getWhatsAppInstanceByRestaurant(restaurantId);
   if (existingInstance) {
     // Verifica se ainda existe na Evolution API
     // Se não existir, remove do banco e permite criar nova
   }
   ```

3. **Criação na Evolution API**

   **Para QR Code:**
   ```typescript
   await WhatsAppInstanceManager.createInstance({
     instanceName,
     qrcode: true,
     integration: 'WHATSAPP-BAILEYS'
   });
   ```

   **Para Pairing Code:**
   ```typescript
   await WhatsAppInstanceManager.connectWithPairingCode(
     instanceName,
     validatedPhoneNumber
   );
   ```

### Passo 4: Autenticação no Manager

O `WhatsAppInstanceManager` utiliza duas estratégias de autenticação:

#### Estratégia 1: API Key (Prioritária)
```typescript
if (apiKey) {
  return apiKey; // Usa diretamente como token
}
```

#### Estratégia 2: Login com Email/Password
```typescript
const loginResponse = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: managerEmail,
    password: managerPassword,
  }),
});
const token = loginData?.data?.token || loginData?.token;
```

**Endpoints testados (fallback automático):**
- `{managerUrl}/auth/login`
- `{managerUrl}/api/auth/login`
- `{managerUrl}/api/v1/auth/login`
- `{managerUrl}/manager/auth/login`
- `{managerUrl}/public/auth/login`

### Passo 5: Criação da Instância na Evolution API

```typescript
// server/whatsapp-instance.ts
static async createInstance(payload: CreateInstancePayload): Promise<any> {
  const headers = await this.buildAuthHeaders();
  const createPayload = {
    name: payload.instanceName,
    integration: payload.integration || 'WHATSAPP-BAILEYS'
  };
  
  if (payload.number) {
    createPayload.number = payload.number;
  }
  
  if (payload.qrcode) {
    createPayload.qrcode = true;
  }
  
  // Tenta múltiplos endpoints (fallback automático)
  const endpoints = [
    `${this.apiUrl}/instance/create`,
    `${this.managerUrl}/instances/create`,
    `${this.managerUrl}/instance/create`,
  ];
  
  // ... faz requisição para cada endpoint até sucesso
}
```

### Passo 6: Obtenção do Código de Conexão

#### Para QR Code

Após criar a instância, o sistema aguarda 3 segundos e então busca o QR Code:

```typescript
await new Promise(resolve => setTimeout(resolve, 3000));

const codeData = await WhatsAppInstanceManager.getConnectionCode(instanceName);

if (codeData.qrcode) {
  connectionCode = codeData.qrcode; // Data URL (data:image/png;base64,...)
} else if (codeData.pairingCode) {
  // Se veio pairing code em vez de QR code, gera QR code a partir dele
  const qrCodeDataUrl = await QRCode.toDataURL(codeData.pairingCode, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: 300,
    margin: 2
  });
  connectionCode = qrCodeDataUrl;
}
```

#### Para Pairing Code

O método `connectWithPairingCode` já faz tudo em uma única chamada:

```typescript
static async connectWithPairingCode(
  instanceName: string, 
  phoneNumber: string
): Promise<{ pairingCode: string }> {
  // 1. Valida o número
  const validation = this.validateBrazilianPhone(phoneNumber);
  
  // 2. Cria a instância
  await this.createInstance({
    instanceName,
    qrcode: false,
    number: validation.formatted,
    integration: 'WHATSAPP-BAILEYS',
  });
  
  // 3. Aguarda 5 segundos para instância estar pronta
  await new Promise((resolve) => setTimeout(resolve, 5000));
  
  // 4. Obtém o pairing code
  const codeData = await this.getConnectionCode(instanceName);
  
  // 5. Formata o código (XXXX-XXXX)
  const formattedPairing = this.formatPairingCodeSimple(rawPairing);
  
  return { pairingCode: formattedPairing };
}
```

### Passo 7: Validação de Número Brasileiro

```typescript
static validateBrazilianPhone(phone: string): { 
  valid: boolean; 
  formatted?: string; 
  error?: string 
} {
  // Remove caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');
  
  // Adiciona código do país se necessário
  if (!cleaned.startsWith('55')) {
    if (cleaned.length === 10 || cleaned.length === 11) {
      formatted = `55${cleaned}`;
    }
  }
  
  // Valida tamanho final (12-13 dígitos)
  if (formatted.length < 12 || formatted.length > 13) {
    return { valid: false, error: 'Número deve ter entre 12 e 13 dígitos' };
  }
  
  return { valid: true, formatted };
}
```

**Exemplos de validação:**
- `"11999999999"` → `"5511999999999"` ✅
- `"1199999999"` → `"551199999999"` ✅ (fixo)
- `"5511999999999"` → Mantém como está ✅
- `"11999-99999"` → Remove hífen → `"5511999999999"` ✅

### Passo 8: Persistência no Banco de Dados

Após criar a instância na Evolution API, ela é salva no banco:

```typescript
const instance = await storage.createWhatsAppInstance({
  restaurantId,
  instanceName,
  phoneNumber: phoneNumber || null,
  status: 'created',
  integration: 'WHATSAPP-BAILEYS'
});
```

**Estrutura da tabela `whatsapp_instances`:**
```sql
{
  id: string (UUID)
  restaurantId: string (FK)
  instanceName: string (único por restaurante)
  phoneNumber: string | null
  status: 'created' | 'connected' | 'disconnected'
  integration: 'WHATSAPP-BAILEYS'
  createdAt: Date
  updatedAt: Date
}
```

### Passo 9: Retorno ao Frontend

O backend retorna:

```json
{
  "success": true,
  "instance": {
    "id": "...",
    "instanceName": "restaurante-exemplo",
    "status": "created",
    ...
  },
  "qrcode": "data:image/png;base64,..." // ou null para pairing code
  "pairingCode": "1234-5678" // ou null para QR code
}
```

### Passo 10: Exibição no Frontend

O hook `useWhatsAppConnection` processa a resposta:

```typescript
onSuccess: async (data) => {
  const qrcode = data.qrcode || null;
  const pairingCode = data.pairingCode || null;
  
  if (qrcode) {
    setState({ status: 'waiting', qrcode });
    startMonitoring(instanceName);
  } else if (pairingCode) {
    setState({ status: 'waiting', pairingCode });
    startMonitoring(instanceName);
  }
}
```

### Passo 11: Monitoramento da Conexão

O sistema inicia um polling automático para verificar quando o WhatsApp é conectado:

```typescript
const startMonitoring = useCallback((instanceName: string) => {
  const checkConnection = setInterval(async () => {
    const response = await fetch(`/api/whatsapp/instances/${instanceName}/status`);
    const data = await response.json();
    
    if (data.isConnected || data.status === 'connected') {
      clearInterval(checkConnection);
      setState({ status: 'connected' });
      toast({ title: 'Conectado!', description: 'WhatsApp conectado com sucesso' });
    }
  }, 5000); // Verifica a cada 5 segundos
  
  // Timeout após 5 minutos
  setTimeout(() => {
    clearInterval(checkConnection);
    setState({ status: 'error', error: 'Tempo de conexão expirado' });
  }, 300000);
}, []);
```

**Fluxo de monitoramento:**
```
A cada 5 segundos → GET /api/whatsapp/instances/:name/status
→ Backend verifica status na Evolution API
→ Se conectado → Para polling e atualiza estado
→ Se timeout (5 min) → Para polling e mostra erro
```

## Endpoints da API

### Criar Instância (QR Code)
```
POST /api/whatsapp/instances/create
Body: {
  instanceName?: string,
  useQRCode: true
}
Response: {
  success: boolean,
  instance: {...},
  qrcode: string | null
}
```

### Criar Instância (Pairing Code)
```
POST /api/whatsapp/instances/connect-pairing
Body: {
  phoneNumber: string
}
Response: {
  success: boolean,
  instance: {...},
  pairingCode: string
}
```

### Obter Código de Conexão
```
GET /api/whatsapp/instances/:instanceName/connect
Response: {
  qrcode?: string,
  pairingCode?: string
}
```

### Verificar Status
```
GET /api/whatsapp/instances/:instanceName/status
Response: {
  isConnected: boolean,
  status: 'connected' | 'disconnected' | 'connecting',
  fromCache?: boolean
}
```

## Estados da Conexão

O sistema utiliza os seguintes estados:

| Estado | Descrição | Quando Ocorre |
|--------|-----------|---------------|
| `disconnected` | Sem conexão | Estado inicial ou após desconexão |
| `generating` | Gerando código | Processando criação da instância |
| `waiting` | Aguardando conexão | QR Code/Pairing Code exibido, aguardando usuário |
| `connected` | Conectado | WhatsApp conectado com sucesso |
| `error` | Erro | Falha na conexão ou timeout |

## Tratamento de Erros

### Conflito de Instância Existente

Se já existe uma instância:

1. **Verifica se existe na Evolution API**
   ```typescript
   try {
     await WhatsAppInstanceManager.getConnectionState(existingInstance.instanceName);
     // Se existe, retorna erro 409
     return res.status(409).json({ error: "Já existe uma instância..." });
   } catch {
     // Se não existe, remove do banco e permite criar nova
     await storage.deleteWhatsAppInstance(existingInstance.id);
   }
   ```

2. **Retry automático em caso de 409**
   ```typescript
   if (error.message?.includes('Conflict') || error.message?.includes('409')) {
     // Deleta instância existente e tenta criar novamente
     await WhatsAppInstanceManager.deleteInstance(instanceName);
     await new Promise(resolve => setTimeout(resolve, 2000));
     return await WhatsAppInstanceManager.createInstance({...});
   }
   ```

### Fallback de Endpoints

Para cada operação, o sistema tenta múltiplos endpoints:

**Criação:**
1. `/instance/create`
2. `/instances/create`
3. `/api/instance/create`

**Conexão:**
1. `/instance/connect/:name`
2. `/instances/connect/:name`
3. `/api/instance/connect/:name`

**Status:**
1. `/instance/fetchInstances/:name`
2. `/instances/:name`
3. `/instances/status/:name`
4. Listagem completa e busca

## Cancelamento de Conexão

O usuário pode cancelar uma conexão em andamento:

```typescript
const cancelConnection = useCallback(() => {
  // Limpa intervalos de monitoramento
  clearInterval(monitoringIntervalRef.current);
  clearTimeout(monitoringTimeoutRef.current);
  
  // Marca como cancelado manualmente (persistido no localStorage)
  setCancelledFlag(true);
  
  // Reseta estado
  setState({ status: 'disconnected' });
}, []);
```

**Comportamento:**
- O flag de cancelamento é salvo no `localStorage`
- O sistema não restaura automaticamente estados "waiting" se foi cancelado
- Usuário precisa iniciar nova conexão manualmente

## Reconexão de Instância Existente

Se uma instância já foi criada mas está desconectada, o usuário pode reconectar:

```typescript
const connectInstance = useMutation({
  mutationFn: async (instanceName: string) => {
    // Obtém novo código de conexão
    const response = await fetch(`/api/whatsapp/instances/${instanceName}/connect`);
    const data = await response.json();
    return { qrcode: data.qrcode, pairingCode: data.pairingCode };
  }
});
```

**Diferenças:**
- Não cria nova instância (já existe)
- Apenas obtém novo código de conexão
- Reutiliza a mesma instância na Evolution API

## Exemplos Práticos

### Exemplo 1: Conexão via QR Code

```typescript
// Frontend
const { createWithQRCode } = useWhatsAppConnection();
createWithQRCode();

// Backend processa:
// 1. Cria instância "restaurante-exemplo" na Evolution
// 2. Aguarda 3 segundos
// 3. Obtém QR Code
// 4. Salva no banco
// 5. Retorna QR Code

// Frontend exibe QR Code e inicia monitoramento
// Usuário escaneia → Sistema detecta conexão em ~5-10 segundos
```

### Exemplo 2: Conexão via Pairing Code

```typescript
// Frontend
const { connectWithPairingCode } = useWhatsAppConnection();
connectWithPairingCode("11999999999");

// Backend processa:
// 1. Valida número → "5511999999999"
// 2. Cria instância com número na Evolution
// 3. Aguarda 5 segundos
// 4. Obtém pairing code → "A1B2-C3D4"
// 5. Formata → "A1B2-C3D4"
// 6. Salva no banco
// 7. Retorna pairing code

// Frontend exibe código formatado
// Usuário digita no WhatsApp → Sistema detecta conexão em ~5-10 segundos
```

## Configuração Necessária

### Variáveis de Ambiente

```yaml
# docker-compose.yml
EVOLUTION_API_URL: https://manager.reffix.com.br/api
MANAGER_EMAIL: contato.reffix@gmail.com
MANAGER_PASSWORD: ManagerCriadocompuc0
EVOLUTION_API_GLOBAL_KEY: "15c88ebc2e37f86d00e5ddeed"  # Opcional
```

### Dependências

```json
{
  "qrcode": "^1.5.3",  // Para gerar QR Code a partir de pairing code
  "fetch": "nativo"     // Para requisições HTTP
}
```

## Logs e Debug

O sistema inclui logs detalhados em todas as etapas:

```typescript
console.log('[WhatsApp] Tentando criar instância:', {
  url: endpoint,
  payload: createPayload,
  usingApiKey: !!this.apiKey,
});

console.log('[WhatsApp] QR Code obtido diretamente');
console.log('[WhatsApp] Pairing code obtido, gerando QR Code...');
```

**Para debug, verifique:**
- Console do navegador (Frontend)
- Logs do servidor (Backend)
- Network tab (Requisições HTTP)

## Limitações e Considerações

1. **Timeout de Conexão**: 5 minutos para escanear/digitar código
2. **Intervalo de Polling**: 5 segundos entre verificações de status
3. **Aguardo após Criação**: 3-5 segundos antes de buscar código
4. **Única Instância**: Um restaurante pode ter apenas uma instância ativa
5. **Número de Telefone**: Deve ser válido e formato brasileiro

## Próximos Passos

Após conectar com sucesso, o usuário pode:
- Enviar campanhas de marketing
- Ver status da conexão
- Desconectar ou excluir a instância
- Reconectar se necessário

---

**Última atualização:** Janeiro 2025  
**Versão:** 1.0.0

