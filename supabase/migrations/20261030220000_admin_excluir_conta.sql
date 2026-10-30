-- Master exclui uma conta pelo painel Contas: apaga os dados do usuário e o login.
--
-- Precisa apagar os dados antes, porque 11 tabelas referenciam auth.users sem ON DELETE CASCADE
-- (o delete do login falharia). As que têm CASCADE (cartoes, responsaveis, telegram_*, assinaturas,
-- pagamentos) somem junto com o login. Roda com o token do master (role authenticated), então a
-- trava contra apagar em massa do bot (só service_role) não se aplica.
--
-- Proteções: só master; não exclui a si mesmo nem outro master; exige o e-mail da conta como
-- confirmação (evita excluir a conta errada por clique).

CREATE OR REPLACE FUNCTION public.fin_admin_excluir_conta(p_user_id uuid, p_email_confirmacao text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email text;
    v_lancamentos integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Acesso restrito ao usuário master' USING ERRCODE = '42501';
    END IF;
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Você não pode excluir a própria conta' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = p_user_id) THEN
        RAISE EXCEPTION 'Conta master não pode ser excluída pelo painel' USING ERRCODE = '22023';
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
    IF v_email IS NULL THEN
        RAISE EXCEPTION 'Conta não encontrada' USING ERRCODE = 'P0002';
    END IF;
    IF lower(btrim(COALESCE(p_email_confirmacao, ''))) <> lower(v_email) THEN
        RAISE EXCEPTION 'O e-mail digitado não confere com o da conta' USING ERRCODE = '22023';
    END IF;

    SELECT (SELECT count(*) FROM public."Financeiro Cartão" WHERE user_id = p_user_id)
         + (SELECT count(*) FROM public."Financeiro Debito" WHERE user_id = p_user_id)
         + (SELECT count(*) FROM public."Financeiro Receita" WHERE user_id = p_user_id)
      INTO v_lancamentos;

    DELETE FROM public."Financeiro Cartão" WHERE user_id = p_user_id;
    DELETE FROM public."Financeiro Debito" WHERE user_id = p_user_id;
    DELETE FROM public."Financeiro Receita" WHERE user_id = p_user_id;
    DELETE FROM public.fixed_costs WHERE user_id = p_user_id;
    DELETE FROM public.investimentos WHERE user_id = p_user_id;
    DELETE FROM public.budget_planning WHERE user_id = p_user_id;
    DELETE FROM public.periodos_mensais_cartao WHERE user_id = p_user_id;
    DELETE FROM public.categoria_emojis WHERE user_id = p_user_id;
    DELETE FROM public.categorias WHERE user_id = p_user_id;
    DELETE FROM public.dismissed_notifications WHERE user_id = p_user_id;
    DELETE FROM public.profiles WHERE id = p_user_id;

    DELETE FROM auth.users WHERE id = p_user_id;

    RETURN json_build_object('email', v_email, 'lancamentos_apagados', v_lancamentos);
END;
$$;

REVOKE ALL ON FUNCTION public.fin_admin_excluir_conta(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_admin_excluir_conta(uuid, text) TO authenticated;
