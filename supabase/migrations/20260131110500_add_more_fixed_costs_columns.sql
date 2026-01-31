-- Adiciona colunas para rastreamento de pagamento (Amounts e Dates)
alter table fixed_costs add column if not exists last_paid_amount numeric;
alter table fixed_costs add column if not exists last_paid_at timestamp with time zone;
