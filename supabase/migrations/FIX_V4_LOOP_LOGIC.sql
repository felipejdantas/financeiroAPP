-- ============================================================================
-- FIX V4: RESTAURAR GERAÇÃO DE MÚLTIPLOS MESES (LOOP)
-- ============================================================================
-- A versão V3 estava gerando apenas 1 mês. 
-- Esta versão V4 restaura o "loop" para gerar 12 meses (ou quantos forem pedidos).

CREATE OR REPLACE FUNCTION public.generate_future_fixed_costs(p_user_id UUID, p_months_ahead INTEGER DEFAULT 1)
RETURNS TABLE (message TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    r_fixed_cost RECORD;
    v_base_date DATE;
    v_target_date DATE;
    v_due_day INTEGER;
    v_exists BOOLEAN;
    v_table_name TEXT;
    i INTEGER;
BEGIN
    FOR r_fixed_cost IN SELECT * FROM public.fixed_costs WHERE user_id = p_user_id AND auto_generate = true LOOP
        v_due_day := r_fixed_cost.due_day;
        
        -- Começa no dia 1 do mês atual
        v_base_date := make_date(extract(year from current_date)::int, extract(month from current_date)::int, 1);

        -- LOOP: Itera de 0 até o número de meses pedidos (Ex: 0..11 para 12 meses)
        FOR i IN 0..(p_months_ahead - 1) LOOP
            
            -- DATA ALVO: Mês atual + i meses
            v_target_date := v_base_date + (i || ' month')::interval;

            -- === LÓGICA DE SEGURANÇA (LEAST) ===
            DECLARE
               v_last_day_month DATE;
               v_safe_day INTEGER;
            BEGIN
               -- Último dia do mês alvo
               v_last_day_month := (date_trunc('month', v_target_date) + interval '1 month' - interval '1 day')::date;
               -- Ajusta dia
               v_safe_day := LEAST(v_due_day, extract(day from v_last_day_month)::int);
               -- Cria data segura final
               v_target_date := make_date(extract(year from v_target_date)::int, extract(month from v_target_date)::int, v_safe_day);
            END;
            -- =======================================

            DECLARE
               v_data_str TEXT := to_char(v_target_date, 'DD/MM/YYYY');
               v_month_paid_or_pending BOOLEAN := false;
            BEGIN
                -- Verifica se JÁ EXISTE (Status pendente OU pago) para este mês específico
                -- Se já existir qualquer registro para este Fixed Cost neste mês, não geramos duplicata.
                
                -- Checa Cartão
                PERFORM 1 FROM "Financeiro Cartão" 
                WHERE user_id = p_user_id 
                AND fixed_cost_id = r_fixed_cost.id 
                AND date_trunc('month', to_date("Data", 'DD/MM/YYYY')) = date_trunc('month', v_target_date);
                IF FOUND THEN v_month_paid_or_pending := true; END IF;
                
                IF NOT v_month_paid_or_pending THEN
                    -- Checa Débito
                    PERFORM 1 FROM "Financeiro Debito" 
                    WHERE user_id = p_user_id 
                    AND fixed_cost_id = r_fixed_cost.id 
                    AND date_trunc('month', to_date("Data", 'DD/MM/YYYY')) = date_trunc('month', v_target_date);
                    IF FOUND THEN v_month_paid_or_pending := true; END IF;
                END IF;

                -- SE NÃO EXISTE NADA NESTE MÊS, CRIA A PENDÊNCIA
                IF NOT v_month_paid_or_pending THEN
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
        END LOOP; -- Fim do Loop de Meses
    END LOOP; -- Fim do Loop de Custos
END;
$$;

DO $$
BEGIN
  RAISE NOTICE 'FIX V4 (LOOP 12 MESES) APLICADO COM SUCESSO!';
END $$;
