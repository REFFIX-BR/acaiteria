-- ============================================
-- SCHEMA DO BANCO DE DADOS - PLATAFORMA AÇAITERIA
-- Sistema Multitenant para Gestão de Açaiterias
-- ============================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para busca de texto

-- ============================================
-- TABELAS PRINCIPAIS
-- ============================================

-- Tenants (Açaiterias)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    logo TEXT,
    primary_color VARCHAR(7) NOT NULL DEFAULT '#8b5cf6',
    secondary_color VARCHAR(7) NOT NULL DEFAULT '#ec4899',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT tenants_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX idx_tenants_slug ON tenants(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_created_at ON tenants(created_at);

-- Usuários
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'user')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role, tenant_id) WHERE deleted_at IS NULL;

-- Configurações da Empresa
CREATE TABLE company_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    trade_name VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20),
    cnpj VARCHAR(18),
    admin_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_company_settings_tenant_id ON company_settings(tenant_id);

-- Horários de Funcionamento
CREATE TABLE operating_hours (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    day VARCHAR(50) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, day)
);

CREATE INDEX idx_operating_hours_tenant_id ON operating_hours(tenant_id);

-- Produtos/Ingredientes (Estoque)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    current_stock DECIMAL(10, 2) NOT NULL DEFAULT 0,
    min_stock DECIMAL(10, 2) NOT NULL DEFAULT 0,
    unit VARCHAR(50) NOT NULL DEFAULT 'unidade',
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_products_tenant_id ON products(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category ON products(tenant_id, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_low_stock ON products(tenant_id) WHERE current_stock <= min_stock AND deleted_at IS NULL;

-- Transações Financeiras (Fluxo de Caixa)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_transactions_tenant_id ON transactions(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_date ON transactions(tenant_id, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_type ON transactions(tenant_id, type, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_category ON transactions(tenant_id, category) WHERE deleted_at IS NULL;

-- Assinaturas
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('trial', 'basic', 'premium', 'enterprise')),
    trial_start_date DATE NOT NULL,
    trial_end_date DATE NOT NULL,
    subscription_start_date DATE,
    subscription_end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_trial BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_active ON subscriptions(tenant_id, is_active) WHERE is_active = true;

-- Pedidos de Planos (Plan Orders)
CREATE TABLE plan_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('basic', 'premium', 'enterprise')),
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_document TEXT,
    customer_phone TEXT,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('pix', 'boleto')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'expired', 'failed')),
    amount DECIMAL(10, 2) NOT NULL,
    validity_days INTEGER NOT NULL DEFAULT 30,
    paghiper_order_id TEXT,
    paghiper_transaction_id TEXT,
    paghiper_response JSONB,
    due_date TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_plan_orders_tenant_id ON plan_orders(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_plan_orders_status ON plan_orders(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_plan_orders_transaction_id ON plan_orders(paghiper_transaction_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_plan_orders_created_at ON plan_orders(tenant_id, created_at DESC) WHERE deleted_at IS NULL;

-- Itens do Cardápio
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 2) NOT NULL,
    image TEXT,
    category VARCHAR(100) NOT NULL,
    available BOOLEAN NOT NULL DEFAULT true,
    max_additions INTEGER, -- Limite de coberturas (NULL = sem limite)
    max_complements INTEGER, -- Limite de complementos (NULL = sem limite)
    max_fruits INTEGER, -- Limite de frutas (NULL = sem limite)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_menu_items_tenant_id ON menu_items(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_menu_items_category ON menu_items(tenant_id, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_menu_items_available ON menu_items(tenant_id, available) WHERE deleted_at IS NULL;

-- Tamanhos de Produtos
CREATE TABLE menu_item_sizes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(menu_item_id, name)
);

CREATE INDEX idx_menu_item_sizes_menu_item_id ON menu_item_sizes(menu_item_id);

-- Adicionais de Produtos
CREATE TABLE menu_item_additions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_item_additions_menu_item_id ON menu_item_additions(menu_item_id);

-- Complementos de Produtos
CREATE TABLE menu_item_complements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_item_complements_menu_item_id ON menu_item_complements(menu_item_id);

-- Frutas de Produtos
CREATE TABLE menu_item_fruits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_item_fruits_menu_item_id ON menu_item_fruits(menu_item_id);

-- Campanhas de Marketing
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('promotion', 'whatsapp')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    description TEXT,
    discount DECIMAL(5, 2),
    start_date DATE NOT NULL,
    end_date DATE,
    sent INTEGER NOT NULL DEFAULT 0,
    delivered INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_campaigns_tenant_id ON campaigns(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_type ON campaigns(tenant_id, type) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_status ON campaigns(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_dates ON campaigns(tenant_id, start_date, end_date) WHERE deleted_at IS NULL;

-- Clientes/Leads
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(tenant_id, phone)
);

CREATE INDEX idx_customers_tenant_id ON customers(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_phone ON customers(tenant_id, phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_email ON customers(tenant_id, email) WHERE deleted_at IS NULL;

-- Configurações WhatsApp
CREATE TABLE whatsapp_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    api_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    instance_name VARCHAR(255),
    connected BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_configs_tenant_id ON whatsapp_configs(tenant_id);

-- Histórico de Envios WhatsApp
CREATE TABLE whatsapp_sends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_sends_tenant_id ON whatsapp_sends(tenant_id);
CREATE INDEX idx_whatsapp_sends_campaign_id ON whatsapp_sends(campaign_id);
CREATE INDEX idx_whatsapp_sends_customer_id ON whatsapp_sends(customer_id);
CREATE INDEX idx_whatsapp_sends_status ON whatsapp_sends(tenant_id, status);
CREATE INDEX idx_whatsapp_sends_created_at ON whatsapp_sends(tenant_id, created_at DESC);

-- Pedidos
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(255),
    subtotal DECIMAL(10, 2) NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled')),
    payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'card', 'pix', 'other')),
    delivery_type VARCHAR(20) NOT NULL CHECK (delivery_type IN ('pickup', 'delivery')),
    delivery_address TEXT,
    notes TEXT,
    source VARCHAR(20) NOT NULL DEFAULT 'digital' CHECK (source IN ('digital', 'counter')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    ready_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_orders_tenant_id ON orders(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_status ON orders(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_date ON orders(tenant_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_customer ON orders(tenant_id, customer_phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_source ON orders(tenant_id, source) WHERE deleted_at IS NULL;

-- Itens do Pedido
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
    menu_item_name VARCHAR(255) NOT NULL,
    size VARCHAR(50),
    additions TEXT[], -- Array de nomes de coberturas
    complements TEXT[], -- Array de nomes de complementos
    fruits TEXT[], -- Array de nomes de frutas
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_menu_item_id ON order_items(menu_item_id);

-- ============================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger em todas as tabelas com updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON company_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operating_hours_updated_at BEFORE UPDATE ON operating_hours
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_configs_updated_at BEFORE UPDATE ON whatsapp_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS ÚTEIS
-- ============================================

-- View para resumo financeiro por tenant
CREATE OR REPLACE VIEW financial_summary AS
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    COALESCE(SUM(CASE WHEN tr.type = 'income' THEN tr.amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN tr.type = 'expense' THEN tr.amount ELSE 0 END), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN tr.type = 'income' THEN tr.amount ELSE -tr.amount END), 0) as profit,
    COUNT(CASE WHEN tr.type = 'income' THEN 1 END) as income_count,
    COUNT(CASE WHEN tr.type = 'expense' THEN 1 END) as expense_count
FROM tenants t
LEFT JOIN transactions tr ON t.id = tr.tenant_id AND tr.deleted_at IS NULL
WHERE t.deleted_at IS NULL
GROUP BY t.id, t.name;

-- View para produtos com estoque baixo
CREATE OR REPLACE VIEW low_stock_products AS
SELECT 
    p.id,
    p.tenant_id,
    t.name as tenant_name,
    p.name,
    p.category,
    p.current_stock,
    p.min_stock,
    p.unit,
    (p.min_stock - p.current_stock) as stock_needed
FROM products p
JOIN tenants t ON p.tenant_id = t.id
WHERE p.current_stock <= p.min_stock 
    AND p.deleted_at IS NULL 
    AND t.deleted_at IS NULL;

-- View para campanhas ativas
CREATE OR REPLACE VIEW active_campaigns AS
SELECT 
    c.id,
    c.tenant_id,
    t.name as tenant_name,
    c.name,
    c.type,
    c.status,
    c.start_date,
    c.end_date,
    c.sent,
    c.delivered,
    c.failed,
    CASE 
        WHEN c.delivered > 0 THEN ROUND((c.delivered::DECIMAL / c.sent::DECIMAL) * 100, 2)
        ELSE 0
    END as delivery_rate
FROM campaigns c
JOIN tenants t ON c.tenant_id = t.id
WHERE c.status = 'active' 
    AND c.deleted_at IS NULL 
    AND t.deleted_at IS NULL
    AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE);

-- View para resumo de pedidos por tenant
CREATE OR REPLACE VIEW orders_summary AS
SELECT 
    o.tenant_id,
    t.name as tenant_name,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
    COUNT(CASE WHEN o.status = 'accepted' THEN 1 END) as accepted_orders,
    COUNT(CASE WHEN o.status = 'preparing' THEN 1 END) as preparing_orders,
    COUNT(CASE WHEN o.status = 'ready' THEN 1 END) as ready_orders,
    COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as delivered_orders,
    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders,
    COUNT(CASE WHEN o.source = 'digital' THEN 1 END) as digital_orders,
    COUNT(CASE WHEN o.source = 'counter' THEN 1 END) as counter_orders,
    COALESCE(SUM(o.total), 0) as total_revenue,
    COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total ELSE 0 END), 0) as delivered_revenue,
    COALESCE(AVG(o.total), 0) as average_order_value
FROM orders o
JOIN tenants t ON o.tenant_id = t.id
WHERE o.deleted_at IS NULL AND t.deleted_at IS NULL
GROUP BY o.tenant_id, t.name;

-- View para produtos mais vendidos
CREATE OR REPLACE VIEW top_selling_products AS
SELECT 
    oi.menu_item_id,
    mi.tenant_id,
    mi.name as product_name,
    mi.category,
    SUM(oi.quantity) as total_quantity_sold,
    COUNT(DISTINCT oi.order_id) as total_orders,
    SUM(oi.total_price) as total_revenue
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
JOIN menu_items mi ON oi.menu_item_id = mi.id
WHERE o.status = 'delivered' 
    AND o.deleted_at IS NULL 
    AND mi.deleted_at IS NULL
GROUP BY oi.menu_item_id, mi.tenant_id, mi.name, mi.category
ORDER BY total_quantity_sold DESC;

-- ============================================
-- FUNÇÕES ÚTEIS
-- ============================================

-- Função para calcular faturamento do dia
CREATE OR REPLACE FUNCTION get_daily_revenue(p_tenant_id UUID, p_date DATE)
RETURNS DECIMAL(10, 2) AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(amount) 
         FROM transactions 
         WHERE tenant_id = p_tenant_id 
           AND type = 'income' 
           AND date = p_date 
           AND deleted_at IS NULL),
        0
    );
END;
$$ LANGUAGE plpgsql;

-- Função para calcular faturamento do mês
CREATE OR REPLACE FUNCTION get_monthly_revenue(p_tenant_id UUID, p_year INTEGER, p_month INTEGER)
RETURNS DECIMAL(10, 2) AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(amount) 
         FROM transactions 
         WHERE tenant_id = p_tenant_id 
           AND type = 'income' 
           AND EXTRACT(YEAR FROM date) = p_year
           AND EXTRACT(MONTH FROM date) = p_month
           AND deleted_at IS NULL),
        0
    );
END;
$$ LANGUAGE plpgsql;

-- Função para verificar se slug está disponível
CREATE OR REPLACE FUNCTION is_slug_available(p_slug VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 
        FROM tenants 
        WHERE slug = p_slug 
          AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMENTÁRIOS NAS TABELAS
-- ============================================

COMMENT ON TABLE tenants IS 'Açaiterias cadastradas na plataforma';
COMMENT ON TABLE users IS 'Usuários do sistema (dono, admin, funcionário)';
COMMENT ON TABLE company_settings IS 'Configurações da empresa (CNPJ, telefone, etc)';
COMMENT ON TABLE operating_hours IS 'Horários de funcionamento por dia da semana';
COMMENT ON TABLE products IS 'Produtos e ingredientes do estoque';
COMMENT ON TABLE transactions IS 'Transações financeiras (entradas e saídas)';
COMMENT ON TABLE menu_items IS 'Itens do cardápio digital';
COMMENT ON TABLE campaigns IS 'Campanhas de marketing e WhatsApp';
COMMENT ON TABLE customers IS 'Clientes e leads capturados';
COMMENT ON TABLE whatsapp_configs IS 'Configurações de integração WhatsApp';
COMMENT ON TABLE whatsapp_sends IS 'Histórico de envios via WhatsApp';
COMMENT ON TABLE subscriptions IS 'Assinaturas e planos dos tenants';
COMMENT ON TABLE menu_item_fruits IS 'Frutas disponíveis para cada item do cardápio';
COMMENT ON TABLE orders IS 'Pedidos dos clientes';
COMMENT ON TABLE order_items IS 'Itens de cada pedido';

