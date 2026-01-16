-- Tabela para armazenar instâncias WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    instance_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'connected', 'disconnected', 'connecting')),
    integration VARCHAR(50) NOT NULL DEFAULT 'WHATSAPP-BAILEYS',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(tenant_id, instance_name)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_tenant_id ON whatsapp_instances(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_instance_name ON whatsapp_instances(instance_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status ON whatsapp_instances(tenant_id, status) WHERE deleted_at IS NULL;

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_instances_updated_at BEFORE UPDATE ON whatsapp_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE whatsapp_instances IS 'Instâncias WhatsApp criadas na Evolution API';

