-- ============================================
-- ADICIONAR COLUNA delivery_fee NA TABELA orders
-- ============================================

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT NULL;

-- Comentário
COMMENT ON COLUMN orders.delivery_fee IS 'Taxa de entrega aplicada ao pedido (NULL quando não há taxa ou é retirada)';

