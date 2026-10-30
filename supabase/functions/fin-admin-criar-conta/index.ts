// Cria uma conta nova do app pelo painel Contas (só o usuário master).
//
// Criar login exige a chave service_role, que não pode ir pro navegador — por isso Edge Function
// (mesmo molde do create-assistencia-owner do OSDANTAS). Quem chamou precisa estar em app_admins
// (checado com o token dele via fin_sou_admin). Depois de criar, já libera os dias de acesso
// escolhidos chamando fin_admin_registrar_pagamento com o token do master (fica registrado quem fez).
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ error: "Método não permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authorization = req.headers.get("Authorization") || "";

  const comoMaster = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: souAdmin, error: erroAdmin } = await comoMaster.rpc("fin_sou_admin");
  if (erroAdmin || souAdmin !== true) return resposta({ error: "Acesso restrito ao usuário master" }, 403);

  let corpo: { nome?: string; email?: string; senha?: string; dias?: number; valor?: number | null; observacao?: string };
  try {
    corpo = await req.json();
  } catch {
    return resposta({ error: "Corpo inválido" }, 400);
  }

  const nome = (corpo.nome || "").trim();
  const email = (corpo.email || "").trim().toLowerCase();
  const senha = corpo.senha || "";
  const dias = Number(corpo.dias);
  const valor = corpo.valor === null || corpo.valor === undefined || `${corpo.valor}` === "" ? null : Number(corpo.valor);

  if (!nome) return resposta({ error: "Informe o nome" }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) return resposta({ error: "E-mail inválido" }, 400);
  if (senha.length < 6) return resposta({ error: "A senha precisa ter pelo menos 6 caracteres" }, 400);
  if (!Number.isInteger(dias) || dias < 1 || dias > 3660) return resposta({ error: "Dias de acesso: de 1 a 3660" }, 400);
  if (valor !== null && (!Number.isFinite(valor) || valor < 0)) return resposta({ error: "Valor inválido" }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (erroCriar || !criado.user) {
    const jaExiste = /already|registered|exists/i.test(erroCriar?.message || "");
    return resposta({ error: jaExiste ? "Já existe uma conta com esse e-mail" : erroCriar?.message || "Erro ao criar conta" }, 400);
  }

  const { data: acesso, error: erroAcesso } = await comoMaster.rpc("fin_admin_registrar_pagamento", {
    p_user_id: criado.user.id,
    p_dias: dias,
    p_valor: valor,
    p_observacao: (corpo.observacao || "").trim() || "Conta criada",
  });
  if (erroAcesso) {
    // A conta existe, mas sem acesso liberado: o master pode registrar o pagamento pelo painel.
    return resposta({ user_id: criado.user.id, aviso: `Conta criada, mas o acesso não foi liberado: ${erroAcesso.message}` });
  }

  return resposta({ user_id: criado.user.id, ativo_ate: (acesso as { ativo_ate: string }).ativo_ate });
});
