-- ============================================================================
-- SCRIPT: RESTAURAR LÓGICA DE PAGAMENTO (TRIGGER)
-- ============================================================================
-- Este script faz com que, ao pagar uma conta:
-- 1. A despesa "pendente" antiga seja removida.
-- 2. A despesa do "próximo mês" seja gerada automaticamente.

-- 1. Função que reage ao pagamento (INSERT na tabela de Finanças)
CREATE OR REPLACE FUNCTION public.handle_fixed_cost_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fixed_cost_id BIGINT;
  v_pending_id BIGINT;
BEGIN
  -- Só roda se o status for finalizado (PAGO) ou se não tiver status (assume pago)
  -- E se não for 'pendente'
  IF (NEW.status IS NULL OR NEW.status != 'pendente') THEN
    
    -- Tenta descobrir qual é o Custo Fixo e Pendência associada
    -- 1. Pelo ID direto (se o frontend mandou)
    IF NEW.fixed_cost_id IS NOT NULL THEN
        v_fixed_cost_id := NEW.fixed_cost_id;
        
        -- Busca pendência correspondente no Cartão
        SELECT id INTO v_pending_id FROM "Financeiro Cartão" 
        WHERE fixed_cost_id = v_fixed_cost_id AND status = 'pendente' LIMIT 1;
        
        -- Se não achou, busca no Débito
        IF v_pending_id IS NULL THEN
            SELECT id INTO v_pending_id FROM "Financeiro Debito" 
            WHERE fixed_cost_id = v_fixed_cost_id AND status = 'pendente' LIMIT 1;
        END IF;

    -- 2. Tenta "adivinhar" pelo Nome e Valor (caso venha sem ID)
    ELSE
        -- Busca no Cartão
        SELECT id, fixed_cost_id INTO v_pending_id, v_fixed_cost_id
        FROM "Financeiro Cartão"
        WHERE status = 'pendente'
          AND "Descrição" ILIKE NEW."Descrição"
          AND ABS(valor - NEW.valor) < 1.0
        LIMIT 1;
        
        -- Busca no Débito se não achou
        IF v_pending_id IS NULL THEN
            SELECT id, fixed_cost_id INTO v_pending_id, v_fixed_cost_id
            FROM "Financeiro Debito"
            WHERE status = 'pendente'
              AND "Descrição" ILIKE NEW."Descrição"
              AND ABS(valor - NEW.valor) < 1.0
            LIMIT 1;
        END IF;
        
        -- Se achou por nome, vincula o ID na transação nova pra ficar organizado
        IF v_fixed_cost_id IS NOT NULL THEN
            NEW.fixed_cost_id := v_fixed_cost_id;
        END IF;
    END IF;

    -- AÇÃO: Se encontrou a pendência antiga
    IF v_pending_id IS NOT NULL THEN
      -- Remove a pendência (pois agora está paga)
      DELETE FROM "Financeiro Cartão" WHERE id = v_pending_id;
      DELETE FROM "Financeiro Debito" WHERE id = v_pending_id;
      
      -- Gera o próximo mês!
      IF v_fixed_cost_id IS NOT NULL THEN
          PERFORM public.generate_future_fixed_costs(NEW.user_id, 1);
      END IF;
    END IF;
    
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Criar os Triggers nas tabelas financeiras
DROP TRIGGER IF EXISTS trigger_handle_payment_cartao ON "Financeiro Cartão";
CREATE TRIGGER trigger_handle_payment_cartao
  BEFORE INSERT ON "Financeiro Cartão"
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_fixed_cost_payment();

DROP TRIGGER IF EXISTS trigger_handle_payment_debito ON "Financeiro Debito";
CREATE TRIGGER trigger_handle_payment_debito
  BEFORE INSERT ON "Financeiro Debito"
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_fixed_cost_payment();

DO $$
BEGIN
  RAISE NOTICE 'Lógica de Pagamento Restaurada com sucesso!';
END $$;
