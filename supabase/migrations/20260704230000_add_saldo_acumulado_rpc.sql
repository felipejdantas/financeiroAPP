-- Helper: parse a "DD/MM/YYYY" text date, returning NULL instead of raising
-- on malformed values (e.g. "29/02/2026", which isn't a leap year). This
-- mirrors the client's behavior, where an invalid Date's getTime() is NaN
-- and NaN <= x is false, so the row is silently excluded either way.
create or replace function fin_safe_parse_br_date(txt text)
returns date
language plpgsql
immutable
as $$
begin
  return to_date(txt, 'DD/MM/YYYY');
exception when others then
  return null;
end;
$$;

-- Computes the accumulated balance (Saldo) up to a given date, mirroring
-- Dashboard.tsx's calcularSaldoAcumulado: all revenue up to the cutoff date,
-- minus non-pending Pix/Débito/Dinheiro expenses up to the cutoff date.
-- Credit card ("Crédito") expenses are intentionally excluded, matching the
-- existing client-side business rule.
create or replace function fin_calcular_saldo_acumulado(p_user_id uuid, p_data_limite date)
returns numeric
language sql
stable
as $$
  with despesas_uniao as (
    select "Data", "Tipo", status, valor from "Financeiro Cartão" where user_id = p_user_id
    union all
    select "Data", "Tipo", status, valor from "Financeiro Debito" where user_id = p_user_id
  )
  select
    coalesce((
      select sum(valor) from "Financeiro Receita"
      where user_id = p_user_id
        and fin_safe_parse_br_date("Data") <= p_data_limite
    ), 0)
    -
    coalesce((
      select sum(valor) from despesas_uniao
      where coalesce(status, '') <> 'pendente'
        and "Tipo" in ('Pix', 'Débito', 'Dinheiro', 'pix', 'débito', 'dinheiro')
        and fin_safe_parse_br_date("Data") <= p_data_limite
    ), 0);
$$;

grant execute on function fin_calcular_saldo_acumulado(uuid, date) to authenticated;
