-- Criar tabela de custos fixos
CREATE TABLE IF NOT EXISTS public.fixed_costs (
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

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_fixed_costs_user_id ON public.fixed_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_costs_due_day ON public.fixed_costs(due_day);
CREATE INDEX IF NOT EXISTS idx_fixed_costs_auto_generate ON public.fixed_costs(auto_generate) WHERE auto_generate = true;

-- Habilitar RLS
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: usuários podem ver apenas seus próprios custos fixos
CREATE POLICY "Usuários podem ver seus próprios custos fixos"
ON public.fixed_costs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios custos fixos"
ON public.fixed_costs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios custos fixos"
ON public.fixed_costs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios custos fixos"
ON public.fixed_costs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_fixed_costs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_fixed_costs_updated_at
  BEFORE UPDATE ON public.fixed_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fixed_costs_updated_at();
