-- Criar tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS na tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver apenas seu próprio perfil
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Política: usuários podem inserir seu próprio perfil
CREATE POLICY "Usuários podem inserir seu próprio perfil"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Política: usuários podem atualizar seu próprio perfil
CREATE POLICY "Usuários podem atualizar seu próprio perfil"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Trigger para criar perfil automaticamente ao cadastrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'nome');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Adicionar coluna user_id nas tabelas financeiras se não existir
ALTER TABLE public."Financeiro Cartão" 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public."Financeiro Debito" 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Enable read access for all users" ON public."Financeiro Cartão";
DROP POLICY IF EXISTS "Enable read access for all users" ON public."Financeiro Debito";

-- FINANCEIRO CARTÃO - Políticas RLS seguras
CREATE POLICY "Usuários podem ver apenas suas próprias despesas de cartão"
ON public."Financeiro Cartão"
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias despesas de cartão"
ON public."Financeiro Cartão"
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias despesas de cartão"
ON public."Financeiro Cartão"
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias despesas de cartão"
ON public."Financeiro Cartão"
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- FINANCEIRO DÉBITO - Políticas RLS seguras
CREATE POLICY "Usuários podem ver apenas suas próprias despesas de débito"
ON public."Financeiro Debito"
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias despesas de débito"
ON public."Financeiro Debito"
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias despesas de débito"
ON public."Financeiro Debito"
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias despesas de débito"
ON public."Financeiro Debito"
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);