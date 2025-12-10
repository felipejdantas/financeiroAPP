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
}

export type ResponsavelFilter = 'todos' | string;
export type TipoFilter = 'todos' | 'Crédito' | 'Débito' | 'Pix' | 'Dinheiro';
