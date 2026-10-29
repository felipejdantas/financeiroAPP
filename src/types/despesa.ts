export interface Despesa {
  Responsavel: string;
  Tipo: string;
  Data: string;
  Descrição: string;
  Parcelas: string;
  valor: number;
  Categoria: string;
  id?: number;
  created_at?: string;
  fixed_cost_id?: number;
  status?: 'pendente' | 'pago';
  table?: 'cartao' | 'debito';
  banco_cartao?: BancoCartao;
  mes_fatura?: number | null;
  ano_fatura?: number | null;
}

// Nome de um cartão cadastrado em `cartoes` (antes era só 'Santander' | 'Inter').
export type BancoCartao = string;

export type ResponsavelFilter = 'todos' | string;
export type TipoFilter = 'todos' | 'Crédito' | 'Débito' | 'Pix' | 'Dinheiro';
