ALTER TABLE "Financeiro Cartão"
  ADD COLUMN banco_cartao text NOT NULL DEFAULT 'Santander';

ALTER TABLE "Financeiro Cartão"
  ADD CONSTRAINT financeiro_cartao_banco_check CHECK (banco_cartao IN ('Santander', 'Inter'));
