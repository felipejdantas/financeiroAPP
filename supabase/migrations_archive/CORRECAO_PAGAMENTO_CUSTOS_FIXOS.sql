-- ============================================================================
-- SCRIPT DE CORREÇÃO: LÓGICA DE PAGAMENTO E GERAÇÃO INTELIGENTE
-- ============================================================================
-- Este script:
-- 1. Cria uma lógica para "entender" quando você paga uma conta manualmente.
-- 2. Remove automticamente a despesa pendente correspondente.
-- 3. Gera a próxima despesa pendente para o mês seguinte.

-- 1. Função para encontrar e limpar pendências quando uma despesa é paga
CREATE OR REPLACE FUNCTION public.handle_fixed_cost_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fixed_cost_id BIGINT;
  v_pending_id BIGINT;
  v_pending_date DATE;
BEGIN
  -- Só executa se a despesa NÃO for pendente (ou seja, é um pagamento real)
  IF NEW.status IS NULL OR NEW.status != 'pendente' THEN
    
    -- Tenta encontrar uma despesa pendente que combine com esta (mesmo valor e descrição parecida)
    -- Procura em AMBAS as tabelas
    
    -- 1. Procura no Cartão
    SELECT id, fixed_cost_id INTO v_pending_id, v_fixed_cost_id
    FROM "Financeiro Cartão"
    WHERE status = 'pendente'
      AND (
        fixed_cost_id IS NOT NULL AND fixed_cost_id = NEW.fixed_cost_id -- Se já tiver ID vinculado
        OR 
        (ABS(valor - NEW.valor) < 1.0 AND "Descrição" ILIKE NEW."Descrição") -- Ou valor próximo e mesmo nome
      )
    LIMIT 1;

    -- 2. Se não achou, procura no Débito
    IF v_pending_id IS NULL THEN
        SELECT id, fixed_cost_id INTO v_pending_id, v_fixed_cost_id
        FROM "Financeiro Debito"
        WHERE status = 'pendente'
        AND (
            fixed_cost_id IS NOT NULL AND fixed_cost_id = NEW.fixed_cost_id
            OR 
            (ABS(valor - NEW.valor) < 1.0 AND "Descrição" ILIKE NEW."Descrição")
        )
        LIMIT 1;
    END IF;

    -- Se encontrou uma pendência correspondente
    IF v_pending_id IS NOT NULL THEN
      -- 1. Atualiza a despesa NOVA com o fixed_cost_id (vínculo)
      IF NEW.fixed_cost_id IS NULL AND v_fixed_cost_id IS NOT NULL THEN
        NEW.fixed_cost_id := v_fixed_cost_id;
      END IF;

      -- 2. Deleta a despesa PENDENTE antiga (ela foi substituída por esta paga)
      DELETE FROM "Financeiro Cartão" WHERE id = v_pending_id;
      DELETE FROM "Financeiro Debito" WHERE id = v_pending_id;
      
      -- 3. Gera a próxima pendência (Mês seguinte)
      IF v_fixed_cost_id IS NOT NULL THEN
          PERFORM public.generate_future_fixed_costs(NEW.user_id, 1);
      END IF;
      
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Recriar Trigger para usar essa função em ambas as tabelas
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


-- 3. Atualizar a função de geração para ser mais inteligente com datas
-- Precisamos dropar antes pois mudamos o tipo de retorno ou lógica interna que o Postgres reclama
DROP FUNCTION IF EXISTS public.generate_future_fixed_costs(uuid, integer) CASCADE;

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
        
        -- Lógica Robusta de Data:
        -- 1. Começa no dia 1 do mês atual
        v_target_date := make_date(extract(year from current_date)::int, extract(month from current_date)::int, 1);
        
        -- Verifica pagamento no mês atual
        v_month_paid := false;
        -- ... (lógica de verificação mantida, simplificada abaixo para clareza no diff) ...
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

        -- Se pagou, avança para o próximo mês
        IF v_month_paid THEN
            v_target_date := v_target_date + INTERVAL '1 month';
        END IF;

        -- AGORA aplica o dia de vencimento com segurança (evita 30/02, 29/02 em ano não bissexto)
        DECLARE
           v_last_day_month DATE;
           v_safe_day INTEGER;
        BEGIN
           -- Calcula o último dia do mês alvo
           v_last_day_month := (date_trunc('month', v_target_date) + interval '1 month' - interval '1 day')::date;
           -- Pega o menor entre o dia de vencimento desejado e o último dia do mês
           v_safe_day := LEAST(v_due_day, extract(day from v_last_day_month)::int);
           -- Reconstrói a data segura
           v_target_date := make_date(extract(year from v_target_date)::int, extract(month from v_target_date)::int, v_safe_day);
        END;

        -- Formata data para string BR
        DECLARE
           v_data_str TEXT := to_char(v_target_date, 'DD/MM/YYYY');
        BEGIN
            -- Verifica se já existe Pendente para evitar duplicata
            v_exists := false;
            
            PERFORM 1 FROM "Financeiro Cartão" WHERE user_id = p_user_id AND fixed_cost_id = r_fixed_cost.id AND status = 'pendente';
            IF FOUND THEN v_exists := true; END IF;
            
            IF NOT v_exists THEN
                PERFORM 1 FROM "Financeiro Debito" WHERE user_id = p_user_id AND fixed_cost_id = r_fixed_cost.id AND status = 'pendente';
                IF FOUND THEN v_exists := true; END IF;
            END IF;

            -- INSERIR A PENDÊNCIA (se não existir nenhuma pendente)
            -- A lógica aqui é: Só deve haver UMA pendência ativa por Custo Fixo.
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
                    v_data_str, -- Data calculada (Este mês ou Próximo)
                    r_fixed_cost.title, 
                    'Sistema', 
                    r_fixed_cost.payment_method, 
                    r_fixed_cost.category, 
                    'Fixa', 
                    r_fixed_cost.amount, 
                    CASE WHEN r_fixed_cost.payment_method = 'Crédito' THEN 'Aberta' ELSE NULL END,
                    r_fixed_cost.id, 
                    'pendente';
                    
                RETURN QUERY SELECT 'Gerado para ' || v_data_str || ': ' || r_fixed_cost.title;
            END IF;
        END;
    END LOOP;
END;
$$;

-- 4. Limpeza RETROATIVA de duplicatas (Executar agora para consertar o estado atual)
DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Limpa Cartão
  DELETE FROM "Financeiro Cartão" p
  WHERE status = 'pendente'
  AND EXISTS (
    SELECT 1 FROM "Financeiro Cartão" real
    WHERE (real.status IS NULL OR real.status != 'pendente')
    AND (
       real.id != p.id -- garante que não é a mesma linha (embora status seja dif)
       AND (
          (real.fixed_cost_id IS NOT NULL AND real.fixed_cost_id = p.fixed_cost_id)
          OR (real."Descrição" ILIKE p."Descrição" AND ABS(real.valor - p.valor) < 1.0)
       )
    )
    -- Verifica mês (se pagou NO MESMO MÊS da pendência)
    AND date_trunc('month', to_date(real."Data", 'DD/MM/YYYY')) = date_trunc('month', to_date(p."Data", 'DD/MM/YYYY'))
  );

  -- Limpa Débito
  DELETE FROM "Financeiro Debito" p
  WHERE status = 'pendente'
  AND EXISTS (
    SELECT 1 FROM "Financeiro Debito" real
    WHERE (real.status IS NULL OR real.status != 'pendente')
    AND (
       real.id != p.id 
       AND (
          (real.fixed_cost_id IS NOT NULL AND real.fixed_cost_id = p.fixed_cost_id)
          OR (real."Descrição" ILIKE p."Descrição" AND ABS(real.valor - p.valor) < 1.0)
       )
    )
    AND date_trunc('month', to_date(real."Data", 'DD/MM/YYYY')) = date_trunc('month', to_date(p."Data", 'DD/MM/YYYY'))
  );
  
END $$;
