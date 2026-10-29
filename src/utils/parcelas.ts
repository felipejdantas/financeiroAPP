import { addMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Despesa } from "@/types/despesa";

// As parcelas de uma compra não têm um id de grupo no banco: a única ligação entre elas é
// "mesma compra, número de parcela diferente". Aqui isso é reconstruído pelos campos que se repetem
// em todas as parcelas (tabela, descrição, responsável, cartão, total de parcelas e valor da parcela).
// A Data e o created_at NÃO servem de chave: parcelas importadas de fatura têm datas "ajustadas" ao
// fechamento e created_at diferentes entre si.

const parseParcela = (parcelas?: string): { atual: number; total: number } | null => {
  const match = (parcelas || "").trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;
  return { atual: parseInt(match[1], 10), total: parseInt(match[2], 10) };
};

const normalizar = (texto?: string | null) => (texto || "").trim().toLowerCase();

const brToDate = (dataBr: string): Date | null => {
  const [dia, mes, ano] = (dataBr || "").split("/").map((p) => parseInt(p, 10));
  if (!dia || !mes || !ano) return null;
  return new Date(ano, mes - 1, dia);
};

// Devolve as outras parcelas (anteriores e posteriores) da mesma compra que `original`.
// Quando há mais de uma candidata pro mesmo número de parcela (ex: duas compras idênticas, uma pra
// cada filho), desempata pela categoria antiga e depois pela data esperada; se ainda empatar, deixa
// aquele número de fora em vez de arriscar mexer na compra errada.
export const encontrarParcelasIrmas = (original: Despesa, todas: Despesa[]): Despesa[] => {
  const parcela = parseParcela(original.Parcelas);
  if (!parcela || parcela.total < 2 || !original.id) return [];

  const candidatas = todas.filter((d) => {
    if (d.id === original.id || d.table !== original.table) return false;
    const p = parseParcela(d.Parcelas);
    if (!p || p.total !== parcela.total || p.atual === parcela.atual) return false;
    if (normalizar(d["Descrição"]) !== normalizar(original["Descrição"])) return false;
    if (normalizar(d.Responsavel) !== normalizar(original.Responsavel)) return false;
    if (original.table === "cartao" && (d.banco_cartao || "") !== (original.banco_cartao || "")) return false;
    return Math.abs(Number(d.valor) - Number(original.valor)) <= 0.01;
  });

  const porNumero = new Map<number, Despesa[]>();
  for (const d of candidatas) {
    const atual = parseParcela(d.Parcelas)!.atual;
    porNumero.set(atual, [...(porNumero.get(atual) || []), d]);
  }

  const dataOriginal = brToDate(original.Data);
  const irmas: Despesa[] = [];

  for (const [atual, opcoes] of porNumero) {
    if (opcoes.length === 1) {
      irmas.push(opcoes[0]);
      continue;
    }

    const mesmaCategoria = opcoes.filter((d) => normalizar(d.Categoria) === normalizar(original.Categoria));
    if (mesmaCategoria.length === 1) {
      irmas.push(mesmaCategoria[0]);
      continue;
    }

    if (!dataOriginal) continue;
    const esperada = addMonths(dataOriginal, atual - parcela.atual).getTime();
    const restantes = mesmaCategoria.length > 0 ? mesmaCategoria : opcoes;
    const distancias = restantes.map((d) => Math.abs((brToDate(d.Data)?.getTime() ?? Infinity) - esperada));
    const menor = Math.min(...distancias);
    if (distancias.filter((dist) => dist === menor).length === 1 && menor !== Infinity) {
      irmas.push(restantes[distancias.indexOf(menor)]);
    }
  }

  return irmas;
};

// Aplica a categoria nova nas outras parcelas da mesma compra. `original` é a despesa como estava
// ANTES da edição (é a categoria antiga que desempata compras repetidas). Retorna os ids alterados.
export const propagarCategoriaParcelas = async (
  original: Despesa,
  novaCategoria: string,
  todas: Despesa[],
  ignorarIds: number[] = []
): Promise<number[]> => {
  if (normalizar(original.Categoria) === normalizar(novaCategoria)) return [];

  const ids = encontrarParcelasIrmas(original, todas)
    .filter((d) => d.id && !ignorarIds.includes(d.id) && d.Categoria !== novaCategoria)
    .map((d) => d.id!);
  if (ids.length === 0) return [];

  const tabela = original.table === "cartao" ? "Financeiro Cartão" : "Financeiro Debito";
  const { error } = await supabase.from(tabela as any).update({ Categoria: novaCategoria }).in("id", ids);
  if (error) throw error;
  return ids;
};
