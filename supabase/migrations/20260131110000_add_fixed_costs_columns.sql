-- Adiciona coluna de Responsável
alter table fixed_costs add column if not exists responsavel text default 'Felipe';

-- Adiciona coluna de Competência (Mês de Referência)
alter table fixed_costs add column if not exists last_paid_competence date;
