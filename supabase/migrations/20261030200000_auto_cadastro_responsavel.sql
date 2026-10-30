-- Responsável novo num lançamento entra sozinho no cadastro (tabela `responsaveis`).
--
-- Vindo do agente do Telegram (n8n, chave service_role) entra com mostrar_no_dashboard = false: o
-- nome fica registrado, mas só ganha card no dashboard se o usuário ligar em Configurações >
-- Responsáveis. Vindo do app (usuário logado) entra visível, como já acontecia com nome sem cadastro.
-- Nome que já existe no cadastro (sem diferenciar maiúscula/minúscula) não é alterado.
--
-- A trigger nunca impede o lançamento: qualquer erro aqui é ignorado.

CREATE OR REPLACE FUNCTION public.fin_auto_cadastrar_responsavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_nome text := btrim(NEW."Responsavel");
    v_bot boolean;
BEGIN
    IF NEW.user_id IS NULL OR NULLIF(v_nome, '') IS NULL OR length(v_nome) > 40 THEN
        RETURN NULL;
    END IF;

    v_bot := COALESCE(
                 NULLIF(current_setting('request.jwt.claim.role', true), ''),
                 NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'role'
             ) IS NOT DISTINCT FROM 'service_role';

    BEGIN
        INSERT INTO public.responsaveis (user_id, nome, mostrar_no_dashboard, ordem)
        SELECT u.id, v_nome, NOT v_bot,
               COALESCE((SELECT max(r.ordem) + 1 FROM public.responsaveis r WHERE r.user_id = u.id), 0)
        FROM auth.users u
        WHERE u.id::text = NEW.user_id::text
        ON CONFLICT DO NOTHING;
    EXCEPTION WHEN others THEN
        RAISE WARNING 'fin_auto_cadastrar_responsavel: %', SQLERRM;
    END;

    RETURN NULL;
END;
$$;

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['Financeiro Cartão', 'Financeiro Debito', 'Financeiro Receita']
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS fin_auto_cadastrar_responsavel ON public.%I', t);
        EXECUTE format(
            'CREATE TRIGGER fin_auto_cadastrar_responsavel AFTER INSERT OR UPDATE OF "Responsavel" ON public.%I '
            'FOR EACH ROW EXECUTE FUNCTION public.fin_auto_cadastrar_responsavel()', t);
    END LOOP;
END $$;
