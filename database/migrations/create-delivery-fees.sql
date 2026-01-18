-- ============================================
-- CRIAÇÃO DA TABELA delivery_fees
-- Sistema de Taxa de Entrega por Bairro
-- ============================================

CREATE TABLE IF NOT EXISTS delivery_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    neighborhood VARCHAR(255) NOT NULL,
    fee DECIMAL(10, 2) NOT NULL CHECK (fee >= 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_delivery_fees_tenant_id ON delivery_fees(tenant_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_fees_tenant_neighborhood_unique ON delivery_fees(tenant_id, neighborhood) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_fees_tenant_neighborhood ON delivery_fees(tenant_id, neighborhood) WHERE deleted_at IS NULL;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_delivery_fees_updated_at 
    BEFORE UPDATE ON delivery_fees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE delivery_fees IS 'Taxas de entrega configuradas por bairro para cada tenant';
COMMENT ON COLUMN delivery_fees.neighborhood IS 'Nome do bairro (normalizado para comparação)';
COMMENT ON COLUMN delivery_fees.fee IS 'Taxa de entrega em reais (R$)';

