-- Resetar a sequência de IDs da tabela Financeiro Debito
SELECT setval(
  pg_get_serial_sequence('"Financeiro Debito"', 'id'),
  COALESCE((SELECT MAX(id) FROM "Financeiro Debito"), 1),
  true
);

-- Resetar a sequência de IDs da tabela Financeiro Cartão (preventivo)
SELECT setval(
  pg_get_serial_sequence('"Financeiro Cartão"', 'id'),
  COALESCE((SELECT MAX(id) FROM "Financeiro Cartão"), 1),
  true
);