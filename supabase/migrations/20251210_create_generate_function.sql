-- Função para gerar despesas futuras baseadas em custos fixos
CREATE OR REPLACE FUNCTION public.generate_future_fixed_costs(
  p_user_id UUID,
  p_months_ahead INT DEFAULT 12
)
RETURNS TABLE(
  generated_count INT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fixed_cost RECORD;
  v_month_offset INT;
  v_target_date DATE;
  v_target_year INT;
  v_target_month INT;
  v_target_day INT;
  v_table_name TEXT;
  v_inserted_count INT := 0;
  v_exists BOOLEAN;
BEGIN
  -- Validar parâmetros
  IF p_months_ahead < 1 OR p_months_ahead > 24 THEN
    RAISE EXCEPTION 'months_ahead deve estar entre 1 e 24';
  END IF;

  -- Iterar sobre todos os custos fixos do usuário com auto_generate = true
  FOR v_fixed_cost IN 
    SELECT * FROM public.fixed_costs 
    WHERE user_id = p_user_id AND auto_generate = true
  LOOP
    -- Gerar despesas para os próximos N meses
    FOR v_month_offset IN 0..(p_months_ahead - 1) LOOP
      -- Calcular a data alvo
      v_target_year := EXTRACT(YEAR FROM (CURRENT_DATE + (v_month_offset || ' months')::INTERVAL));
      v_target_month := EXTRACT(MONTH FROM (CURRENT_DATE + (v_month_offset || ' months')::INTERVAL));
      v_target_day := LEAST(v_fixed_cost.due_day, 
                            EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE + (v_month_offset || ' months')::INTERVAL) + INTERVAL '1 month - 1 day')::DATE));
      
      v_target_date := make_date(v_target_year, v_target_month, v_target_day);

      -- Determinar a tabela baseada no método de pagamento
      v_table_name := CASE 
        WHEN v_fixed_cost.payment_method = 'Crédito' THEN 'Financeiro Cartão'
        ELSE 'Financeiro Debito'
      END;

      -- Verificar se já existe uma despesa para este custo fixo nesta data
      IF v_table_name = 'Financeiro Cartão' THEN
        SELECT EXISTS(
          SELECT 1 FROM public."Financeiro Cartão"
          WHERE user_id = p_user_id
            AND fixed_cost_id = v_fixed_cost.id
            AND Data = to_char(v_target_date, 'DD/MM/YYYY')
        ) INTO v_exists;
      ELSE
        SELECT EXISTS(
          SELECT 1 FROM public."Financeiro Debito"
          WHERE user_id = p_user_id
            AND fixed_cost_id = v_fixed_cost.id
            AND Data = to_char(v_target_date, 'DD/MM/YYYY')
        ) INTO v_exists;
      END IF;

      -- Se não existe, inserir
      IF NOT v_exists THEN
        IF v_table_name = 'Financeiro Cartão' THEN
          INSERT INTO public."Financeiro Cartão" (
            user_id,
            Responsavel,
            Tipo,
            Categoria,
            Parcelas,
            "Descrição",
            Data,
            valor,
            status,
            fixed_cost_id,
            created_at
          ) VALUES (
            p_user_id,
            'Sistema',
            v_fixed_cost.payment_method,
            v_fixed_cost.category,
            'A vista',
            v_fixed_cost.title || ' (Custo Fixo)',
            to_char(v_target_date, 'DD/MM/YYYY'),
            v_fixed_cost.amount,
            'pendente',
            v_fixed_cost.id,
            NOW()
          );
        ELSE
          INSERT INTO public."Financeiro Debito" (
            user_id,
            Responsavel,
            Tipo,
            Categoria,
            Parcelas,
            "Descrição",
            Data,
            valor,
            status,
            fixed_cost_id,
            created_at
          ) VALUES (
            p_user_id,
            'Sistema',
            v_fixed_cost.payment_method,
            v_fixed_cost.category,
            'A vista',
            v_fixed_cost.title || ' (Custo Fixo)',
            to_char(v_target_date, 'DD/MM/YYYY'),
            v_fixed_cost.amount,
            'pendente',
            v_fixed_cost.id,
            NOW()
          );
        END IF;
        
        v_inserted_count := v_inserted_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  -- Retornar resultado
  RETURN QUERY SELECT v_inserted_count, 
    CASE 
      WHEN v_inserted_count = 0 THEN 'Nenhuma despesa nova gerada (todas já existem)'
      WHEN v_inserted_count = 1 THEN '1 despesa gerada com sucesso'
      ELSE v_inserted_count || ' despesas geradas com sucesso'
    END;
END;
$$;

-- Comentário da função
COMMENT ON FUNCTION public.generate_future_fixed_costs IS 
'Gera despesas futuras baseadas em custos fixos com auto_generate=true. Evita duplicatas verificando fixed_cost_id e Data.';

-- Conceder permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION public.generate_future_fixed_costs TO authenticated;
