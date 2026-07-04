-- Script para limpar períodos mensais duplicados
-- Este script deve ser executado no SQL Editor do Supabase

-- 1. Primeiro, vamos ver quais duplicatas existem (apenas para referência)
-- SELECT user_id, mes_referencia, COUNT(*) as count
-- FROM periodos_mensais_cartao
-- GROUP BY user_id, mes_referencia
-- HAVING COUNT(*) > 1;

-- 2. Deletar registros duplicados, mantendo apenas o mais recente (maior ID)
DELETE FROM periodos_mensais_cartao
WHERE id NOT IN (
  SELECT MAX(id)
  FROM periodos_mensais_cartao
  GROUP BY user_id, mes_referencia
);

-- 3. Adicionar constraint única para evitar duplicatas futuras
ALTER TABLE periodos_mensais_cartao
ADD CONSTRAINT periodos_mensais_cartao_user_mes_unique 
UNIQUE (user_id, mes_referencia);

-- 4. Verificar se ainda existem duplicatas (deve retornar 0 linhas)
SELECT user_id, mes_referencia, COUNT(*) as count
FROM periodos_mensais_cartao
GROUP BY user_id, mes_referencia
HAVING COUNT(*) > 1;
