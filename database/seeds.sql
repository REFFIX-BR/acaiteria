-- ============================================
-- SEEDS - DADOS DE EXEMPLO
-- Para desenvolvimento e testes
-- ============================================

-- Limpar dados existentes (CUIDADO: apenas para desenvolvimento)
-- TRUNCATE TABLE whatsapp_sends, whatsapp_configs, customers, campaigns, 
--   menu_item_complements, menu_item_additions, menu_item_sizes, menu_items,
--   transactions, products, operating_hours, company_settings, users, tenants CASCADE;

-- ============================================
-- TENANT DE EXEMPLO
-- ============================================

INSERT INTO tenants (id, name, slug, primary_color, secondary_color) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Açaí Bom Sabor', 'acai-bom-sabor', '#8b5cf6', '#ec4899'),
('550e8400-e29b-41d4-a716-446655440001', 'Açaí Premium', 'acai-premium', '#3b82f6', '#06b6d4');

-- ============================================
-- USUÁRIOS DE EXEMPLO
-- ============================================

-- Senha: "senha123" (hash bcrypt: $2a$10$...)
-- Em produção, usar bcrypt para gerar hashes reais
INSERT INTO users (id, email, password_hash, name, tenant_id, role) VALUES
('660e8400-e29b-41d4-a716-446655440000', 'admin@acaibomsabor.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'João Silva', '550e8400-e29b-41d4-a716-446655440000', 'owner'),
('660e8400-e29b-41d4-a716-446655440001', 'gerente@acaibomsabor.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Maria Santos', '550e8400-e29b-41d4-a716-446655440000', 'admin'),
('660e8400-e29b-41d4-a716-446655440002', 'admin@acaipremium.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Carlos Oliveira', '550e8400-e29b-41d4-a716-446655440001', 'owner');

-- ============================================
-- CONFIGURAÇÕES DA EMPRESA
-- ============================================

INSERT INTO company_settings (tenant_id, trade_name, contact_phone, cnpj, admin_email) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Açaí Bom Sabor Ltda', '(11) 99999-0000', '00.000.000/0001-00', 'contato@acaibomsabor.com'),
('550e8400-e29b-41d4-a716-446655440001', 'Açaí Premium EIRELI', '(11) 88888-0000', '11.111.111/0001-11', 'contato@acaipremium.com');

-- ============================================
-- HORÁRIOS DE FUNCIONAMENTO
-- ============================================

INSERT INTO operating_hours (tenant_id, day, enabled, start_time, end_time) VALUES
-- Açaí Bom Sabor
('550e8400-e29b-41d4-a716-446655440000', 'Segunda a Sexta', true, '10:00', '22:00'),
('550e8400-e29b-41d4-a716-446655440000', 'Sábado', true, '11:00', '23:30'),
('550e8400-e29b-41d4-a716-446655440000', 'Domingo', false, '00:00', '00:00'),
-- Açaí Premium
('550e8400-e29b-41d4-a716-446655440001', 'Segunda a Sexta', true, '09:00', '21:00'),
('550e8400-e29b-41d4-a716-446655440001', 'Sábado', true, '10:00', '22:00'),
('550e8400-e29b-41d4-a716-446655440001', 'Domingo', true, '12:00', '20:00');

-- ============================================
-- PRODUTOS/ESTOQUE
-- ============================================

INSERT INTO products (tenant_id, name, category, current_stock, min_stock, unit, price) VALUES
-- Açaí Bom Sabor
('550e8400-e29b-41d4-a716-446655440000', 'Açaí Natural', 'Ingredientes', 50.00, 20.00, 'kg', 25.00),
('550e8400-e29b-41d4-a716-446655440000', 'Granola', 'Ingredientes', 15.00, 10.00, 'kg', 18.00),
('550e8400-e29b-41d4-a716-446655440000', 'Leite Condensado', 'Ingredientes', 30.00, 15.00, 'unidade', 5.50),
('550e8400-e29b-41d4-a716-446655440000', 'Banana', 'Ingredientes', 8.00, 5.00, 'kg', 6.00),
('550e8400-e29b-41d4-a716-446655440000', 'Morango', 'Ingredientes', 3.00, 5.00, 'kg', 12.00), -- Estoque baixo
-- Açaí Premium
('550e8400-e29b-41d4-a716-446655440001', 'Açaí Premium', 'Ingredientes', 40.00, 15.00, 'kg', 30.00),
('550e8400-e29b-41d4-a716-446655440001', 'Granola Especial', 'Ingredientes', 12.00, 8.00, 'kg', 22.00);

-- ============================================
-- TRANSAÇÕES FINANCEIRAS
-- ============================================

INSERT INTO transactions (tenant_id, type, category, amount, description, date) VALUES
-- Açaí Bom Sabor - Entradas
('550e8400-e29b-41d4-a716-446655440000', 'income', 'Vendas', 150.00, 'Vendas do dia', CURRENT_DATE),
('550e8400-e29b-41d4-a716-446655440000', 'income', 'Vendas', 200.00, 'Vendas do dia', CURRENT_DATE - INTERVAL '1 day'),
('550e8400-e29b-41d4-a716-446655440000', 'income', 'Vendas', 180.00, 'Vendas do dia', CURRENT_DATE - INTERVAL '2 days'),
-- Açaí Bom Sabor - Saídas
('550e8400-e29b-41d4-a716-446655440000', 'expense', 'Compras', 80.00, 'Compra de ingredientes', CURRENT_DATE),
('550e8400-e29b-41d4-a716-446655440000', 'expense', 'Aluguel', 500.00, 'Aluguel do mês', CURRENT_DATE - INTERVAL '5 days'),
-- Açaí Premium
('550e8400-e29b-41d4-a716-446655440001', 'income', 'Vendas', 250.00, 'Vendas do dia', CURRENT_DATE),
('550e8400-e29b-41d4-a716-446655440001', 'expense', 'Compras', 120.00, 'Compra de ingredientes', CURRENT_DATE);

-- ============================================
-- ITENS DO CARDÁPIO
-- ============================================

INSERT INTO menu_items (tenant_id, name, description, base_price, category, available) VALUES
-- Açaí Bom Sabor
('550e8400-e29b-41d4-a716-446655440000', 'Açaí 300ml', 'Açaí natural com granola e banana', 8.00, 'Açaí', true),
('550e8400-e29b-41d4-a716-446655440000', 'Açaí 500ml', 'Açaí natural com granola, banana e leite condensado', 12.00, 'Açaí', true),
('550e8400-e29b-41d4-a716-446655440000', 'Açaí 700ml', 'Açaí natural completo com todos os complementos', 16.00, 'Açaí', true),
('550e8400-e29b-41d4-a716-446655440000', 'Açaí com Morango', 'Açaí 500ml com morangos frescos', 15.00, 'Açaí', true),
('550e8400-e29b-41d4-a716-446655440000', 'Smoothie de Açaí', 'Smoothie cremoso de açaí', 10.00, 'Bebidas', true),
-- Açaí Premium
('550e8400-e29b-41d4-a716-446655440001', 'Açaí Premium 400ml', 'Açaí premium com frutas especiais', 15.00, 'Açaí', true),
('550e8400-e29b-41d4-a716-446655440001', 'Açaí Premium 600ml', 'Açaí premium completo', 20.00, 'Açaí', true);

-- Tamanhos (exemplo para um item)
INSERT INTO menu_item_sizes (menu_item_id, name, price) VALUES
((SELECT id FROM menu_items WHERE name = 'Açaí 300ml' LIMIT 1), 'Pequeno', 0.00),
((SELECT id FROM menu_items WHERE name = 'Açaí 300ml' LIMIT 1), 'Médio', 2.00),
((SELECT id FROM menu_items WHERE name = 'Açaí 300ml' LIMIT 1), 'Grande', 4.00);

-- Adicionais
INSERT INTO menu_item_additions (menu_item_id, name, price) VALUES
((SELECT id FROM menu_items WHERE name = 'Açaí 500ml' LIMIT 1), 'Leite Condensado', 2.00),
((SELECT id FROM menu_items WHERE name = 'Açaí 500ml' LIMIT 1), 'Granola Extra', 1.50),
((SELECT id FROM menu_items WHERE name = 'Açaí 500ml' LIMIT 1), 'Paçoca', 2.50);

-- Complementos
INSERT INTO menu_item_complements (menu_item_id, name, price) VALUES
((SELECT id FROM menu_items WHERE name = 'Açaí 500ml' LIMIT 1), 'Banana', 1.00),
((SELECT id FROM menu_items WHERE name = 'Açaí 500ml' LIMIT 1), 'Morango', 2.00),
((SELECT id FROM menu_items WHERE name = 'Açaí 500ml' LIMIT 1), 'Kiwi', 2.50);

-- ============================================
-- CLIENTES/LEADS
-- ============================================

INSERT INTO customers (tenant_id, name, phone, email) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Ana Costa', '(11) 98765-4321', 'ana@email.com'),
('550e8400-e29b-41d4-a716-446655440000', 'Pedro Alves', '(11) 97654-3210', 'pedro@email.com'),
('550e8400-e29b-41d4-a716-446655440000', 'Julia Lima', '(11) 96543-2109', NULL),
('550e8400-e29b-41d4-a716-446655440001', 'Roberto Silva', '(11) 95432-1098', 'roberto@email.com'),
('550e8400-e29b-41d4-a716-446655440001', 'Fernanda Souza', '(11) 94321-0987', 'fernanda@email.com');

-- ============================================
-- CAMPANHAS
-- ============================================

INSERT INTO campaigns (tenant_id, name, type, status, description, discount, start_date, end_date, sent, delivered, failed) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Promoção de Verão', 'promotion', 'active', 'Desconto de 20% em todos os açaís', 20.00, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 0, 0, 0),
('550e8400-e29b-41d4-a716-446655440000', 'Campanha WhatsApp', 'whatsapp', 'active', 'Promoção via WhatsApp', NULL, CURRENT_DATE, NULL, 150, 145, 5),
('550e8400-e29b-41d4-a716-446655440001', 'Lançamento Premium', 'promotion', 'active', 'Novo açaí premium', 15.00, CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days', 0, 0, 0);

-- ============================================
-- CONFIGURAÇÕES WHATSAPP
-- ============================================

INSERT INTO whatsapp_configs (tenant_id, api_url, api_key, instance_name, connected) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'https://api.evolution.com', 'api_key_example_123', 'acai-bom-sabor-instance', true),
('550e8400-e29b-41d4-a716-446655440001', 'https://api.evolution.com', 'api_key_example_456', 'acai-premium-instance', false);

-- ============================================
-- HISTÓRICO WHATSAPP (exemplo)
-- ============================================

INSERT INTO whatsapp_sends (tenant_id, campaign_id, customer_id, phone, message, status, sent_at) VALUES
(
    '550e8400-e29b-41d4-a716-446655440000',
    (SELECT id FROM campaigns WHERE name = 'Campanha WhatsApp' LIMIT 1),
    (SELECT id FROM customers WHERE name = 'Ana Costa' LIMIT 1),
    '(11) 98765-4321',
    'Olá! Confira nossa promoção especial de verão!',
    'delivered',
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
),
(
    '550e8400-e29b-41d4-a716-446655440000',
    (SELECT id FROM campaigns WHERE name = 'Campanha WhatsApp' LIMIT 1),
    (SELECT id FROM customers WHERE name = 'Pedro Alves' LIMIT 1),
    '(11) 97654-3210',
    'Olá! Confira nossa promoção especial de verão!',
    'sent',
    CURRENT_TIMESTAMP - INTERVAL '1 hour'
);

