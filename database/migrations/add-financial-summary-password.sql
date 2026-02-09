-- Senha para proteger o Resumo Financeiro no dashboard (quem não sabe a senha não vê os valores)
CREATE TABLE IF NOT EXISTS dashboard_settings (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    financial_summary_password_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE dashboard_settings IS 'Configurações do dashboard por tenant (ex.: senha do resumo financeiro)';
