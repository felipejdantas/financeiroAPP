-- Add ano_referencia column to periodos_mensais_cartao table
ALTER TABLE periodos_mensais_cartao 
ADD COLUMN IF NOT EXISTS ano_referencia INTEGER DEFAULT 2025;

-- Update existing records to have year 2025
UPDATE periodos_mensais_cartao 
SET ano_referencia = 2025 
WHERE ano_referencia IS NULL;

-- Add comment to the column
COMMENT ON COLUMN periodos_mensais_cartao.ano_referencia IS 'Ano de referência do período (2025-2028)';
