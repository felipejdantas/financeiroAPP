-- Migrar registros de pix, dinheiro e debito da tabela Cartão para Debito
INSERT INTO "Financeiro Debito" (
  "Tipo",
  "valor",
  "Responsavel",
  "user_id",
  "Categoria",
  "Parcelas",
  "Descrição",
  "Data"
)
SELECT 
  "Tipo",
  "valor",
  "Responsavel",
  "user_id",
  "Categoria",
  "Parcelas",
  "Descrição",
  "Data"
FROM "Financeiro Cartão"
WHERE "Tipo" IN ('pix', 'dinheiro', 'debito');

-- Deletar os registros migrados da tabela Cartão
DELETE FROM "Financeiro Cartão"
WHERE "Tipo" IN ('pix', 'dinheiro', 'debito');