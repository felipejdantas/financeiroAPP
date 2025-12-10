-- Script para verificar as colunas das tabelas de despesas
-- Execute no Supabase SQL Editor para ver os nomes exatos das colunas

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Financeiro Debito'
ORDER BY ordinal_position;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Financeiro Cartão'
ORDER BY ordinal_position;
