ALTER TABLE periodos_mensais_cartao
  ADD COLUMN banco_cartao text NOT NULL DEFAULT 'Santander';

ALTER TABLE periodos_mensais_cartao
  ADD CONSTRAINT periodos_mensais_cartao_banco_check CHECK (banco_cartao IN ('Santander', 'Inter'));

ALTER TABLE periodos_mensais_cartao
  DROP CONSTRAINT periodos_mensais_cartao_user_id_mes_ano_key;

ALTER TABLE periodos_mensais_cartao
  ADD CONSTRAINT periodos_mensais_cartao_user_mes_ano_banco_key UNIQUE (user_id, mes_referencia, ano_referencia, banco_cartao);
