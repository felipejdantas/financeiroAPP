-- Adicionar campos de configuração do período de faturamento na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN dia_inicio_fatura integer DEFAULT 1,
ADD COLUMN dia_fim_fatura integer DEFAULT 31;

-- Adicionar constraint para garantir dias válidos
ALTER TABLE public.profiles
ADD CONSTRAINT dia_inicio_fatura_valido CHECK (dia_inicio_fatura >= 1 AND dia_inicio_fatura <= 31),
ADD CONSTRAINT dia_fim_fatura_valido CHECK (dia_fim_fatura >= 1 AND dia_fim_fatura <= 31);