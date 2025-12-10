-- ============================================================================
-- SCRIPT V3 CLEAN SLATE: CORREÇÃO TOTAL (29/02)
-- ============================================================================
-- Este script APAGA qualquer vestígio das funções antigas e recria tudo do zero.
-- Serve para garantir que não haja conflito de versões (v1, v2, etc).

-- 1. LIMPEZA TOTAL (Cascade apaga triggers também)
DROP FUNCTION IF EXISTS public.generate_future_fixed_costs(uuid, int) CASCADE;
DROP FUNCTION IF EXISTS public.generate_future_fixed_costs(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.generate_future_fixed_costs_v2(uuid, int) CASCADE;
DROP FUNCTION IF EXISTS public.auto_generate_fixed_cost_expenses() CASCADE;

-- 2. RECRIAR FUNÇÃO PRIMÁRIA COM NOME PADRÃO (Mas com a lógica corrigida)
CREATE OR REPLACE FUNCTION public.generate_future_fixed_costs(p_user_id UUID, p_months_ahead INTEGER DEFAULT 1)
RETURNS TABLE (message TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    r_fixed_cost RECORD;
    v_target_date DATE;
    v_due_day INTEGER;
    v_year INTEGER;
    v_month INTEGER;
    v_exists BOOLEAN;
    v_month_paid BOOLEAN;
    v_table_name TEXT;
BEGIN
    FOR r_fixed_cost IN SELECT * FROM public.fixed_costs WHERE user_id = p_user_id AND auto_generate = true LOOP
        v_due_day := r_fixed_cost.due_day;
        
        -- Começa no dia 1 do mês atual
        v_target_date := make_date(extract(year from current_date)::int, extract(month from current_date)::int, 1);
        
        -- Verifica se já pagou neste mês
        v_month_paid := false;
        
        PERFORM 1 FROM "Financeiro Cartão" 
        WHERE user_id = p_user_id 
          AND (status IS NULL OR status != 'pendente')
          AND (fixed_cost_id = r_fixed_cost.id OR ("Descrição" ILIKE r_fixed_cost.title AND ABS(valor - r_fixed_cost.amount) < 1.0))
          AND to_date("Data", 'DD/MM/YYYY') >= date_trunc('month', v_target_date)
          AND to_date("Data", 'DD/MM/YYYY') < date_trunc('month', v_target_date) + INTERVAL '1 month';
        IF FOUND THEN v_month_paid := true; END IF;

        IF NOT v_month_paid THEN
             PERFORM 1 FROM "Financeiro Debito" 
             WHERE user_id = p_user_id 
               AND (status IS NULL OR status != 'pendente')
               AND (fixed_cost_id = r_fixed_cost.id OR ("Descrição" ILIKE r_fixed_cost.title AND ABS(valor - r_fixed_cost.amount) < 1.0))
               AND to_date("Data", 'DD/MM/YYYY') >= date_trunc('month', v_target_date)
               AND to_date("Data", 'DD/MM/YYYY') < date_trunc('month', v_target_date) + INTERVAL '1 month';
             IF FOUND THEN v_month_paid := true; END IF;
        END IF;

        -- Se já pagou, avança para o próximo mês
        IF v_month_paid THEN
            v_target_date := v_target_date + INTERVAL '1 month';
        END IF;

        -- === LÓGICA DE SEGURANÇA (LEAST) ===
        DECLARE
           v_last_day_month DATE;
           v_safe_day INTEGER;
        BEGIN
           -- Último dia do mês alvo
           v_last_day_month := (date_trunc('month', v_target_date) + interval '1 month' - interval '1 day')::date;
           -- Ajusta dia
           v_safe_day := LEAST(v_due_day, extract(day from v_last_day_month)::int);
           -- Cria data segura
           v_target_date := make_date(extract(year from v_target_date)::int, extract(month from v_target_date)::int, v_safe_day);
        END;
        -- =======================================

        DECLARE
           v_data_str TEXT := to_char(v_target_date, 'DD/MM/YYYY');
        BEGIN
            -- Verifica duplicatas
            v_exists := false;
            
            PERFORM 1 FROM "Financeiro Cartão" WHERE user_id = p_user_id AND fixed_cost_id = r_fixed_cost.id AND status = 'pendente';
            IF FOUND THEN v_exists := true; END IF;
            
            IF NOT v_exists THEN
                PERFORM 1 FROM "Financeiro Debito" WHERE user_id = p_user_id AND fixed_cost_id = r_fixed_cost.id AND status = 'pendente';
                IF FOUND THEN v_exists := true; END IF;
            END IF;

            -- Inserir nova despesa
            IF NOT v_exists THEN
                v_table_name := CASE WHEN r_fixed_cost.payment_method = 'Crédito' THEN 'Financeiro Cartão' ELSE 'Financeiro Debito' END;
                
                EXECUTE format('
                    INSERT INTO "%I" (
                        user_id, "Data", "Descrição", "Responsavel", "Tipo", 
                        "Categoria", "Parcela", "valor", "Fatura", fixed_cost_id, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ', v_table_name) 
                USING 
                    p_user_id, 
                    v_data_str, 
                    r_fixed_cost.title, 
                    'Sistema', 
                    r_fixed_cost.payment_method, 
                    r_fixed_cost.category, 
                    'Fixa', 
                    r_fixed_cost.amount, 
                    CASE WHEN r_fixed_cost.payment_method = 'Crédito' THEN 'Aberta' ELSE NULL END,
                    r_fixed_cost.id, 
                    'pendente';
                    
                RETURN QUERY SELECT 'Gerado: ' || r_fixed_cost.title || ' (' || v_data_str || ')';
            END IF;
        END;
    END LOOP;
END;
$$;

-- 3. RECRIAR FUNÇÃO DE TRIGGER (Chamando a função original agora corrigida)
CREATE FUNCTION public.auto_generate_fixed_cost_expenses()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result RECORD;
BEGIN
  IF NEW.auto_generate = true THEN
    PERFORM public.generate_future_fixed_costs(NEW.user_id, 1);
  END IF;
  RETURN NEW;
END;
$$;

-- 4. RECRIAR TRIGGERS
CREATE TRIGGER trigger_auto_generate_on_insert
  AFTER INSERT ON public.fixed_costs
  FOR EACH ROW
  WHEN (NEW.auto_generate = true)
  EXECUTE FUNCTION public.auto_generate_fixed_cost_expenses();

CREATE TRIGGER trigger_auto_generate_on_update
  AFTER UPDATE ON public.fixed_costs
  FOR EACH ROW
  WHEN (NEW.auto_generate = true AND (
    OLD.auto_generate = false OR 
    OLD.amount != NEW.amount OR 
    OLD.due_day != NEW.due_day OR
    OLD.category != NEW.category OR
    OLD.payment_method != NEW.payment_method
  ))
  EXECUTE FUNCTION public.auto_generate_fixed_cost_expenses();

-- 5. MENSAGEM FINAL
DO $$
BEGIN
  RAISE NOTICE 'AMBIENTE LIMPO E CORRIGIDO (V3)';
END $$;
