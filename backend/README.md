# Backend API - Plataforma Açaiteria

API REST em Node.js/Express/TypeScript para a plataforma multitenant de gestão de açaiterias.

## 🚀 Tecnologias

- **Node.js 18** + **TypeScript**
- **Express.js** - Framework web
- **PostgreSQL** - Banco de dados
- **JWT** - Autenticação
- **Zod** - Validação de dados
- **bcryptjs** - Hash de senhas

## 📦 Instalação

```bash
cd backend
npm install
```

## 🛠️ Desenvolvimento

```bash
npm run dev
```

A API estará disponível em `http://localhost:3000`

## 🏗️ Build

```bash
npm run build
npm start
```

## 📁 Estrutura

```
backend/
├── src/
│   ├── index.ts              # Entry point
│   ├── db/
│   │   └── connection.ts     # Conexão PostgreSQL
│   ├── middleware/
│   │   ├── auth.ts           # Autenticação JWT
│   │   ├── tenantGuard.ts    # Validação de tenant
│   │   └── errorHandler.ts   # Tratamento de erros
│   └── routes/
│       ├── auth.routes.ts     # Login, Register
│       ├── menu.routes.ts     # CRUD do cardápio
│       ├── order.routes.ts   # Pedidos
│       ├── transaction.routes.ts # Fluxo de caixa
│       ├── product.routes.ts # Estoque
│       ├── campaign.routes.ts # Marketing
│       ├── customer.routes.ts # Clientes
│       ├── dashboard.routes.ts # Relatórios
│       ├── settings.routes.ts # Configurações
│       └── tenant.routes.ts  # Dados do tenant
├── package.json
├── tsconfig.json
└── Dockerfile
```

## 🔌 Endpoints

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `GET /api/auth/me` - Usuário atual

### Cardápio
- `GET /api/menu/items` - Listar itens
- `GET /api/menu/items/:id` - Buscar item
- `POST /api/menu/items` - Criar item
- `PUT /api/menu/items/:id` - Atualizar item
- `DELETE /api/menu/items/:id` - Deletar item

### Pedidos
- `GET /api/orders` - Listar pedidos
- `POST /api/orders` - Criar pedido
- `PATCH /api/orders/:id/status` - Atualizar status

### Transações
- `GET /api/transactions` - Listar transações
- `POST /api/transactions` - Criar transação
- `DELETE /api/transactions/:id` - Deletar transação

### Produtos (Estoque)
- `GET /api/products` - Listar produtos
- `POST /api/products` - Criar produto
- `PUT /api/products/:id` - Atualizar produto
- `DELETE /api/products/:id` - Deletar produto

### Campanhas
- `GET /api/campaigns` - Listar campanhas
- `POST /api/campaigns` - Criar campanha
- `PUT /api/campaigns/:id` - Atualizar campanha
- `DELETE /api/campaigns/:id` - Deletar campanha

### Dashboard
- `GET /api/dashboard/financial-summary` - Resumo financeiro
- `GET /api/dashboard/top-products` - Produtos mais vendidos
- `GET /api/dashboard/sales-chart` - Gráfico de vendas

### Configurações
- `GET /api/settings/company` - Configurações da empresa
- `POST /api/settings/company` - Salvar configurações
- `GET /api/settings/operating-hours` - Horários de funcionamento
- `POST /api/settings/operating-hours` - Salvar horários

## 🔒 Autenticação

Todas as rotas (exceto `/api/auth/login`, `/api/auth/register` e `/api/tenants/slug/:slug`) requerem autenticação via JWT:

```
Authorization: Bearer <token>
```

## 🌐 Variáveis de Ambiente

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://usuario:senha@host:5432/banco
JWT_SECRET=your-secret-key-change-in-production
FRONTEND_URL=https://acaiteria.example.com
```

## 🐳 Docker

```bash
# Build
docker build -t acaiteria-backend:latest ./backend

# Run
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=... \
  acaiteria-backend:latest
```


