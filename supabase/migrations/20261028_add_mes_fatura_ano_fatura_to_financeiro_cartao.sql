-- Etiqueta opcional de "a qual fatura esta parcela pertence", separada da Data real da parcela.
-- NULL em todas as linhas existentes (comportamento antigo preservado, nada retroativo).
-- So passa a ser preenchida em parcelas de cartao criadas a partir desta mudanca.
ALTER TABLE "Financeiro Cartão"
  ADD COLUMN IF NOT EXISTS mes_fatura smallint,
  ADD COLUMN IF NOT EXISTS ano_fatura smallint;

COMMENT ON COLUMN "Financeiro Cartão".mes_fatura IS 'Mes de referencia (1-12) da fatura a que esta parcela pertence, conforme periodos_mensais_cartao. NULL = usar o mes calendario da coluna Data (comportamento legado).';
COMMENT ON COLUMN "Financeiro Cartão".ano_fatura IS 'Ano de referencia da fatura a que esta parcela pertence. Anda sempre junto com mes_fatura.';
