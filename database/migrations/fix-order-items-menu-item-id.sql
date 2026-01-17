-- Migration: Alterar menu_item_id em order_items de UUID para TEXT
-- Isso permite que o frontend envie IDs no formato antigo (menu-item-timestamp-random)
-- sem quebrar a criação de pedidos

-- 1. Dropar a view que depende da coluna
DROP VIEW IF EXISTS top_selling_products;

-- 2. Remover a foreign key constraint
ALTER TABLE order_items 
DROP CONSTRAINT IF EXISTS order_items_menu_item_id_fkey;

-- 3. Alterar o tipo da coluna de UUID para TEXT
ALTER TABLE order_items 
ALTER COLUMN menu_item_id TYPE TEXT;

-- 4. Remover o índice antigo (baseado em UUID)
DROP INDEX IF EXISTS idx_order_items_menu_item_id;

-- 5. Criar novo índice para TEXT
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);

-- 6. Recriar a view sem JOIN com menu_items (já que menu_item_id agora é TEXT)
CREATE OR REPLACE VIEW top_selling_products AS
SELECT 
    oi.menu_item_id,
    o.tenant_id,
    oi.menu_item_name as product_name,
    NULL::VARCHAR(100) as category, -- Não temos mais acesso à categoria via JOIN
    SUM(oi.quantity) as total_quantity_sold,
    COUNT(DISTINCT oi.order_id) as total_orders,
    SUM(oi.total_price) as total_revenue
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
WHERE o.status = 'delivered' 
    AND o.deleted_at IS NULL
GROUP BY oi.menu_item_id, o.tenant_id, oi.menu_item_name
ORDER BY total_quantity_sold DESC;

