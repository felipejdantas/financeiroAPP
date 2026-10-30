-- Acesso pago por período: cada conta só usa o app (e o assistente do Telegram) até `ativo_ate`.
--
-- Regras combinadas com o usuário master em 30/10/2026:
--   * venceu = bloqueia tudo (app e Telegram); os dados ficam guardados e voltam ao registrar pagamento;
--   * pagamento soma dias ao que ainda falta (pagar adiantado não perde dias) e desbloqueia;
--   * conta nova é criada pelo master (Edge Function fin-admin-criar-conta), já com N dias;
--   * master (app_admins) nunca vence.
--
-- Conta sem linha em `assinaturas_conta` fica SEM acesso (ex: alguém que se cadastrar direto pela API).
-- O bloqueio vale no banco, não só na tela: política RESTRICTIVE em todas as tabelas de dados do
-- usuário, somada (AND) às políticas que já existem. O bot do n8n usa service_role (ignora RLS),
-- por isso fin_perfil_telegram também passa a negar a conta vencida.

CREATE TABLE IF NOT EXISTS public.assinaturas_conta (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    ativo_ate TIMESTAMP WITH TIME ZONE,
    bloqueado BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pagamentos_conta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dias INTEGER NOT NULL CHECK (dias > 0),
    valor NUMERIC(10, 2),
    observacao TEXT,
    ativo_ate_anterior TIMESTAMP WITH TIME ZONE,
    ativo_ate_novo TIMESTAMP WITH TIME ZONE NOT NULL,
    registrado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pagamentos_conta_user_idx ON public.pagamentos_conta (user_id, created_at DESC);

-- Sem policies: só as funções abaixo (SECURITY DEFINER) leem e escrevem.
ALTER TABLE public.assinaturas_conta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_conta ENABLE ROW LEVEL SECURITY;

-- Quem já tem conta (e não é master) ganha 30 dias a partir de hoje, pra ninguém cair de repente.
INSERT INTO public.assinaturas_conta (user_id, ativo_ate)
SELECT u.id, now() + interval '30 days'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = u.id)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.fin_acesso_ativo(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p_user_id IS NOT NULL AND (
        EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = p_user_id)
        OR EXISTS (
            SELECT 1 FROM public.assinaturas_conta s
            WHERE s.user_id = p_user_id AND NOT s.bloqueado AND s.ativo_ate > now()
        )
    );
$$;

REVOKE ALL ON FUNCTION public.fin_acesso_ativo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_acesso_ativo(uuid) TO authenticated, service_role;

-- Trava no banco: com acesso vencido, o usuário logado não lê nem grava nada.
-- `(SELECT ...)` faz o Postgres avaliar a função uma vez por comando, não por linha.
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'Financeiro Cartão', 'Financeiro Debito', 'Financeiro Receita', 'fixed_costs', 'categorias',
        'categoria_emojis', 'periodos_mensais_cartao', 'budget_planning', 'investimentos',
        'dismissed_notifications', 'responsaveis', 'cartoes', 'telegram_vinculos'
    ]
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Acesso vigente" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Acesso vigente" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
            'USING ((SELECT public.fin_acesso_ativo())) WITH CHECK ((SELECT public.fin_acesso_ativo()))', t);
    END LOOP;
END $$;

-- O app pergunta isso ao abrir, pra mostrar a tela de acesso vencido ou o aviso de "vence em X dias".
CREATE OR REPLACE FUNCTION public.fin_meu_acesso()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT json_build_object(
        'ativo', public.fin_acesso_ativo(auth.uid()),
        'master', EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = auth.uid()),
        'ativo_ate', s.ativo_ate,
        'bloqueado', COALESCE(s.bloqueado, false)
    )
    FROM (SELECT auth.uid() AS uid) eu
    LEFT JOIN public.assinaturas_conta s ON s.user_id = eu.uid;
$$;

REVOKE ALL ON FUNCTION public.fin_meu_acesso() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_meu_acesso() TO authenticated;

-- Master registra um pagamento: soma os dias ao que falta (ou a partir de agora, se já venceu) e desbloqueia.
CREATE OR REPLACE FUNCTION public.fin_admin_registrar_pagamento(
    p_user_id uuid,
    p_dias integer DEFAULT 30,
    p_valor numeric DEFAULT NULL,
    p_observacao text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_anterior timestamptz;
    v_novo timestamptz;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Acesso restrito ao usuário master' USING ERRCODE = '42501';
    END IF;
    IF p_dias IS NULL OR p_dias < 1 OR p_dias > 3660 THEN
        RAISE EXCEPTION 'Informe de 1 a 3660 dias' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'Conta não encontrada' USING ERRCODE = 'P0002';
    END IF;

    SELECT ativo_ate INTO v_anterior FROM public.assinaturas_conta WHERE user_id = p_user_id FOR UPDATE;
    v_novo := GREATEST(now(), COALESCE(v_anterior, now())) + make_interval(days => p_dias);

    INSERT INTO public.assinaturas_conta (user_id, ativo_ate, bloqueado, updated_at)
    VALUES (p_user_id, v_novo, false, now())
    ON CONFLICT (user_id) DO UPDATE
       SET ativo_ate = EXCLUDED.ativo_ate, bloqueado = false, updated_at = now();

    INSERT INTO public.pagamentos_conta (user_id, dias, valor, observacao, ativo_ate_anterior, ativo_ate_novo, registrado_por)
    VALUES (p_user_id, p_dias, p_valor, NULLIF(btrim(p_observacao), ''), v_anterior, v_novo, auth.uid());

    RETURN json_build_object('ativo_ate', v_novo);
END;
$$;

REVOKE ALL ON FUNCTION public.fin_admin_registrar_pagamento(uuid, integer, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_admin_registrar_pagamento(uuid, integer, numeric, text) TO authenticated;

-- Master bloqueia/desbloqueia na hora, sem mexer no vencimento.
CREATE OR REPLACE FUNCTION public.fin_admin_bloquear_conta(p_user_id uuid, p_bloqueado boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Acesso restrito ao usuário master' USING ERRCODE = '42501';
    END IF;
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Você não pode bloquear a própria conta' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.assinaturas_conta (user_id, bloqueado, updated_at)
    VALUES (p_user_id, p_bloqueado, now())
    ON CONFLICT (user_id) DO UPDATE SET bloqueado = EXCLUDED.bloqueado, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.fin_admin_bloquear_conta(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_admin_bloquear_conta(uuid, boolean) TO authenticated;

-- Painel Contas: mesmo resumo de antes + situação do acesso e pagamentos.
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
                ), '[]'::json),
                'acesso', json_build_object(
                    'ativo', public.fin_acesso_ativo(u.id),
                    'ativo_ate', s.ativo_ate,
                    'bloqueado', COALESCE(s.bloqueado, false),
                    'total_pago', (SELECT sum(pg.valor) FROM public.pagamentos_conta pg WHERE pg.user_id = u.id),
                    'pagamentos', COALESCE((
                        SELECT json_agg(json_build_object(
                            'pago_em', pg.created_at,
                            'dias', pg.dias,
                            'valor', pg.valor,
                            'observacao', pg.observacao,
                            'ativo_ate_novo', pg.ativo_ate_novo
                        ) ORDER BY pg.created_at DESC)
                        FROM (SELECT * FROM public.pagamentos_conta x WHERE x.user_id = u.id ORDER BY x.created_at DESC LIMIT 12) pg
                    ), '[]'::json)
                )
            ) AS conta
            FROM auth.users u
            LEFT JOIN public.profiles p ON p.id = u.id
            LEFT JOIN public.assinaturas_conta s ON s.user_id = u.id
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

-- Telegram: conta vencida/bloqueada não recebe user_id, então o n8n cai em "Acesso Negado" (a porta
-- de entrada só segue com user_id preenchido). Vai junto o motivo, pra mensagem poder explicar.
CREATE OR REPLACE FUNCTION public.fin_perfil_telegram(p_telegram_id bigint)
RETURNS json
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_resultado json;
    v_user_id uuid;
BEGIN
    UPDATE public.telegram_vinculos
       SET ultima_mensagem_em = now(),
           total_mensagens = total_mensagens + 1
     WHERE telegram_id = p_telegram_id
    RETURNING user_id INTO v_user_id;

    IF v_user_id IS NOT NULL AND NOT public.fin_acesso_ativo(v_user_id) THEN
        RETURN json_build_object(
            'acesso_vencido', true,
            'ativo_ate', (SELECT s.ativo_ate FROM public.assinaturas_conta s WHERE s.user_id = v_user_id)
        );
    END IF;

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
