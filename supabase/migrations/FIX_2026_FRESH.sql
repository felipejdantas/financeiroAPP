-- ============================================================================
-- SCRIPT: REGENERAÇÃO TOTAL DE 2026 (CLEAN SLATE)
-- ============================================================================
-- Este script apaga TODAS as pendências de Custo Fixo de 2026 e as recria.
-- Garante formato DD/MM/YYYY que o Dashboard exige.

DO $$
DECLARE
    r_cost RECORD;
    i INT;
    v_target DATE;
    v_date_str TEXT;
    v_count_del INT := 0;
    v_count_ins INT := 0;
BEGIN
    -- 1. APAGAR TUDO DE 2026 (PENDENTE + CUSTO FIXO)
    -- Apaga tanto quem tem /2026 quanto 2026- (formatos variados)
    DELETE FROM "Financeiro Cartão" 
    WHERE status = 'pendente' 
      AND "Descrição" ILIKE '%(Custo Fixo)%' 
      AND ("Data" LIKE '%/2026%' OR "Data" LIKE '2026-%');

    DELETE FROM "Financeiro Debito" 
    WHERE status = 'pendente' 
      AND "Descrição" ILIKE '%(Custo Fixo)%' 
      AND ("Data" LIKE '%/2026%' OR "Data" LIKE '2026-%');

    RAISE NOTICE 'Limpeza de 2026 concluída.';

    -- 2. REGERAR JANEIRO A DEZEMBRO DE 2026
    FOR r_cost IN SELECT * FROM fixed_costs LOOP
        
        -- Loop pelos 12 meses de 2026
        FOR i IN 1..12 LOOP
            -- Calcula data segura (DD/MM/YYYY)
            -- Ex: LEAST(30, last_day)
            v_target := make_date(2026, i, LEAST(r_cost.due_day, extract(day from (date_trunc('month', make_date(2026, I, 1)) + interval '1 month' - interval '1 day'))::int));
            v_date_str := to_char(v_target, 'DD/MM/YYYY');

            -- Insere
            IF r_cost.payment_method = 'Crédito' THEN
                INSERT INTO "Financeiro Cartão" (user_id, "Responsavel", "Tipo", "Categoria", "Parcelas", "Descrição", "Data", "valor", "status", "fixed_cost_id", created_at)
                VALUES (r_cost.user_id, 'Sistema', 'Crédito', r_cost.category, 'A vista', r_cost.title || ' (Custo Fixo)', v_date_str, r_cost.amount, 'pendente', r_cost.id, NOW());
            ELSE
                INSERT INTO "Financeiro Debito" (user_id, "Responsavel", "Tipo", "Categoria", "Parcelas", "Descrição", "Data", "valor", "status", "fixed_cost_id", created_at)
                VALUES (r_cost.user_id, 'Sistema', COALESCE(r_cost.payment_method, 'Débito'), r_cost.category, 'A vista', r_cost.title || ' (Custo Fixo)', v_date_str, r_cost.amount, 'pendente', r_cost.id, NOW());
            END IF;

            v_count_ins := v_count_ins + 1;
        END LOOP;
        
    END LOOP;
    
    RAISE NOTICE 'Regeneração concluída. Inseridos: % registros em 2026.', v_count_ins;
END $$;
