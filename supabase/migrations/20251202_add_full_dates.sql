-- Migration: Adicionar suporte a datas completas
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar colunas de datas completas se não existirem
ALTER TABLE public.periodos_mensais_cartao
ADD COLUMN IF NOT EXISTS data_inicio DATE,
ADD COLUMN IF NOT EXISTS data_fim DATE,
ADD COLUMN IF NOT EXISTS nome_periodo VARCHAR(100);

-- 2. Migrar dados existentes (converte para ano atual)
-- Isso garante que os dados atuais não sejam perdidos e tenham valores válidos nas novas colunas
UPDATE public.periodos_mensais_cartao
SET 
  data_inicio = MAKE_DATE(
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
    CASE 
      WHEN mes_referencia + mes_inicio_offset < 1 THEN 12
      WHEN mes_referencia + mes_inicio_offset > 12 THEN 1
      ELSE mes_referencia + mes_inicio_offset
    END,
    dia_inicio
  ),
  data_fim = MAKE_DATE(
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
    mes_referencia,
    dia_fim
  ),
  nome_periodo = CASE mes_referencia
    WHEN 1 THEN 'Janeiro'
    WHEN 2 THEN 'Fevereiro'
    WHEN 3 THEN 'Março'
    WHEN 4 THEN 'Abril'
    WHEN 5 THEN 'Maio'
    WHEN 6 THEN 'Junho'
    WHEN 7 THEN 'Julho'
    WHEN 8 THEN 'Agosto'
    WHEN 9 THEN 'Setembro'
    WHEN 10 THEN 'Outubro'
    WHEN 11 THEN 'Novembro'
    WHEN 12 THEN 'Dezembro'
  END
WHERE data_inicio IS NULL OR data_fim IS NULL;

-- 3. Adicionar constraint de validação (opcional, mas recomendado)
-- ALTER TABLE public.periodos_mensais_cartao
-- ADD CONSTRAINT periodos_mensais_cartao_dates_check 
-- CHECK (data_fim > data_inicio);
