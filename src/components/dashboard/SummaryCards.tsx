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
    <div className="space-y-3">
      {/* Cards Principais - Layout Otimizado Mobile: Total (Full) | Credito/Debito (Meio a Meio) */}
      <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
        <Card
          className={`${getCardStyle("total")} col-span-2 md:col-span-1`}
          onClick={() => onFilterChange("total")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Total Geral
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl md:text-2xl font-bold text-card-foreground">{formatCurrency(totalGeral)}</div>
            <p className="text-xs text-muted-foreground">
              {despesas.length + despesasPendentes.length} {despesas.length + despesasPendentes.length === 1 ? 'despesa' : 'despesas'}
            </p>
          </CardContent>
        </Card>

        <Card
          className={`${getCardStyle("credito")} col-span-1`}
          onClick={() => onFilterChange("credito")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-card-foreground truncate">
              Crédito
            </CardTitle>
            <CreditCard className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold text-card-foreground truncate">{formatCurrency(totalCredito)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              Cartão
            </p>
          </CardContent>
        </Card>

        <Card
          className={`${getCardStyle("outros")} col-span-1`}
          onClick={() => onFilterChange("outros")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-card-foreground truncate">
              Outros
            </CardTitle>
            <Banknote className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg md:text-2xl font-bold text-card-foreground truncate">{formatCurrency(totalOutros)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              Pix/Débito/$$
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cards por Responsável e Custo Fixo - Grid 2 colunas no mobile */}
      <div className="grid gap-2 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        {totaisPorResponsavel.map((item) => (
          <Card
            key={item.nome}
            className={getCardStyle("responsavel", item.nome)}
            onClick={() => onFilterChange("responsavel", item.nome)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-card-foreground truncate">
                {item.nome}
              </CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-lg md:text-2xl font-bold text-card-foreground truncate">{formatCurrency(item.total)}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-card-foreground truncate">
                Custo Fixo
              </CardTitle>
              <Banknote className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-lg md:text-2xl font-bold text-card-foreground truncate">{formatCurrency(totalPendentes)}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                Pendentes
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
