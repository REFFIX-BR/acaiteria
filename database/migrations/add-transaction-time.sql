-- Adiciona horário da operação nas transações do fluxo de caixa
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS time TIME NOT NULL DEFAULT '00:00';

COMMENT ON COLUMN transactions.time IS 'Horário da operação (HH:MM)';

-- Ordenação por data e hora fica mais clara com índice (opcional)
CREATE INDEX IF NOT EXISTS idx_transactions_date_time
  ON transactions(tenant_id, date DESC, time DESC) WHERE deleted_at IS NULL;
