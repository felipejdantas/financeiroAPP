import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Despesa } from "@/types/despesa";
import { Wallet, CreditCard, Banknote, User } from "lucide-react";

interface SummaryCardsProps {
  despesas: Despesa[];
  despesasPendentes?: Despesa[];
  onFilterChange: (type: string, value?: string) => void;
  activeFilter: { type: string; value?: string } | null;
}

export const SummaryCards = ({ despesas, despesasPendentes = [], onFilterChange, activeFilter }: SummaryCardsProps) => {
  const totalPendentes = despesasPendentes.reduce((sum, d) => sum + (d.valor || 0), 0);
  const totalGeral = despesas.reduce((sum, d) => sum + d.valor, 0) + totalPendentes;

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
      {/* Cards Principais */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className={getCardStyle("total")}
          onClick={() => onFilterChange("total")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Total Geral
            </CardTitle>
            <Wallet className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">{formatCurrency(totalGeral)}</div>
            <p className="text-xs text-muted-foreground">
              {despesas.length + despesasPendentes.length} {despesas.length + despesasPendentes.length === 1 ? 'despesa' : 'despesas'}
            </p>
          </CardContent>
        </Card>

        <Card
          className={getCardStyle("credito")}
          onClick={() => onFilterChange("credito")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Crédito
            </CardTitle>
            <CreditCard className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">{formatCurrency(totalCredito)}</div>
            <p className="text-xs text-muted-foreground">
              Cartão de crédito
            </p>
          </CardContent>
        </Card>

        <Card
          className={getCardStyle("outros")}
          onClick={() => onFilterChange("outros")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Pix, Débito e Dinheiro
            </CardTitle>
            <Banknote className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">{formatCurrency(totalOutros)}</div>
            <p className="text-xs text-muted-foreground">
              Outros meios de pagamento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cards por Responsável e Custo Fixo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {totaisPorResponsavel.map((item) => (
          <Card
            key={item.nome}
            className={getCardStyle("responsavel", item.nome)}
            onClick={() => onFilterChange("responsavel", item.nome)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">
                {item.nome}
              </CardTitle>
              <User className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-card-foreground">{formatCurrency(item.total)}</div>
              <p className="text-xs text-muted-foreground">
                Responsável
              </p>
            </CardContent>
          </Card>
        ))}

        {/* Card de Custo Fixo (Despesas Pendentes) */}
        {totalPendentes > 0 && (
          <Card
            className={getCardStyle("custo_fixo")}
            onClick={() => onFilterChange("custo_fixo")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground">
                Custo Fixo
              </CardTitle>
              <Banknote className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-card-foreground">{formatCurrency(totalPendentes)}</div>
              <p className="text-xs text-muted-foreground">
                Despesas Fixas Pendentes
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
