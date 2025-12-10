-- Adicionar campos para rastrear despesas geradas de custos fixos

-- Adicionar coluna fixed_cost_id e status na tabela Financeiro Cartão
ALTER TABLE public."Financeiro Cartão" 
ADD COLUMN IF NOT EXISTS fixed_cost_id BIGINT REFERENCES public.fixed_costs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pago' CHECK (status IN ('pendente', 'pago'));

-- Adicionar coluna fixed_cost_id e status na tabela Financeiro Debito
ALTER TABLE public."Financeiro Debito" 
ADD COLUMN IF NOT EXISTS fixed_cost_id BIGINT REFERENCES public.fixed_costs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pago' CHECK (status IN ('pendente', 'pago'));

-- Criar índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_financeiro_cartao_fixed_cost_id 
ON public."Financeiro Cartão"(fixed_cost_id) WHERE fixed_cost_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_debito_fixed_cost_id 
ON public."Financeiro Debito"(fixed_cost_id) WHERE fixed_cost_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_cartao_status 
ON public."Financeiro Cartão"(status);

CREATE INDEX IF NOT EXISTS idx_financeiro_debito_status 
ON public."Financeiro Debito"(status);

-- Comentários para documentação
COMMENT ON COLUMN public."Financeiro Cartão".fixed_cost_id IS 'Referência ao custo fixo que gerou esta despesa automaticamente';
COMMENT ON COLUMN public."Financeiro Debito".fixed_cost_id IS 'Referência ao custo fixo que gerou esta despesa automaticamente';
COMMENT ON COLUMN public."Financeiro Cartão".status IS 'Status da despesa: pendente (gerada automaticamente) ou pago (registrada)';
COMMENT ON COLUMN public."Financeiro Debito".status IS 'Status da despesa: pendente (gerada automaticamente) ou pago (registrada)';
