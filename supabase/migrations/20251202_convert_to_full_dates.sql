-- Migration: Alterar periodos_mensais_cartao para usar datas completas
-- Data: 2025-12-02
-- Descrição: Substitui o sistema de dia + offset por datas completas (data_inicio e data_fim)

-- 1. Adicionar novas colunas com datas completas
ALTER TABLE public.periodos_mensais_cartao
ADD COLUMN data_inicio DATE,
ADD COLUMN data_fim DATE,
ADD COLUMN nome_periodo VARCHAR(100);

-- 2. Migrar dados existentes para o novo formato
-- Converte os períodos existentes para datas do ano atual
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
  nome_periodo = TO_CHAR(MAKE_DATE(2024, mes_referencia, 1), 'TMMonth');

-- 3. Tornar as novas colunas obrigatórias
ALTER TABLE public.periodos_mensais_cartao
ALTER COLUMN data_inicio SET NOT NULL,
ALTER COLUMN data_fim SET NOT NULL;

-- 4. Remover a constraint antiga de unicidade
ALTER TABLE public.periodos_mensais_cartao
DROP CONSTRAINT IF EXISTS periodos_mensais_cartao_user_mes_unique,
DROP CONSTRAINT IF EXISTS periodos_mensais_cartao_user_id_mes_referencia_key;

-- 5. Adicionar nova constraint de unicidade baseada em datas
-- Garante que não haja períodos sobrepostos para o mesmo usuário
CREATE UNIQUE INDEX periodos_mensais_cartao_user_dates_unique 
ON public.periodos_mensais_cartao (user_id, data_inicio, data_fim);

-- 6. Adicionar check constraint para garantir que data_fim > data_inicio
ALTER TABLE public.periodos_mensais_cartao
ADD CONSTRAINT periodos_mensais_cartao_dates_check 
CHECK (data_fim > data_inicio);

-- 7. Remover colunas antigas (OPCIONAL - comentado por segurança)
-- Descomente estas linhas após confirmar que tudo está funcionando
-- ALTER TABLE public.periodos_mensais_cartao
-- DROP COLUMN mes_referencia,
-- DROP COLUMN mes_inicio_offset,
-- DROP COLUMN dia_inicio,
-- DROP COLUMN dia_fim;

-- 8. Atualizar comentários
COMMENT ON COLUMN public.periodos_mensais_cartao.data_inicio IS 'Data de início do período (formato: YYYY-MM-DD)';
COMMENT ON COLUMN public.periodos_mensais_cartao.data_fim IS 'Data de fim do período (formato: YYYY-MM-DD)';
COMMENT ON COLUMN public.periodos_mensais_cartao.nome_periodo IS 'Nome descritivo do período (ex: Janeiro 2025)';
COMMENT ON TABLE public.periodos_mensais_cartao IS 'Armazena períodos de faturamento do cartão com datas completas';
