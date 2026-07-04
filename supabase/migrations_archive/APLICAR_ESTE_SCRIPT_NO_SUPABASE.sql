-- ============================================================================
-- SCRIPT CORRIGIDO: Aplicar migrations de Custos Fixos
-- Execute este script completo no Supabase Dashboard > SQL Editor
-- ============================================================================

-- ============================================================================
-- PASSO 0: LIMPAR TUDO (caso tenha executado antes com erro)
-- ============================================================================

-- Remover triggers primeiro
DROP TRIGGER IF EXISTS trigger_auto_generate_on_insert ON public.fixed_costs;
DROP TRIGGER IF EXISTS trigger_auto_generate_on_update ON public.fixed_costs;
DROP TRIGGER IF EXISTS update_fixed_costs_updated_at ON public.fixed_costs;

-- Remover funções com CASCADE para remover dependências
DROP FUNCTION IF EXISTS public.auto_generate_fixed_cost_expenses() CASCADE;
DROP FUNCTION IF EXISTS public.generate_future_fixed_costs(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS public.update_fixed_costs_updated_at() CASCADE;

-- Remover colunas das tabelas de despesas (se existirem)
ALTER TABLE public."Financeiro Cartão" DROP COLUMN IF EXISTS fixed_cost_id CASCADE;
ALTER TABLE public."Financeiro Cartão" DROP COLUMN IF EXISTS status CASCADE;
ALTER TABLE public."Financeiro Debito" DROP COLUMN IF EXISTS fixed_cost_id CASCADE;
ALTER TABLE public."Financeiro Debito" DROP COLUMN IF EXISTS status CASCADE;

-- Remover tabela fixed_costs (se existir)
DROP TABLE IF EXISTS public.fixed_costs CASCADE;

-- ============================================================================
-- PASSO 1: CRIAR TABELA FIXED_COSTS
-- ============================================================================

CREATE TABLE public.fixed_costs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL,
  due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  last_paid_date DATE,
  auto_generate BOOLEAN DEFAULT true,
  payment_method TEXT DEFAULT 'Débito' CHECK (payment_method IN ('Crédito', 'Débito', 'Pix', 'Dinheiro')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices
CREATE INDEX idx_fixed_costs_user_id ON public.fixed_costs(user_id);
CREATE INDEX idx_fixed_costs_due_day ON public.fixed_costs(due_day);
CREATE INDEX idx_fixed_costs_auto_generate ON public.fixed_costs(auto_generate) WHERE auto_generate = true;

-- Habilitar RLS
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver seus próprios custos fixos"
ON public.fixed_costs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios custos fixos"
ON public.fixed_costs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios custos fixos"
ON public.fixed_costs FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios custos fixos"
ON public.fixed_costs FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE FUNCTION public.update_fixed_costs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_fixed_costs_updated_at
  BEFORE UPDATE ON public.fixed_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fixed_costs_updated_at();

-- ============================================================================
-- PASSO 2: ADICIONAR CAMPOS NAS TABELAS DE DESPESAS
-- ============================================================================

ALTER TABLE public."Financeiro Cartão" 
ADD COLUMN fixed_cost_id BIGINT REFERENCES public.fixed_costs(id) ON DELETE SET NULL,
ADD COLUMN status TEXT DEFAULT 'pago' CHECK (status IN ('pendente', 'pago'));

ALTER TABLE public."Financeiro Debito" 
ADD COLUMN fixed_cost_id BIGINT REFERENCES public.fixed_costs(id) ON DELETE SET NULL,
ADD COLUMN status TEXT DEFAULT 'pago' CHECK (status IN ('pendente', 'pago'));

-- Criar índices
CREATE INDEX idx_financeiro_cartao_fixed_cost_id 
ON public."Financeiro Cartão"(fixed_cost_id) WHERE fixed_cost_id IS NOT NULL;

CREATE INDEX idx_financeiro_debito_fixed_cost_id 
ON public."Financeiro Debito"(fixed_cost_id) WHERE fixed_cost_id IS NOT NULL;

CREATE INDEX idx_financeiro_cartao_status 
ON public."Financeiro Cartão"(status);

CREATE INDEX idx_financeiro_debito_status 
ON public."Financeiro Debito"(status);

-- ============================================================================
-- PASSO 3: CRIAR FUNÇÃO PARA GERAR DESPESAS FUTURAS
-- ============================================================================

CREATE FUNCTION public.generate_future_fixed_costs(
  p_user_id UUID,
  p_months_ahead INT DEFAULT 12
)
RETURNS TABLE(generated_count INT, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fixed_cost RECORD;
  v_table_name TEXT;
  v_inserted_count INT := 0;
  v_exists BOOLEAN;
BEGIN
  -- Iterar sobre todos os custos fixos do usuário com auto_generate = true
  FOR v_fixed_cost IN 
    SELECT * FROM public.fixed_costs 
    WHERE user_id = p_user_id AND auto_generate = true
  LOOP
    -- Determinar a tabela baseada no método de pagamento
    v_table_name := CASE 
      WHEN v_fixed_cost.payment_method = 'Crédito' THEN 'Financeiro Cartão'
      ELSE 'Financeiro Debito'
    END;
    
    -- Verificar se já existe uma despesa pendente para este custo fixo
    IF v_table_name = 'Financeiro Cartão' THEN
      SELECT EXISTS(
        SELECT 1 FROM public."Financeiro Cartão"
        WHERE user_id = p_user_id
          AND fixed_cost_id = v_fixed_cost.id
          AND status = 'pendente'
      ) INTO v_exists;
    ELSE
      SELECT EXISTS(
        SELECT 1 FROM public."Financeiro Debito"
        WHERE user_id = p_user_id
          AND fixed_cost_id = v_fixed_cost.id
          AND status = 'pendente'
      ) INTO v_exists;
    END IF;

    -- Se não existe despesa pendente, criar uma nova
    IF NOT v_exists THEN
      IF v_table_name = 'Financeiro Cartão' THEN
        INSERT INTO public."Financeiro Cartão" (
          user_id, "Responsavel", "Tipo", "Categoria", "Parcelas", "Descrição",
          "Data", valor, status, fixed_cost_id, created_at
        ) VALUES (
          p_user_id, 'Sistema', v_fixed_cost.payment_method, v_fixed_cost.category,
          'A vista', v_fixed_cost.title || ' (Custo Fixo)',
          to_char(NOW(), 'DD/MM/YYYY'), v_fixed_cost.amount,
          'pendente', v_fixed_cost.id, NOW()
        );
      ELSE
        INSERT INTO public."Financeiro Debito" (
          user_id, "Responsavel", "Tipo", "Categoria", "Parcelas", "Descrição",
          "Data", valor, status, fixed_cost_id, created_at
        ) VALUES (
          p_user_id, 'Sistema', v_fixed_cost.payment_method, v_fixed_cost.category,
          'A vista', v_fixed_cost.title || ' (Custo Fixo)',
          to_char(NOW(), 'DD/MM/YYYY'), v_fixed_cost.amount,
          'pendente', v_fixed_cost.id, NOW()
        );
      END IF;
      
      v_inserted_count := v_inserted_count + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_inserted_count, 
    CASE 
      WHEN v_inserted_count = 0 THEN 'Nenhuma despesa nova gerada (todas já existem)'
      WHEN v_inserted_count = 1 THEN '1 despesa gerada com sucesso'
      ELSE v_inserted_count || ' despesas geradas com sucesso'
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_future_fixed_costs TO authenticated;

-- ============================================================================
-- PASSO 4: CRIAR TRIGGERS PARA GERAÇÃO AUTOMÁTICA
-- ============================================================================

CREATE FUNCTION public.auto_generate_fixed_cost_expenses()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result RECORD;
BEGIN
  IF NEW.auto_generate = true THEN
    -- Chamar a função de geração (parâmetro months_ahead é ignorado agora)
    SELECT * INTO v_result 
    FROM public.generate_future_fixed_costs(NEW.user_id, 1);
    
    RAISE NOTICE 'Auto-geração: %', v_result.message;
  END IF;
  
  RETURN NEW;
END;
$$;

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

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Script executado com sucesso!';
  RAISE NOTICE '✅ Tabela fixed_costs criada';
  RAISE NOTICE '✅ Colunas adicionadas nas tabelas de despesas';
  RAISE NOTICE '✅ Função generate_future_fixed_costs criada';
  RAISE NOTICE '✅ Triggers configurados';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Agora você pode salvar custos fixos na aplicação!';
END $$;
