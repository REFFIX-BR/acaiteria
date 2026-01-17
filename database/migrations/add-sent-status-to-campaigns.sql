-- Adicionar status 'sent' às campanhas
ALTER TABLE campaigns 
DROP CONSTRAINT IF EXISTS campaigns_status_check;

ALTER TABLE campaigns 
ADD CONSTRAINT campaigns_status_check 
CHECK (status IN ('active', 'paused', 'completed', 'sent'));

