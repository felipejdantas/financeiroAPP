-- Cria tabela para armazenar períodos mensais do cartão
CREATE TABLE public.periodos_mensais_cartao (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  mes_referencia INTEGER NOT NULL CHECK (mes_referencia >= 1 AND mes_referencia <= 12),
  dia_inicio INTEGER NOT NULL CHECK (dia_inicio >= 1 AND dia_inicio <= 31),
  mes_inicio_offset INTEGER NOT NULL DEFAULT 0,
  dia_fim INTEGER NOT NULL CHECK (dia_fim >= 1 AND dia_fim <= 31),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, mes_referencia)
);

-- Habilita RLS
ALTER TABLE public.periodos_mensais_cartao ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver seus próprios períodos"
ON public.periodos_mensais_cartao
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios períodos"
ON public.periodos_mensais_cartao
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios períodos"
ON public.periodos_mensais_cartao
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios períodos"
ON public.periodos_mensais_cartao
FOR DELETE
USING (auth.uid() = user_id);

-- Insere períodos padrão para facilitar (usuário pode editar depois)
-- Exemplo: outubro (mês 10) = 25/09 até 26/10 (início é no mês anterior, offset -1)
-- mes_referencia é o mês da fatura
COMMENT ON COLUMN public.periodos_mensais_cartao.mes_referencia IS 'Mês da fatura (1-12)';
COMMENT ON COLUMN public.periodos_mensais_cartao.mes_inicio_offset IS 'Offset do mês de início (-1 = mês anterior, 0 = mesmo mês)';
COMMENT ON COLUMN public.periodos_mensais_cartao.dia_inicio IS 'Dia do mês de início';
COMMENT ON COLUMN public.periodos_mensais_cartao.dia_fim IS 'Dia do mês de fim';