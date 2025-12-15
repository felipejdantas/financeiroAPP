import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Despesa } from "@/types/despesa";
import { Wallet, CreditCard, Banknote, User, TrendingUp, Scale, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

interface SummaryCardsProps {
  despesas: Despesa[];
  despesasPendentes?: Despesa[];
  onFilterChange: (type: string, value?: string) => void;
  activeFilter: { type: string; value?: string } | null;
  totalReceita: number;
  saldoAcumulado?: number;
}

export const SummaryCards = ({ despesas, despesasPendentes = [], onFilterChange, activeFilter, totalReceita, saldoAcumulado }: SummaryCardsProps) => {
  const totalPendentes = despesasPendentes.reduce((sum, d) => sum + (d.valor || 0), 0);
  const totalGeral = despesas.reduce((sum, d) => sum + d.valor, 0) + totalPendentes;

  // Saldo real considers only direct payments (Pix, Debit, Cash)
  // It specifically Excludes Credit Card (which are future payments) and Pending items
  const totalDirectExpenses = despesas
    .filter((d) => ["Pix", "Débito", "Dinheiro"].includes(d.Tipo))
    .reduce((sum, d) => sum + d.valor, 0);

  const saldo = totalReceita - totalDirectExpenses;

  // Use acumulado if provided, otherwise calculate local (fallback)
  const saldoFinal = saldoAcumulado !== undefined ? saldoAcumulado : saldo;

  // Separar por tipo de pagamento
  const totalCredito = despesas
    .filter((d) => d.Tipo === "Crédito")
    .reduce((sum, d) => sum + d.valor, 0);

  const totalOutros = despesas
    .filter((d) => ["Pix", "Débito", "Dinheiro"].includes(d.Tipo))
    .reduce((sum, d) => sum + d.valor, 0);

  // Agrupar por responsável
  const responsaveis = [...new Set(despesas.map((d) => d.Responsavel).filter(Boolean))];
  const totaisPorResponsavel = responsaveis.map((resp) => {
    const total = despesas
      .filter((d) => d.Responsavel === resp)
      .reduce((sum, d) => sum + d.valor, 0);
    return { nome: resp, total };
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const isSelected = (type: string, value?: string) => {
    if (!activeFilter && type === "total") return true;
    if (!activeFilter) return false;
    return activeFilter.type === type && activeFilter.value === value;
  };

  const getCardStyle = (type: string, value?: string) => {
    const selected = isSelected(type, value);
    return `cursor-pointer transition-all hover:shadow-md ${selected
      ? "border-primary ring-2 ring-primary/20 bg-primary/5"
      : "bg-card border-border shadow-sm"
      }`;
  };

  return (
    <div className="space-y-4">
      {/* Linha 1: Saldo, Receita, Despesas (Diretas) */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {/* Saldo - Posição 1 */}
        <Card className={`${saldo >= 0 ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'}`}>
          <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 p-4 pb-2">
            <CardTitle className={`text-sm font-medium ${saldoFinal >= 0 ? 'text-blue-900 dark:text-blue-400' : 'text-red-900 dark:text-red-400'}`}>
              Saldo
            </CardTitle>
            <Scale className={`h-4 w-4 ${saldoFinal >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`} />
          </CardHeader>
          <CardContent className="p-4 pt-0 text-center">
            <div className={`text-xl md:text-2xl font-bold ${saldoFinal >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>
              {formatCurrency(saldoFinal)}
            </div>
            <p className={`text-xs ${saldoFinal >= 0 ? 'text-blue-600/60 dark:text-blue-400/60' : 'text-red-600/60 dark:text-red-400/60'}`}>
              Receitas - Despesas (Acumulado)
            </p>
          </CardContent>
        </Card>

        {/* Receita - Posição 2 */}
        <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
          <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 p-4 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-900 dark:text-emerald-400">
              Receita
            </CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent className="p-4 pt-0 text-center">
            <div className="text-xl md:text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {formatCurrency(totalReceita)}
            </div>
          </CardContent>
        </Card>

        {/* Despesas (antigo Outros/Diretas) - Posição 3 */}
        <Card
          className={`${getCardStyle("outros")}`}
          onClick={() => onFilterChange("outros")}
        >
          <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 p-4 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-card-foreground truncate">
              Despesas
            </CardTitle>
            <Banknote className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 text-center">
            <div className="text-lg md:text-2xl font-bold text-card-foreground truncate">{formatCurrency(totalOutros)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Linha 2: Total Despesas (Full Width) */}
      <div className="grid gap-4 grid-cols-1">
        <Card
          className={`${getCardStyle("total")}`}
          onClick={() => onFilterChange("total")}
        >
          <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 p-4 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Total das Despesas
            </CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 text-center">
            <div className="text-xl md:text-2xl font-bold text-card-foreground">{formatCurrency(totalGeral)}</div>
            <p className="text-xs text-muted-foreground">
              {despesas.length + despesasPendentes.length} registros
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Linha 3: Cartão de Crédito e Despesas Fixas */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Cartão de Crédito */}
        <Card
          className={`${getCardStyle("credito")}`}
          onClick={() => onFilterChange("credito")}
        >
          <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 p-4 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-card-foreground truncate">
              Cartão de Crédito
            </CardTitle>
            <CreditCard className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 text-center">
            <div className="text-lg md:text-2xl font-bold text-card-foreground truncate">{formatCurrency(totalCredito)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              Faturas
            </p>
          </CardContent>
        </Card>

        {/* Despesas Fixas */}
        {totalPendentes > 0 ? (
          <Card
            className={getCardStyle("custo_fixo")}
            onClick={() => onFilterChange("custo_fixo")}
          >
            <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 p-4 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-card-foreground truncate">
                Despesas Fixas
              </CardTitle>
              <Banknote className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent className="p-4 pt-0 text-center">
              <div className="text-lg md:text-2xl font-bold text-card-foreground truncate">{formatCurrency(totalPendentes)}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                Pendentes
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="hidden md:block"></div> /* Espaço vazio se não houver pendentes, manter grid? */
        )}
      </div>

      {/* Linha 4: Responsáveis */}
      <div className="grid gap-2 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        {totaisPorResponsavel.map((item) => (
          <Card
            key={item.nome}
            className={getCardStyle("responsavel", item.nome)}
            onClick={() => onFilterChange("responsavel", item.nome)}
          >
            <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 p-4 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-card-foreground truncate">
                {item.nome}
              </CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0 text-center">
              <div className="text-lg md:text-2xl font-bold text-card-foreground truncate">{formatCurrency(item.total)}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                Responsável
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
