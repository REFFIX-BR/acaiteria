-- Adiciona limites grátis por categoria de adicionais
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS free_additions INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_complements INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_fruits INTEGER NOT NULL DEFAULT 0;
