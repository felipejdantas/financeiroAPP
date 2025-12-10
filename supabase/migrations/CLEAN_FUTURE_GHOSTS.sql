-- ============================================================================
-- SCRIPT: LIMPEZA ESPECÍFICA DE JANEIRO/2026 E DEZEMBRO/2026
-- ============================================================================
-- Se o sistema diz que já gerou, mas não aparece, pode ser um registro 'fantasma'
-- ou com status errado. Vamos limpar TUDO de pendência nesses meses para obrigar
-- o frontend a gerar de novo.

-- 1. Limpar JANEIRO/2026
DELETE FROM "Financeiro Cartão" 
WHERE status = 'pendente' AND "Data" LIKE '%/01/2026%';

DELETE FROM "Financeiro Debito" 
WHERE status = 'pendente' AND "Data" LIKE '%/01/2026%';

-- 2. Limpar DEZEMBRO/2026
DELETE FROM "Financeiro Cartão" 
WHERE status = 'pendente' AND "Data" LIKE '%/12/2026%';

DELETE FROM "Financeiro Debito" 
WHERE status = 'pendente' AND "Data" LIKE '%/12/2026%';

-- 3. Limpar JANEIRO/2027 (Só por garantia da virada de ano)
DELETE FROM "Financeiro Cartão" 
WHERE status = 'pendente' AND "Data" LIKE '%/01/2027%';

DELETE FROM "Financeiro Debito" 
WHERE status = 'pendente' AND "Data" LIKE '%/01/2027%';
