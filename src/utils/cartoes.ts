import { supabase } from "@/integrations/supabase/client";

// Cartões de crédito cadastrados pelo usuário (tabela `cartoes`). Os lançamentos continuam ligados
// ao cartão pelo NOME (coluna texto `banco_cartao`), não por id — ver migration
// 20261029120000_create_cartoes.sql e a nota FIN 2.0 no CEREBRO.
export interface Cartao {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  ativo: boolean;
  principal: boolean;
}

// Usado enquanto a tabela `cartoes` não existe no banco (migration ainda não aplicada): reproduz
// exatamente o comportamento antigo — Santander é a referência de período, Inter é o padrão ao lançar.
export const CARTOES_LEGADO: Cartao[] = [
  { id: "legado-santander", nome: "Santander", cor: "#dc2626", ordem: 0, ativo: true, principal: false },
  { id: "legado-inter", nome: "Inter", cor: "#f97316", ordem: 1, ativo: true, principal: true },
];

export const CORES_CARTAO = [
  { nome: "Vermelho", valor: "#dc2626" },
  { nome: "Laranja", valor: "#f97316" },
  { nome: "Amarelo", valor: "#eab308" },
  { nome: "Verde", valor: "#16a34a" },
  { nome: "Azul", valor: "#2563eb" },
  { nome: "Roxo", valor: "#8b5cf6" },
  { nome: "Rosa", valor: "#db2777" },
  { nome: "Cinza", valor: "#475569" },
  { nome: "Preto", valor: "#111827" },
];

const COR_SEM_CADASTRO = "#94a3b8";

export const fetchCartoes = async (userId: string): Promise<{ cartoes: Cartao[]; legado: boolean }> => {
  const { data, error } = await supabase
    .from("cartoes" as any)
    .select("id, nome, cor, ordem, ativo, principal")
    .eq("user_id", userId)
    .order("ordem")
    .order("created_at");

  if (error) {
    console.warn("Tabela de cartões indisponível, usando Santander/Inter:", error.message);
    return { cartoes: CARTOES_LEGADO, legado: true };
  }

  return { cartoes: (data || []) as unknown as Cartao[], legado: false };
};

// Primeiro cartão ativo na ordem: define o "mês atual" e o rótulo dos períodos no Dashboard
// (antes era sempre o Santander).
export const getCartaoReferencia = (cartoes: Cartao[]): Cartao | undefined =>
  cartoes.find((c) => c.ativo) || cartoes[0];

// Cartão pré-selecionado ao lançar uma despesa de crédito.
export const getCartaoPrincipal = (cartoes: Cartao[]): Cartao | undefined =>
  cartoes.find((c) => c.principal && c.ativo) || getCartaoReferencia(cartoes);

export const getCorCartao = (cartoes: Cartao[], nome?: string | null): string =>
  cartoes.find((c) => c.nome === nome)?.cor || COR_SEM_CADASTRO;

// Opções de cartão pra selects/filtros: os ativos, mais qualquer nome extra informado (ex: o cartão
// de uma despesa sendo editada, já desativado) pra não sumir da tela.
export const getNomesCartoes = (cartoes: Cartao[], extras: (string | null | undefined)[] = []): string[] => {
  const nomes = cartoes.filter((c) => c.ativo).map((c) => c.nome);
  for (const extra of extras) {
    if (extra && !nomes.includes(extra)) nomes.push(extra);
  }
  return nomes;
};
