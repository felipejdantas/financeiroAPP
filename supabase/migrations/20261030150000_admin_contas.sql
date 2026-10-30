-- Painel do usuário master: ver todas as contas do app e se estão usando o assistente do Telegram.
--
-- Quem é master fica em `app_admins`, sem nenhuma policy: ninguém lê nem escreve pela API, só
-- direto no banco. Os dados das outras contas só saem pela função fin_admin_contas, que confere
-- se quem chamou é master.

CREATE TABLE IF NOT EXISTS public.app_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_admins (user_id)
SELECT u.id FROM auth.users u WHERE u.email = 'suporte@dantasinfo.com'
ON CONFLICT DO NOTHING;

-- Uso do Telegram: o bot chama fin_perfil_telegram a cada mensagem, então é ali que se anota.
ALTER TABLE public.telegram_vinculos ADD COLUMN IF NOT EXISTS ultima_mensagem_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.telegram_vinculos ADD COLUMN IF NOT EXISTS total_mensagens INTEGER NOT NULL DEFAULT 0;

-- Mesma resposta de antes (ver 20261030120000_telegram_vinculos.sql), agora registrando o uso.
CREATE OR REPLACE FUNCTION public.fin_perfil_telegram(p_telegram_id bigint)
RETURNS json
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_resultado json;
BEGIN
    UPDATE public.telegram_vinculos
       SET ultima_mensagem_em = now(),
           total_mensagens = total_mensagens + 1
     WHERE telegram_id = p_telegram_id;

    SELECT COALESCE((
        SELECT json_build_object(
            'user_id', v.user_id,
            'dono', v.dono,
            'nome', COALESCE(NULLIF(btrim(p.nome), ''), v.nome_telegram),
            'cartoes', COALESCE(
                (SELECT json_agg(c.nome ORDER BY c.ordem, c.created_at) FROM public.cartoes c WHERE c.user_id = v.user_id AND c.ativo),
                '[]'::json),
            'cartao_principal', (
                SELECT c.nome FROM public.cartoes c
                 WHERE c.user_id = v.user_id AND c.ativo
                 ORDER BY c.principal DESC, c.ordem, c.created_at LIMIT 1),
            'responsaveis', COALESCE((
                SELECT json_agg(r.responsavel ORDER BY r.qtd DESC)
                  FROM (
                    SELECT btrim(x."Responsavel") AS responsavel, count(*) AS qtd
                      FROM (
                        SELECT "Responsavel" FROM public."Financeiro Cartão" WHERE user_id::text = v.user_id::text
                        UNION ALL
                        SELECT "Responsavel" FROM public."Financeiro Debito" WHERE user_id::text = v.user_id::text
                      ) x
                     WHERE COALESCE(btrim(x."Responsavel"), '') NOT IN ('', 'Sistema')
                     GROUP BY 1
                     ORDER BY 2 DESC
                     LIMIT 10
                  ) r), '[]'::json)
        )
        FROM public.telegram_vinculos v
        LEFT JOIN public.profiles p ON p.id = v.user_id
        WHERE v.telegram_id = p_telegram_id
    ), '{}'::json) INTO v_resultado;

    RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.fin_perfil_telegram(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fin_perfil_telegram(bigint) TO service_role;

-- O app pergunta "sou master?" pra decidir se mostra o menu Contas.
CREATE OR REPLACE FUNCTION public.fin_sou_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.fin_sou_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_sou_admin() TO authenticated;

-- Lista de contas pro painel do master. Só resumo de uso: não expõe os lançamentos de ninguém.
CREATE OR REPLACE FUNCTION public.fin_admin_contas()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Acesso restrito ao usuário master' USING ERRCODE = '42501';
    END IF;

    RETURN COALESCE((
        SELECT json_agg(conta ORDER BY (conta->>'criado_em') DESC)
        FROM (
            SELECT json_build_object(
                'user_id', u.id,
                'email', u.email,
                'nome', p.nome,
                'criado_em', u.created_at,
                'ultimo_login', u.last_sign_in_at,
                'email_confirmado', u.email_confirmed_at IS NOT NULL,
                'master', EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = u.id),
                'lancamentos', l.total,
                'lancamentos_30d', l.ultimos_30d,
                'ultimo_lancamento', l.ultimo,
                'cartoes_ativos', (SELECT count(*) FROM public.cartoes c WHERE c.user_id = u.id AND c.ativo),
                'telegram', COALESCE((
                    SELECT json_agg(json_build_object(
                        'nome', v.nome_telegram,
                        'conectado_em', v.created_at,
                        'ultima_mensagem_em', v.ultima_mensagem_em,
                        'total_mensagens', v.total_mensagens,
                        'dono', v.dono
                    ) ORDER BY v.created_at)
                    FROM public.telegram_vinculos v WHERE v.user_id = u.id
                ), '[]'::json)
            ) AS conta
            FROM auth.users u
            LEFT JOIN public.profiles p ON p.id = u.id
            LEFT JOIN LATERAL (
                SELECT count(*) AS total,
                       count(*) FILTER (WHERE x.created_at >= now() - interval '30 days') AS ultimos_30d,
                       max(x.created_at) AS ultimo
                  FROM (
                    SELECT created_at FROM public."Financeiro Cartão" WHERE user_id::text = u.id::text
                    UNION ALL
                    SELECT created_at FROM public."Financeiro Debito" WHERE user_id::text = u.id::text
                  ) x
            ) l ON true
        ) contas
    ), '[]'::json);
END;
$$;

REVOKE ALL ON FUNCTION public.fin_admin_contas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_admin_contas() TO authenticated;
