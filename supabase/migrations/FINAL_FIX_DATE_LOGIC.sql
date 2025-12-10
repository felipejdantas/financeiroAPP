-- ============================================================================
-- FIX DEFINITIVO: LÓGICA DE DATA ROBUSTA (29/02, 31/04, etc.)
-- ============================================================================

-- 1. DROpar funções antigas para evitar conflitos de assinatura
DROP FUNCTION IF EXISTS public.generate_future_fixed_costs(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.generate_future_fixed_costs(uuid, int) CASCADE;

-- 2. Recriar a FUNÇÃO com a proteção de data (LEAST)
CREATE OR REPLACE FUNCTION public.generate_future_fixed_costs(p_user_id UUID, p_months_ahead INTEGER DEFAULT 1)
RETURNS TABLE (message TEXT) LANGUAGE plpgsql AS $$
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
        
        -- Começa no dia 1 do mês atual para evitar erros ao manipular dias inexistentes
        v_target_date := make_date(extract(year from current_date)::int, extract(month from current_date)::int, 1);
        
        -- Verifica se já pagou neste mês (procura por status != 'pendente' ou 'pago')
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

        -- Se já pagou o mês atual, o alvo passa a ser o próximo mês
        IF v_month_paid THEN
            v_target_date := v_target_date + INTERVAL '1 month';
        END IF;

        -- === LÓGICA DE SEGURANÇA DE DATA ===
        DECLARE
           v_last_day_month DATE;
           v_safe_day INTEGER;
        BEGIN
           -- Calcula o último dia do mês alvo (ex: 28/02/2026)
           v_last_day_month := (date_trunc('month', v_target_date) + interval '1 month' - interval '1 day')::date;
           
           -- Pega o MENOR entre o dia de vencimento desejado (ex: 30) e o último dia do mês (ex: 28)
           v_safe_day := LEAST(v_due_day, extract(day from v_last_day_month)::int);
           
           -- Agora é seguro criar a data
           v_target_date := make_date(extract(year from v_target_date)::int, extract(month from v_target_date)::int, v_safe_day);
        END;
        -- ===================================

        DECLARE
           v_data_str TEXT := to_char(v_target_date, 'DD/MM/YYYY');
        BEGIN
            -- Verifica se JÁ EXISTE uma pendência para essa data/mês
            v_exists := false;
            
            PERFORM 1 FROM "Financeiro Cartão" 
            WHERE user_id = p_user_id 
            AND fixed_cost_id = r_fixed_cost.id 
            AND status = 'pendente';
            -- Nota: Simplifiquei para apenas checar se existe ALGUMA pendente vinculada, 
            -- pois a regra é ter apenas uma pendência futura por vez.
            
            IF FOUND THEN v_exists := true; END IF;
            
            IF NOT v_exists THEN
                PERFORM 1 FROM "Financeiro Debito" 
                WHERE user_id = p_user_id 
                AND fixed_cost_id = r_fixed_cost.id 
                AND status = 'pendente';
                IF FOUND THEN v_exists := true; END IF;
            END IF;

            -- INSERIR SE NÃO EXISTIR
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
                    
                RETURN QUERY SELECT 'Gerado: ' || r_fixed_cost.title || ' para ' || v_data_str;
            END IF;
        END;
    END LOOP;
END;
$$;

-- 3. Confirmar execução
DO $$
BEGIN
  RAISE NOTICE 'Script de Correção FINAL executado com sucesso.';
END $$;
