-- Adiciona colunas para datas específicas do período do cartão
ALTER TABLE public.profiles
ADD COLUMN data_inicio_cartao DATE,
ADD COLUMN data_fim_cartao DATE;