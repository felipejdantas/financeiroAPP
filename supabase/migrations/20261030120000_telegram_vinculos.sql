-- Cadastro de clientes no agente financeiro do Telegram (n8n, bot @dantasinfo_bot).
--
-- Cada conta do Telegram (telegram_id = message.from.id, que o próprio Telegram informa e o usuário
-- não consegue falsificar) fica ligada a UMA conta do app. O agente só age na conta ligada a quem
-- escreveu; quem não tem vínculo é barrado antes de chegar na IA.
--
-- Fluxo de cadastro: o app gera um código de uso único (10 min) → o cliente abre
-- t.me/dantasinfo_bot?start=CODIGO → o n8n chama fin_vincular_telegram com o código e o telegram_id.
--
-- `dono` libera as ferramentas pessoais do dono do bot (Google Agenda/Tarefas ligadas à conta Google
-- dele) — nunca é definido pelo cliente, só aqui ou direto no banco.

CREATE TABLE IF NOT EXISTS public.telegram_vinculos (
    telegram_id BIGINT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome_telegram TEXT,
    dono BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_vinculos_user_id_idx ON public.telegram_vinculos (user_id);

ALTER TABLE public.telegram_vinculos ENABLE ROW LEVEL SECURITY;

-- O usuário vê e desconecta os próprios vínculos; criar/alterar só pelas funções abaixo.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'telegram_vinculos' AND policyname = 'Usuários podem ver seus vínculos do Telegram') THEN
        CREATE POLICY "Usuários podem ver seus vínculos do Telegram" ON public.telegram_vinculos FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'telegram_vinculos' AND policyname = 'Usuários podem desconectar seus vínculos do Telegram') THEN
        CREATE POLICY "Usuários podem desconectar seus vínculos do Telegram" ON public.telegram_vinculos FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.telegram_codigos (
    codigo TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expira_em TIMESTAMP WITH TIME ZONE NOT NULL,
    usado_em TIMESTAMP WITH TIME ZONE
);

-- Sem policies: ninguém lê/escreve direto, só pelas funções SECURITY DEFINER.
ALTER TABLE public.telegram_codigos ENABLE ROW LEVEL SECURITY;

-- Chamada pelo app (usuário logado): gera o código de conexão, invalidando os anteriores dele.
CREATE OR REPLACE FUNCTION public.fin_gerar_codigo_telegram()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_codigo text;
    v_expira timestamptz := now() + interval '10 minutes';
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Não autenticado';
    END IF;

    DELETE FROM public.telegram_codigos
     WHERE user_id = v_uid OR expira_em < now() - interval '1 day';

    LOOP
        v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.telegram_codigos WHERE codigo = v_codigo);
    END LOOP;

    INSERT INTO public.telegram_codigos (codigo, user_id, expira_em) VALUES (v_codigo, v_uid, v_expira);

    RETURN json_build_object('codigo', v_codigo, 'expira_em', v_expira);
END;
$$;

REVOKE ALL ON FUNCTION public.fin_gerar_codigo_telegram() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_gerar_codigo_telegram() TO authenticated;

-- Chamada pelo n8n (service_role) quando chega "/start CODIGO": consome o código e liga o Telegram à conta.
CREATE OR REPLACE FUNCTION public.fin_vincular_telegram(p_codigo text, p_telegram_id bigint, p_nome text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cod public.telegram_codigos%ROWTYPE;
BEGIN
    SELECT * INTO v_cod FROM public.telegram_codigos WHERE codigo = upper(btrim(p_codigo)) FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('ok', false, 'motivo', 'codigo_invalido');
    END IF;
    IF v_cod.usado_em IS NOT NULL THEN
        RETURN json_build_object('ok', false, 'motivo', 'codigo_usado');
    END IF;
    IF v_cod.expira_em < now() THEN
        RETURN json_build_object('ok', false, 'motivo', 'codigo_expirado');
    END IF;

    UPDATE public.telegram_codigos SET usado_em = now() WHERE codigo = v_cod.codigo;

    -- Telegram já ligado a outra conta: passa pra conta nova e perde o "dono" (só vale pra conta original)
    INSERT INTO public.telegram_vinculos (telegram_id, user_id, nome_telegram)
    VALUES (p_telegram_id, v_cod.user_id, p_nome)
    ON CONFLICT (telegram_id) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           nome_telegram = EXCLUDED.nome_telegram,
           dono = CASE WHEN public.telegram_vinculos.user_id = EXCLUDED.user_id THEN public.telegram_vinculos.dono ELSE false END,
           created_at = now();

    RETURN json_build_object(
        'ok', true,
        'nome', (SELECT p.nome FROM public.profiles p WHERE p.id = v_cod.user_id)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fin_vincular_telegram(text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fin_vincular_telegram(text, bigint, text) TO service_role;

-- Chamada pelo n8n a cada mensagem: quem é esse Telegram? Retorna {} (sem user_id) se não tiver vínculo.
-- Traz junto o contexto que o agente precisa pra não assumir os nomes/cartões do dono do bot.
CREATE OR REPLACE FUNCTION public.fin_perfil_telegram(p_telegram_id bigint)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    ), '{}'::json);
$$;

REVOKE ALL ON FUNCTION public.fin_perfil_telegram(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fin_perfil_telegram(bigint) TO service_role;

-- Quem já usa o bot hoje (o node "Acesso Autorizado" do n8n só deixava passar este Telegram)
-- continua funcionando, como dono.
INSERT INTO public.telegram_vinculos (telegram_id, user_id, nome_telegram, dono)
SELECT 1543246134, u.id, 'Felipe', true
FROM auth.users u
WHERE u.email = 'suporte@dantasinfo.com'
ON CONFLICT (telegram_id) DO NOTHING;
