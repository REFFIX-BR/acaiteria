# Schema do Banco de Dados - Plataforma Açaiteria

Este diretório contém o schema completo do banco de dados PostgreSQL para a plataforma multitenant de gestão de açaiterias.

## 📋 Estrutura

### Arquivos
- `schema.sql` - Schema completo do banco de dados

## 🗄️ Tabelas Principais

### Core
- **tenants** - Açaiterias cadastradas
- **users** - Usuários do sistema (owner, admin, user)
- **company_settings** - Configurações da empresa
- **operating_hours** - Horários de funcionamento

### Gestão
- **products** - Produtos e ingredientes (estoque)
- **transactions** - Transações financeiras (fluxo de caixa)
- **menu_items** - Itens do cardápio digital
- **menu_item_sizes** - Tamanhos dos produtos
- **menu_item_additions** - Coberturas dos produtos
- **menu_item_complements** - Complementos dos produtos
- **menu_item_fruits** - Frutas dos produtos
- **orders** - Pedidos dos clientes
- **order_items** - Itens de cada pedido

### Assinaturas
- **subscriptions** - Planos e assinaturas dos tenants

### Marketing
- **campaigns** - Campanhas de marketing
- **customers** - Clientes e leads
- **whatsapp_configs** - Configurações WhatsApp
- **whatsapp_sends** - Histórico de envios WhatsApp

## 🔑 Características

### Multitenancy
- Todas as tabelas principais possuem `tenant_id` para isolamento de dados
- Índices otimizados por tenant
- Soft delete com `deleted_at` para manter histórico

### Segurança
- UUIDs como chaves primárias
- Constraints de validação
- Índices para performance
- Triggers automáticos para `updated_at`

### Performance
- Índices em colunas frequentemente consultadas
- Índices compostos para queries complexas
- Views materializadas para relatórios

## 🚀 Como Usar

### Criar o banco de dados

```bash
# Criar banco
createdb acaiteria_platform

# Executar schema
psql acaiteria_platform < database/schema.sql
```

### Ou via Docker

```bash
docker run --name acaiteria-db \
  -e POSTGRES_PASSWORD=senha \
  -e POSTGRES_DB=acaiteria_platform \
  -p 5432:5432 \
  -d postgres:15

psql -h localhost -U postgres -d acaiteria_platform < database/schema.sql
```

## 📊 Views Disponíveis

- **financial_summary** - Resumo financeiro por tenant
- **low_stock_products** - Produtos com estoque baixo
- **active_campaigns** - Campanhas ativas
- **orders_summary** - Resumo de pedidos por tenant
- **top_selling_products** - Produtos mais vendidos

## 🔧 Funções Úteis

- `get_daily_revenue(tenant_id, date)` - Faturamento do dia
- `get_monthly_revenue(tenant_id, year, month)` - Faturamento do mês
- `is_slug_available(slug)` - Verifica disponibilidade de slug

## 📝 Notas

- Todas as datas usam `TIMESTAMP WITH TIME ZONE`
- Valores monetários usam `DECIMAL(10, 2)`
- Soft delete implementado com `deleted_at`
- Triggers automáticos para `updated_at`

## 🔄 Migrations

Para futuras alterações no schema, criar arquivos de migration seguindo o padrão:
- `migrations/001_initial_schema.sql`
- `migrations/002_add_feature.sql`
- etc.

