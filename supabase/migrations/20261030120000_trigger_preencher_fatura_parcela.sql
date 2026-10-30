-- Preenche mes_fatura/ano_fatura de parcelas de cartao no proprio banco, pra qualquer origem do insert.
-- O formulario do app ja calcula isso (Expenses.tsx), mas parcelas lancadas pelo agente n8n/Telegram
-- chegavam com a etiqueta NULL e a tabela nao mostrava o mes da fatura ao lado da Data.
-- Mesma regra do app: a 1a parcela pertence ao periodo (periodos_mensais_cartao) que contem a data da
-- compra; a parcela k avanca k-1 faturas a partir dali. Sem periodo configurado, cai no mes calendario.
-- So age quando a etiqueta vem vazia e Parcelas e "k/n" com n > 1 (igual ao app, que nao marca a vista).
CREATE OR REPLACE FUNCTION public.preencher_fatura_parcela()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  partes text[];
  parcela_atual int;
  total_parcelas int;
  data_parcela date;
  data_compra date;
  mes_inicial int;
  ano_inicial int;
  mes_absoluto int;
BEGIN
  IF NEW.mes_fatura IS NOT NULL OR NEW.ano_fatura IS NOT NULL THEN
    RETURN NEW;
  END IF;

  partes := regexp_match(coalesce(NEW."Parcelas", ''), '^\s*(\d+)\s*/\s*(\d+)\s*$');
  IF partes IS NULL THEN
    RETURN NEW;
  END IF;
  parcela_atual := partes[1]::int;
  total_parcelas := partes[2]::int;
  IF total_parcelas <= 1 OR parcela_atual < 1 THEN
    RETURN NEW;
  END IF;

  BEGIN
    data_parcela := to_date(NEW."Data", 'DD/MM/YYYY');
  EXCEPTION WHEN others THEN
    RETURN NEW;
  END;

  data_compra := (data_parcela - make_interval(months => parcela_atual - 1))::date;

  SELECT p.mes_referencia, p.ano_referencia
    INTO mes_inicial, ano_inicial
    FROM periodos_mensais_cartao p
   WHERE p.user_id = NEW.user_id
     AND p.banco_cartao = NEW.banco_cartao
     AND p.data_inicio <= data_compra
     AND p.data_fim >= data_compra
   LIMIT 1;

  IF mes_inicial IS NULL THEN
    mes_inicial := extract(month FROM data_compra)::int;
    ano_inicial := extract(year FROM data_compra)::int;
  END IF;

  mes_absoluto := mes_inicial - 1 + parcela_atual - 1;
  NEW.mes_fatura := (mes_absoluto % 12) + 1;
  NEW.ano_fatura := ano_inicial + (mes_absoluto / 12);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preencher_fatura_parcela ON "Financeiro Cartão";
CREATE TRIGGER trg_preencher_fatura_parcela
  BEFORE INSERT ON "Financeiro Cartão"
  FOR EACH ROW EXECUTE FUNCTION public.preencher_fatura_parcela();
