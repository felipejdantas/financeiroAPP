import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Despesa } from "@/types/despesa";
import { Wallet, TrendingUp, User, Users } from "lucide-react";

interface SummaryCardsProps {
  despesas: Despesa[];
}

export const SummaryCards = ({ despesas }: SummaryCardsProps) => {
  const totalGeral = despesas.reduce((sum, d) => sum + d.valor, 0);
  const totalFelipe = despesas
    .filter((d) => d.Responsavel === "Felipe")
    .reduce((sum, d) => sum + d.valor, 0);
  const totalElida = despesas
    .filter((d) => d.Responsavel === "Elida")
    .reduce((sum, d) => sum + d.valor, 0);
  
  const countFelipe = despesas.filter((d) => d.Responsavel === "Felipe").length;
  const countElida = despesas.filter((d) => d.Responsavel === "Elida").length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-card-foreground">
            Total Geral
          </CardTitle>
          <Wallet className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-card-foreground">{formatCurrency(totalGeral)}</div>
          <p className="text-xs text-muted-foreground">
            {despesas.length} {despesas.length === 1 ? 'despesa' : 'despesas'}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-card-foreground">
            Felipe
          </CardTitle>
          <User className="h-5 w-5 text-chart-1" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-card-foreground">{formatCurrency(totalFelipe)}</div>
          <p className="text-xs text-muted-foreground">
            {countFelipe} {countFelipe === 1 ? 'despesa' : 'despesas'}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-card-foreground">
            Élida
          </CardTitle>
          <Users className="h-5 w-5 text-chart-2" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-card-foreground">{formatCurrency(totalElida)}</div>
          <p className="text-xs text-muted-foreground">
            {countElida} {countElida === 1 ? 'despesa' : 'despesas'}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-card-foreground">
            Média por Despesa
          </CardTitle>
          <TrendingUp className="h-5 w-5 text-chart-3" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-card-foreground">
            {despesas.length > 0 ? formatCurrency(totalGeral / despesas.length) : formatCurrency(0)}
          </div>
          <p className="text-xs text-muted-foreground">
            Valor médio
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
