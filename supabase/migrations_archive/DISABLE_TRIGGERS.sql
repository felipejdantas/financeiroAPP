-- ============================================================================
-- SCRIPT: DESATIVAR TODA A AUTOMAÇÃO DE BANCO (GATILHOS)
-- ============================================================================
-- Como a lógica no banco está causando conflitos e "sumiço" de dados,
-- vamos remover TODOS os gatilhos e deixar o FRONTEND (Site) controlar tudo.
-- Isso é mais seguro e evita erros invisíveis.

-- 1. Remover Triggers de Insert/Update/Delete (Pagamento e Geração)
DROP TRIGGER IF EXISTS trigger_handle_payment_cartao ON "Financeiro Cartão";
DROP TRIGGER IF EXISTS trigger_handle_payment_debito ON "Financeiro Debito";
DROP TRIGGER IF EXISTS trigger_cleanup_cartao ON "Financeiro Cartão";
DROP TRIGGER IF EXISTS trigger_cleanup_debito ON "Financeiro Debito";
DROP TRIGGER IF EXISTS trigger_gen_cartao ON "Financeiro Cartão";
DROP TRIGGER IF EXISTS trigger_gen_debito ON "Financeiro Debito";
DROP TRIGGER IF EXISTS trigger_auto_generate_fixed_costs ON fixed_costs;

-- 2. (Opcional) Remover as funções para garantir que não sejam chamadas
DROP FUNCTION IF EXISTS public.handle_fixed_cost_payment() CASCADE;
DROP FUNCTION IF EXISTS public.handle_payment_cleanup() CASCADE;
DROP FUNCTION IF EXISTS public.handle_payment_generation() CASCADE;
DROP FUNCTION IF EXISTS public.auto_generate_fixed_cost_expenses() CASCADE;

-- 3. Manter apenas a função auxiliar de geração (caso o frontend queira chamar manualmente via RPC)
-- Mas o ideal é o frontend fazer o insert direto também.

DO $$
BEGIN
  RAISE NOTICE 'TODOS OS GATILHOS FORAM REMOVIDOS. O SITE AGORA CONTROLA TUDO.';
END $$;
