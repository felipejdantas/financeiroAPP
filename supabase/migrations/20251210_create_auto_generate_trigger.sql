-- Trigger para gerar automaticamente despesas futuras ao criar/atualizar custo fixo

-- Função que será chamada pelo trigger
CREATE OR REPLACE FUNCTION public.auto_generate_fixed_cost_expenses()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Só gera se auto_generate estiver ativo
  IF NEW.auto_generate = true THEN
    -- Chamar a função de geração
    SELECT * INTO v_result 
    FROM public.generate_future_fixed_costs(NEW.user_id, 12);
    
    RAISE NOTICE 'Auto-geração: %', v_result.message;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para INSERT (novo custo fixo)
CREATE TRIGGER trigger_auto_generate_on_insert
  AFTER INSERT ON public.fixed_costs
  FOR EACH ROW
  WHEN (NEW.auto_generate = true)
  EXECUTE FUNCTION public.auto_generate_fixed_cost_expenses();

-- Trigger para UPDATE (quando ativa auto_generate ou muda valores)
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

-- Comentários
COMMENT ON FUNCTION public.auto_generate_fixed_cost_expenses IS 
'Trigger function que gera automaticamente despesas futuras quando um custo fixo é criado ou atualizado';
