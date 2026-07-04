-- ============================================================================
-- SCRIPT DE LIMPEZA PROFUNDA (DETECTAR NULL)
-- ============================================================================
-- Este script apaga despesas que tem "(Custo Fixo)" no nome MAS não tem vínculo
-- com nenhum custo fixo real (fixed_cost_id IS NULL).
-- Isso acontece quando o custo fixo foi apagado e o banco apenas "desvinculou" o registro.

DO $$
DECLARE
  v_count_cartao INTEGER;
  v_count_debito INTEGER;
BEGIN

  -- 1. Contar (Cartão)
  SELECT COUNT(*) INTO v_count_cartao 
  FROM "Financeiro Cartão"
  WHERE status = 'pendente'
  AND fixed_cost_id IS NULL 
  AND "Descrição" LIKE '%(Custo Fixo)%';

  -- 2. Apagar (Cartão)
  DELETE FROM "Financeiro Cartão"
  WHERE status = 'pendente'
  AND fixed_cost_id IS NULL 
  AND "Descrição" LIKE '%(Custo Fixo)%';

  -- 3. Contar (Débito)
  SELECT COUNT(*) INTO v_count_debito
  FROM "Financeiro Debito"
  WHERE status = 'pendente'
  AND fixed_cost_id IS NULL 
  AND "Descrição" LIKE '%(Custo Fixo)%';

  -- 4. Apagar (Débito)
  DELETE FROM "Financeiro Debito"
  WHERE status = 'pendente'
  AND fixed_cost_id IS NULL 
  AND "Descrição" LIKE '%(Custo Fixo)%';

  -- 5. Relatório
  RAISE NOTICE 'Limpeza Profunda Concluída!';
  RAISE NOTICE 'Registros fantasmas removidos do Cartão: %', v_count_cartao;
  RAISE NOTICE 'Registros fantasmas removidos do Débito: %', v_count_debito;

END $$;
