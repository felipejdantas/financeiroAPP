-- Cartões de crédito cadastráveis pelo usuário (antes: só 'Santander'/'Inter', fixos via CHECK).
--
-- A ligação com os lançamentos continua sendo o NOME do cartão gravado em banco_cartao (texto),
-- de propósito: o agente financeiro do n8n grava esse texto direto na tabela, e assim nada fora do
-- app precisa mudar. Integridade fica por conta de triggers:
--   * insert/update em "Financeiro Cartão"/periodos_mensais_cartao: valida o nome contra os cartões
--     do usuário (sem diferenciar maiúscula/minúscula) e, se vier vazio, usa o cartão principal;
--   * renomear um cartão propaga o nome novo pros lançamentos e períodos;
--   * excluir um cartão com lançamentos é bloqueado (desativar é o caminho).
-- Usuário sem nenhum cartão cadastrado não é validado (comportamento antigo, default 'Inter').

CREATE TABLE IF NOT EXISTS public.cartoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL CHECK (length(btrim(nome)) > 0 AND length(nome) <= 40),
    cor TEXT NOT NULL DEFAULT '#2563eb',
    ordem INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    principal BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cartoes_user_nome_key ON public.cartoes (user_id, lower(nome));
CREATE UNIQUE INDEX IF NOT EXISTS cartoes_user_principal_key ON public.cartoes (user_id) WHERE principal;

ALTER TABLE public.cartoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cartoes' AND policyname = 'Usuários podem ver seus próprios cartões') THEN
        CREATE POLICY "Usuários podem ver seus próprios cartões" ON public.cartoes FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cartoes' AND policyname = 'Usuários podem inserir seus próprios cartões') THEN
        CREATE POLICY "Usuários podem inserir seus próprios cartões" ON public.cartoes FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cartoes' AND policyname = 'Usuários podem atualizar seus próprios cartões') THEN
        CREATE POLICY "Usuários podem atualizar seus próprios cartões" ON public.cartoes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cartoes' AND policyname = 'Usuários podem excluir seus próprios cartões') THEN
        CREATE POLICY "Usuários podem excluir seus próprios cartões" ON public.cartoes FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Quem já usa o app ganha exatamente os dois cartões de hoje: Santander primeiro (é a referência
-- do "mês atual" e dos rótulos de período) e Inter como principal (default ao lançar).
INSERT INTO public.cartoes (user_id, nome, cor, ordem, principal)
SELECT u.id, v.nome, v.cor, v.ordem, v.principal
FROM auth.users u
CROSS JOIN (VALUES
    ('Santander', '#dc2626', 0, false),
    ('Inter',     '#f97316', 1, true)
) AS v(nome, cor, ordem, principal)
WHERE EXISTS (SELECT 1 FROM public."Financeiro Cartão" fc WHERE fc.user_id::text = u.id::text)
   OR EXISTS (SELECT 1 FROM public.periodos_mensais_cartao p WHERE p.user_id::text = u.id::text)
ON CONFLICT DO NOTHING;

-- Algum nome fora do padrão que já esteja gravado (não deveria, por causa do CHECK antigo) vira
-- cartão também, pra validação nova não recusar update de lançamento antigo.
INSERT INTO public.cartoes (user_id, nome, cor, ordem)
SELECT DISTINCT fc.user_id::uuid, fc.banco_cartao, '#475569', 10
FROM public."Financeiro Cartão" fc
WHERE fc.user_id IS NOT NULL
  AND fc.banco_cartao IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id::text = fc.user_id::text)
  AND NOT EXISTS (
      SELECT 1 FROM public.cartoes c
      WHERE c.user_id::text = fc.user_id::text AND lower(c.nome) = lower(fc.banco_cartao)
  )
ON CONFLICT DO NOTHING;

-- Remove os CHECK (banco_cartao IN ('Santander','Inter')) das duas tabelas, pelo conteúdo
-- (não pelo nome, que pode ter mudado na migração de projeto).
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT conrelid::regclass AS tabela, conname
        FROM pg_constraint
        WHERE contype = 'c'
          AND conrelid IN ('public."Financeiro Cartão"'::regclass, 'public.periodos_mensais_cartao'::regclass)
          AND pg_get_constraintdef(oid) ILIKE '%banco_cartao%'
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tabela, r.conname);
    END LOOP;
END $$;

-- Sem DEFAULT fixo: insert sem banco_cartao (ex: sub-workflow de custo fixo do n8n) cai no cartão
-- principal do usuário via trigger abaixo — pro usuário atual, continua sendo o Inter.
ALTER TABLE public."Financeiro Cartão" ALTER COLUMN banco_cartao DROP DEFAULT;
ALTER TABLE public.periodos_mensais_cartao ALTER COLUMN banco_cartao DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.fin_normalizar_banco_cartao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_nome text;
BEGIN
    IF NEW.user_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.cartoes c WHERE c.user_id::text = NEW.user_id::text) THEN
        NEW.banco_cartao := COALESCE(NULLIF(btrim(NEW.banco_cartao), ''), 'Inter');
        RETURN NEW;
    END IF;

    IF NULLIF(btrim(NEW.banco_cartao), '') IS NULL THEN
        SELECT c.nome INTO v_nome
        FROM public.cartoes c
        WHERE c.user_id::text = NEW.user_id::text
        ORDER BY c.ativo DESC, c.principal DESC, c.ordem, c.created_at
        LIMIT 1;
    ELSE
        SELECT c.nome INTO v_nome
        FROM public.cartoes c
        WHERE c.user_id::text = NEW.user_id::text
          AND lower(c.nome) = lower(btrim(NEW.banco_cartao));

        IF v_nome IS NULL THEN
            RAISE EXCEPTION 'Cartão "%" não está cadastrado. Cadastre em Configurações > Meus Cartões.', NEW.banco_cartao
                USING ERRCODE = '23514';
        END IF;
    END IF;

    NEW.banco_cartao := v_nome;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fin_normalizar_banco_cartao ON public."Financeiro Cartão";
CREATE TRIGGER fin_normalizar_banco_cartao
    BEFORE INSERT OR UPDATE OF banco_cartao, user_id ON public."Financeiro Cartão"
    FOR EACH ROW EXECUTE FUNCTION public.fin_normalizar_banco_cartao();

DROP TRIGGER IF EXISTS fin_normalizar_banco_cartao ON public.periodos_mensais_cartao;
CREATE TRIGGER fin_normalizar_banco_cartao
    BEFORE INSERT OR UPDATE OF banco_cartao, user_id ON public.periodos_mensais_cartao
    FOR EACH ROW EXECUTE FUNCTION public.fin_normalizar_banco_cartao();

CREATE OR REPLACE FUNCTION public.fin_cartao_propagar_nome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.nome IS DISTINCT FROM OLD.nome THEN
        UPDATE public."Financeiro Cartão"
           SET banco_cartao = NEW.nome
         WHERE user_id::text = OLD.user_id::text AND banco_cartao = OLD.nome;

        UPDATE public.periodos_mensais_cartao
           SET banco_cartao = NEW.nome
         WHERE user_id::text = OLD.user_id::text AND banco_cartao = OLD.nome;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fin_cartao_propagar_nome ON public.cartoes;
CREATE TRIGGER fin_cartao_propagar_nome
    AFTER UPDATE OF nome ON public.cartoes
    FOR EACH ROW EXECUTE FUNCTION public.fin_cartao_propagar_nome();

CREATE OR REPLACE FUNCTION public.fin_cartao_bloquear_exclusao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Exclusão em cascata da própria conta (auth.users) não é bloqueada.
    IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.user_id) THEN
        RETURN OLD;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public."Financeiro Cartão"
        WHERE user_id::text = OLD.user_id::text AND banco_cartao = OLD.nome
    ) THEN
        RAISE EXCEPTION 'O cartão "%" tem lançamentos e não pode ser excluído. Desative-o em vez disso.', OLD.nome
            USING ERRCODE = '23503';
    END IF;

    DELETE FROM public.periodos_mensais_cartao
     WHERE user_id::text = OLD.user_id::text AND banco_cartao = OLD.nome;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS fin_cartao_bloquear_exclusao ON public.cartoes;
CREATE TRIGGER fin_cartao_bloquear_exclusao
    BEFORE DELETE ON public.cartoes
    FOR EACH ROW EXECUTE FUNCTION public.fin_cartao_bloquear_exclusao();
