import { supabase } from "@/integrations/supabase/client";

// Responsáveis cadastrados pelo usuário (tabela `responsaveis`). Os lançamentos continuam ligados
// ao responsável pelo NOME (coluna texto `Responsavel`), não por id — ver migration
// 20261030190000_create_responsaveis.sql e a nota FIN 2.0 no CEREBRO.
export interface Responsavel {
  id: string;
  nome: string;
  mostrar_no_dashboard: boolean;
  ativo: boolean;
  ordem: number;
}

export const fetchResponsaveis = async (userId: string): Promise<{ responsaveis: Responsavel[]; legado: boolean }> => {
  const { data, error } = await supabase
    .from("responsaveis" as any)
    .select("id, nome, mostrar_no_dashboard, ativo, ordem")
    .eq("user_id", userId)
    .order("ordem")
    .order("created_at");

  if (error) {
    // Tabela ainda não criada (migration não aplicada): volta ao comportamento antigo, só nomes dos lançamentos
    console.warn("Tabela de responsáveis indisponível, usando nomes dos lançamentos:", error.message);
    return { responsaveis: [], legado: true };
  }

  return { responsaveis: (data || []) as unknown as Responsavel[], legado: false };
};

const normalizar = (nome?: string | null) => (nome || "").trim().toLowerCase();

// Nomes que NÃO devem ganhar card no Dashboard. Nome sem cadastro continua aparecendo (como antes).
export const getResponsaveisOcultos = (responsaveis: Responsavel[]): Set<string> =>
  new Set(responsaveis.filter((r) => !r.mostrar_no_dashboard).map((r) => normalizar(r.nome)));

export const isResponsavelOculto = (ocultos: Set<string>, nome?: string | null) => ocultos.has(normalizar(nome));

// Opções de responsável pros formulários: os cadastrados ativos, mais os nomes encontrados nos
// lançamentos que não estão no cadastro (ex: gravados pelo Telegram). Desativados ficam de fora,
// exceto o `manter` (ex: responsável do lançamento sendo editado), pra não sumir da tela.
export const getNomesResponsaveis = (
  responsaveis: Responsavel[],
  extras: (string | null | undefined)[] = [],
  manter?: string | null,
): string[] => {
  const cadastrados = new Set(responsaveis.map((r) => normalizar(r.nome)));
  const nomes = responsaveis.filter((r) => r.ativo || normalizar(r.nome) === normalizar(manter)).map((r) => r.nome);
  const vistos = new Set(nomes.map(normalizar));
  for (const extra of extras) {
    const nome = (extra || "").trim();
    const chave = normalizar(nome);
    if (!nome || vistos.has(chave) || cadastrados.has(chave)) continue;
    vistos.add(chave);
    nomes.push(nome);
  }
  return nomes;
};
