-- ============================================================================
-- SCRIPT DE LIMPEZA DE RESÍDUOS (ORFÃOS)
-- ============================================================================
-- Este script remove despesas "pendentes" que ficaram perdidas no banco de dados
-- porque o Custo Fixo original foi excluído antes da correção do sistema.

DO $$
DECLARE
  v_count_cartao INTEGER;
  v_count_debito INTEGER;
BEGIN

  -- 1. Contar quantos órfãos existem no Cartão
  SELECT COUNT(*) INTO v_count_cartao 
  FROM "Financeiro Cartão"
  WHERE status = 'pendente'
  AND fixed_cost_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM fixed_costs WHERE id = "Financeiro Cartão".fixed_cost_id);

  -- 2. Apagar órfãos do Cartão
  DELETE FROM "Financeiro Cartão"
  WHERE status = 'pendente'
  AND fixed_cost_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM fixed_costs WHERE id = "Financeiro Cartão".fixed_cost_id);

  -- 3. Contar quantos órfãos existem no Débito
  SELECT COUNT(*) INTO v_count_debito
  FROM "Financeiro Debito"
  WHERE status = 'pendente'
  AND fixed_cost_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM fixed_costs WHERE id = "Financeiro Debito".fixed_cost_id);

  -- 4. Apagar órfãos do Débito
  DELETE FROM "Financeiro Debito"
  WHERE status = 'pendente'
  AND fixed_cost_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM fixed_costs WHERE id = "Financeiro Debito".fixed_cost_id);

  -- 5. Relatório
  RAISE NOTICE 'Limpeza Concluída!';
  RAISE NOTICE 'Registros órfãos removidos do Cartão: %', v_count_cartao;
  RAISE NOTICE 'Registros órfãos removidos do Débito: %', v_count_debito;

END $$;
