-- Performance: add missing indexes on user_id for the core financial tables.
-- Every query in the app filters by user_id; these tables previously had no
-- index beyond the primary key (and fixed_cost_id/status for Cartão/Débito).
CREATE INDEX IF NOT EXISTS idx_financeiro_cartao_user_id ON public."Financeiro Cartão" USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_debito_user_id ON public."Financeiro Debito" USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_receita_user_id ON public."Financeiro Receita" USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_investimentos_user_id ON public.investimentos USING btree (user_id);

-- Security: RLS UPDATE policies only had USING, no WITH CHECK, meaning the
-- post-update row wasn't re-validated (a crafted UPDATE could reassign
-- user_id to another user). Add matching WITH CHECK to every UPDATE policy.
ALTER POLICY "Usuários podem atualizar suas próprias despesas de cartão" ON public."Financeiro Cartão"
  WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Usuários podem atualizar suas próprias despesas de débito" ON public."Financeiro Debito"
  WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update their own revenue" ON public."Financeiro Receita"
  WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own budget planning" ON public.budget_planning
  WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own category emojis" ON public.categoria_emojis
  WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own categories" ON public.categorias
  WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Usuários podem atualizar seus próprios custos fixos" ON public.fixed_costs
  WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Usuários podem atualizar seus próprios investimentos" ON public.investimentos
  WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Usuários podem atualizar seus próprios períodos" ON public.periodos_mensais_cartao
  WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Usuários podem atualizar seu próprio perfil" ON public.profiles
  WITH CHECK (auth.uid() = id);
