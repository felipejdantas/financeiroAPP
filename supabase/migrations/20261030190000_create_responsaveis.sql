-- Responsáveis cadastráveis pelo usuário (antes: só texto livre, deduzido dos próprios lançamentos).
--
-- Igual aos cartões, a ligação com os lançamentos continua sendo o NOME gravado em "Responsavel"
-- (texto), porque o agente do Telegram/n8n grava esse texto direto nas tabelas. Aqui NÃO há
-- validação no insert: nome fora do cadastro continua sendo aceito e aparece no dashboard como antes.
--   * mostrar_no_dashboard: liga/desliga os cards do responsável no Dashboard (não afeta filtros,
--     relatórios nem os totais gerais);
--   * ativo: some dos selects de lançamento, sem apagar o histórico;
--   * renomear propaga o nome novo pros lançamentos (cartão, débito e receita) via trigger.

CREATE TABLE IF NOT EXISTS public.responsaveis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL CHECK (length(btrim(nome)) > 0 AND length(nome) <= 40),
    mostrar_no_dashboard BOOLEAN NOT NULL DEFAULT true,
    ativo BOOLEAN NOT NULL DEFAULT true,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS responsaveis_user_nome_key ON public.responsaveis (user_id, lower(nome));

ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'responsaveis' AND policyname = 'Usuários podem ver seus próprios responsáveis') THEN
        CREATE POLICY "Usuários podem ver seus próprios responsáveis" ON public.responsaveis FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'responsaveis' AND policyname = 'Usuários podem inserir seus próprios responsáveis') THEN
        CREATE POLICY "Usuários podem inserir seus próprios responsáveis" ON public.responsaveis FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'responsaveis' AND policyname = 'Usuários podem atualizar seus próprios responsáveis') THEN
        CREATE POLICY "Usuários podem atualizar seus próprios responsáveis" ON public.responsaveis FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'responsaveis' AND policyname = 'Usuários podem excluir seus próprios responsáveis') THEN
        CREATE POLICY "Usuários podem excluir seus próprios responsáveis" ON public.responsaveis FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Quem já usa o app ganha cadastrados os nomes que já aparecem nos lançamentos, todos visíveis
-- no dashboard (mesmo comportamento de antes), na ordem de quem tem mais lançamentos.
INSERT INTO public.responsaveis (user_id, nome, ordem)
SELECT x.user_id::uuid, x.nome, (row_number() OVER (PARTITION BY x.user_id ORDER BY x.qtd DESC, x.nome) - 1)::int
FROM (
    SELECT l.user_id, min(btrim(l.nome)) AS nome, count(*) AS qtd
    FROM (
        SELECT user_id::text AS user_id, "Responsavel" AS nome FROM public."Financeiro Cartão"
        UNION ALL SELECT user_id::text, "Responsavel" FROM public."Financeiro Debito"
        UNION ALL SELECT user_id::text, "Responsavel" FROM public."Financeiro Receita"
    ) l
    WHERE l.user_id IS NOT NULL
      AND NULLIF(btrim(l.nome), '') IS NOT NULL
      AND length(btrim(l.nome)) <= 40
      AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id::text = l.user_id)
    GROUP BY l.user_id, lower(btrim(l.nome))
) x
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.fin_responsavel_propagar_nome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.nome IS DISTINCT FROM OLD.nome THEN
        UPDATE public."Financeiro Cartão"
           SET "Responsavel" = NEW.nome
         WHERE user_id::text = OLD.user_id::text AND btrim("Responsavel") = OLD.nome;

        UPDATE public."Financeiro Debito"
           SET "Responsavel" = NEW.nome
         WHERE user_id::text = OLD.user_id::text AND btrim("Responsavel") = OLD.nome;

        UPDATE public."Financeiro Receita"
           SET "Responsavel" = NEW.nome
         WHERE user_id::text = OLD.user_id::text AND btrim("Responsavel") = OLD.nome;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fin_responsavel_propagar_nome ON public.responsaveis;
CREATE TRIGGER fin_responsavel_propagar_nome
    AFTER UPDATE OF nome ON public.responsaveis
    FOR EACH ROW EXECUTE FUNCTION public.fin_responsavel_propagar_nome();
