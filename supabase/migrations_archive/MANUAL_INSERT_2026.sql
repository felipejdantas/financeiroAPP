-- ============================================================================
-- SCRIPT: FORÇAR GERAÇÃO DE JANEIRO E DEZEMBRO DE 2026
-- ============================================================================
-- Este script percorre todos os custos fixos cadastrados e verifica se
-- existem lançamentos para Jan/2026 e Dez/2026. Se não existirem, CRIA NA MARRA.

DO $$
DECLARE
    r_cost RECORD;
    v_jan_26 DATE;
    v_dec_26 DATE;
    v_safe_day INT;
    v_target DATE;
    v_exists INT;
    v_inserted_jan INT := 0;
    v_inserted_dec INT := 0;
BEGIN
    FOR r_cost IN SELECT * FROM fixed_costs LOOP
        
        -- ====================================================================
        -- 1. VERIFICAR E CRIAR JANEIRO DE 2026
        -- ====================================================================
        v_exists := 0;
        
        -- Checa Cartão
        SELECT COUNT(*) INTO v_exists FROM "Financeiro Cartão" 
        WHERE fixed_cost_id = r_cost.id AND "Data" LIKE '%/01/2026%';
        
        IF v_exists = 0 THEN
             -- Checa Débito
             SELECT COUNT(*) INTO v_exists FROM "Financeiro Debito" 
             WHERE fixed_cost_id = r_cost.id AND "Data" LIKE '%/01/2026%';
        END IF;

        IF v_exists = 0 THEN
             -- Calcula Data Segura (Jan = 31 dias)
             v_safe_day := LEAST(r_cost.due_day, 31); 
             v_target := make_date(2026, 1, v_safe_day);
             
             -- Insere
             IF r_cost.payment_method = 'Crédito' THEN
                INSERT INTO "Financeiro Cartão" (user_id, "Responsavel", "Tipo", "Categoria", "Parcelas", "Descrição", "Data", "valor", "status", "fixed_cost_id", created_at)
                VALUES (r_cost.user_id, 'Sistema', 'Crédito', r_cost.category, 'A vista', r_cost.title || ' (Custo Fixo)', to_char(v_target, 'DD/MM/YYYY'), r_cost.amount, 'pendente', r_cost.id, NOW());
             ELSE
                INSERT INTO "Financeiro Debito" (user_id, "Responsavel", "Tipo", "Categoria", "Parcelas", "Descrição", "Data", "valor", "status", "fixed_cost_id", created_at)
                VALUES (r_cost.user_id, 'Sistema', COALESCE(r_cost.payment_method, 'Débito'), r_cost.category, 'A vista', r_cost.title || ' (Custo Fixo)', to_char(v_target, 'DD/MM/YYYY'), r_cost.amount, 'pendente', r_cost.id, NOW());
             END IF;
             
             v_inserted_jan := v_inserted_jan + 1;
             RAISE NOTICE 'Criado Janeiro/2026 para: %', r_cost.title;
        END IF;

        -- ====================================================================
        -- 2. VERIFICAR E CRIAR DEZEMBRO DE 2026
        -- ====================================================================
        v_exists := 0;
        
        SELECT COUNT(*) INTO v_exists FROM "Financeiro Cartão" 
        WHERE fixed_cost_id = r_cost.id AND "Data" LIKE '%/12/2026%';
        
        IF v_exists = 0 THEN
             SELECT COUNT(*) INTO v_exists FROM "Financeiro Debito" 
             WHERE fixed_cost_id = r_cost.id AND "Data" LIKE '%/12/2026%';
        END IF;

        IF v_exists = 0 THEN
             -- Calcula Data Segura (Dez = 31 dias)
             v_safe_day := LEAST(r_cost.due_day, 31); 
             v_target := make_date(2026, 12, v_safe_day);
             
             -- Insere
             IF r_cost.payment_method = 'Crédito' THEN
                INSERT INTO "Financeiro Cartão" (user_id, "Responsavel", "Tipo", "Categoria", "Parcelas", "Descrição", "Data", "valor", "status", "fixed_cost_id", created_at)
                VALUES (r_cost.user_id, 'Sistema', 'Crédito', r_cost.category, 'A vista', r_cost.title || ' (Custo Fixo)', to_char(v_target, 'DD/MM/YYYY'), r_cost.amount, 'pendente', r_cost.id, NOW());
             ELSE
                INSERT INTO "Financeiro Debito" (user_id, "Responsavel", "Tipo", "Categoria", "Parcelas", "Descrição", "Data", "valor", "status", "fixed_cost_id", created_at)
                VALUES (r_cost.user_id, 'Sistema', COALESCE(r_cost.payment_method, 'Débito'), r_cost.category, 'A vista', r_cost.title || ' (Custo Fixo)', to_char(v_target, 'DD/MM/YYYY'), r_cost.amount, 'pendente', r_cost.id, NOW());
             END IF;
             
             v_inserted_dec := v_inserted_dec + 1;
             RAISE NOTICE 'Criado Dezembro/2026 para: %', r_cost.title;
        END IF;

    END LOOP;
    
    RAISE NOTICE 'Concluído. Jan/2026 criados: %, Dez/2026 criados: %', v_inserted_jan, v_inserted_dec;
END $$;
