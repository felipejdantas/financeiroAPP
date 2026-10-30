-- Trava contra apagar/atualizar em massa vindo do agente do Telegram (n8n).
--
-- Incidente de 30/10/2026 (execução n8n 141656): o "Fin delete cartao", chamado com um id só,
-- apagou os 388 lançamentos de crédito do usuário — o filtro de id foi ignorado e sobrou só o
-- filtro de user_id. A causa dentro do n8n não ficou clara, então a proteção fica aqui no banco:
--
-- O n8n usa a chave service_role. Toda ferramenta de apagar/atualizar do agente mexe em UM registro
-- por vez; se um comando vindo com essa chave tentar apagar ou atualizar mais de um registro, o
-- comando inteiro é desfeito com erro. O app (chave do usuário logado, role authenticated) não é
-- afetado — a edição/exclusão em massa da tela de Despesas continua funcionando.

CREATE OR REPLACE FUNCTION public.fin_bloquear_alteracao_em_massa_bot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_qtd integer;
BEGIN
    -- Fora da API (SQL Editor, migrations) não há JWT e a trava não se aplica.
    IF COALESCE(
           NULLIF(current_setting('request.jwt.claim.role', true), ''),
           NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'role'
       ) IS DISTINCT FROM 'service_role' THEN
        RETURN NULL;
    END IF;

    IF TG_OP = 'DELETE' THEN
        SELECT count(*) INTO v_qtd FROM linhas_antigas;
    ELSE
        SELECT count(*) INTO v_qtd FROM linhas_novas;
    END IF;

    IF v_qtd > 1 THEN
        RAISE EXCEPTION 'Bloqueado: o assistente tentou % % registros de % de uma vez (só é permitido um por vez). Nada foi alterado.',
            CASE WHEN TG_OP = 'DELETE' THEN 'apagar' ELSE 'atualizar' END, v_qtd, TG_TABLE_NAME
            USING ERRCODE = '42501';
    END IF;

    RETURN NULL;
END;
$$;

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['Financeiro Cartão', 'Financeiro Debito', 'Financeiro Receita', 'fixed_costs', 'categorias']
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS fin_trava_delete_em_massa_bot ON public.%I', t);
        EXECUTE format(
            'CREATE TRIGGER fin_trava_delete_em_massa_bot AFTER DELETE ON public.%I '
            'REFERENCING OLD TABLE AS linhas_antigas FOR EACH STATEMENT '
            'EXECUTE FUNCTION public.fin_bloquear_alteracao_em_massa_bot()', t);

        EXECUTE format('DROP TRIGGER IF EXISTS fin_trava_update_em_massa_bot ON public.%I', t);
        EXECUTE format(
            'CREATE TRIGGER fin_trava_update_em_massa_bot AFTER UPDATE ON public.%I '
            'REFERENCING NEW TABLE AS linhas_novas FOR EACH STATEMENT '
            'EXECUTE FUNCTION public.fin_bloquear_alteracao_em_massa_bot()', t);
    END LOOP;
END $$;
