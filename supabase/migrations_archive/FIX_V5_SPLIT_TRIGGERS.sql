-- ============================================================================
-- FIX V5: TRIGGERS INTELIGENTES (ANTES e DEPOIS)
-- ============================================================================
-- Resolve o problema de duplicação e garante que os meses futuros apareçam.

-- 1. TRIGGER 1 (ANTES): Limpeza e Vínculo
-- Este trigger serve apenas para apagar a conta pendente antiga e ajustar o ID.
CREATE OR REPLACE FUNCTION public.handle_payment_cleanup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fixed_cost_id BIGINT;
  v_pending_id BIGINT;
BEGIN
  IF (NEW.status IS NULL OR NEW.status != 'pendente') THEN
    -- Tenta encontrar o vínculo
    IF NEW.fixed_cost_id IS NOT NULL THEN
        v_fixed_cost_id := NEW.fixed_cost_id;
        SELECT id INTO v_pending_id FROM "Financeiro Cartão" WHERE fixed_cost_id = v_fixed_cost_id AND status = 'pendente' LIMIT 1;
        IF v_pending_id IS NULL THEN
            SELECT id INTO v_pending_id FROM "Financeiro Debito" WHERE fixed_cost_id = v_fixed_cost_id AND status = 'pendente' LIMIT 1;
        END IF;
    ELSE
        -- Tenta pelo nome/valor
        SELECT id, fixed_cost_id INTO v_pending_id, v_fixed_cost_id FROM "Financeiro Cartão"
        WHERE status = 'pendente' AND "Descrição" ILIKE NEW."Descrição" AND ABS(valor - NEW.valor) < 1.0 LIMIT 1;
        
        IF v_pending_id IS NULL THEN
            SELECT id, fixed_cost_id INTO v_pending_id, v_fixed_cost_id FROM "Financeiro Debito"
            WHERE status = 'pendente' AND "Descrição" ILIKE NEW."Descrição" AND ABS(valor - NEW.valor) < 1.0 LIMIT 1;
        END IF;
        
        IF v_fixed_cost_id IS NOT NULL THEN NEW.fixed_cost_id := v_fixed_cost_id; END IF;
    END IF;

    -- APAGA A PENDÊNCIA (LIMPEZA)
    IF v_pending_id IS NOT NULL THEN
      DELETE FROM "Financeiro Cartão" WHERE id = v_pending_id;
      DELETE FROM "Financeiro Debito" WHERE id = v_pending_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. TRIGGER 2 (DEPOIS): Geração de Futuro
-- Roda DEPOIS de inserir, garantindo que o sistema veja que o mês atual já está pago.
CREATE OR REPLACE FUNCTION public.handle_payment_generation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (NEW.status IS NULL OR NEW.status != 'pendente') THEN
      IF NEW.fixed_cost_id IS NOT NULL THEN
          -- Chama a função de geração para garantir 12 meses para frente
          PERFORM public.generate_future_fixed_costs(NEW.user_id, 12);
      END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. REMOVER TRIGGERS ANTIGOS CONFLITANTES
DROP TRIGGER IF EXISTS trigger_handle_payment_cartao ON "Financeiro Cartão";
DROP TRIGGER IF EXISTS trigger_handle_payment_debito ON "Financeiro Debito";
DROP TRIGGER IF EXISTS trigger_cleanup_cartao ON "Financeiro Cartão";
DROP TRIGGER IF EXISTS trigger_cleanup_debito ON "Financeiro Debito";
DROP TRIGGER IF EXISTS trigger_gen_cartao ON "Financeiro Cartão";
DROP TRIGGER IF EXISTS trigger_gen_debito ON "Financeiro Debito";

-- 4. INSTALAR NOVOS TRIGGERS (SPLIT)
-- Cartão
CREATE TRIGGER trigger_cleanup_cartao
  BEFORE INSERT ON "Financeiro Cartão"
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_cleanup();

CREATE TRIGGER trigger_gen_cartao
  AFTER INSERT ON "Financeiro Cartão"
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_generation();

-- Débito
CREATE TRIGGER trigger_cleanup_debito
  BEFORE INSERT ON "Financeiro Debito"
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_cleanup();

CREATE TRIGGER trigger_gen_debito
  AFTER INSERT ON "Financeiro Debito"
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_generation();

DO $$ BEGIN RAISE NOTICE 'SISTEMA V5 (TRIGGERS DIVIDIDOS) ATIVO!'; END $$;
