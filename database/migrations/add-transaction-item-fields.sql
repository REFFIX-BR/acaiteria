-- Campos opcionais para identificar qual item foi vendido no Fluxo de Caixa
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS item_category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS item_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS item_quantity INTEGER;

-- Garantia mínima para quantidade quando informada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transactions_item_quantity_positive'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_item_quantity_positive
      CHECK (item_quantity IS NULL OR item_quantity > 0);
  END IF;
END $$;

