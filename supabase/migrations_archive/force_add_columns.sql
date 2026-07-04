-- SCRIPT DE CORREÇÃO URGENTE
-- Execute este script no SQL Editor do Supabase para criar as colunas que faltam

ALTER TABLE public.periodos_mensais_cartao 
ADD COLUMN IF NOT EXISTS data_inicio DATE;

ALTER TABLE public.periodos_mensais_cartao 
ADD COLUMN IF NOT EXISTS data_fim DATE;

ALTER TABLE public.periodos_mensais_cartao 
ADD COLUMN IF NOT EXISTS nome_periodo VARCHAR(100);

-- Atualiza o cache do esquema para garantir que o Supabase veja as novas colunas
NOTIFY pgrst, 'reload config';
