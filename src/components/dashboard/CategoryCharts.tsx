import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Despesa } from "@/types/despesa";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp, PieChart as PieChartIcon } from "lucide-react";

interface CategoryChartsProps {
  despesas: Despesa[];
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
  "hsl(var(--chart-8))",
];

export const CategoryCharts = ({ despesas }: CategoryChartsProps) => {
  const categoriaData = despesas.reduce((acc, despesa) => {
    const categoria = despesa.Categoria || "Sem categoria";
    if (!acc[categoria]) {
      acc[categoria] = 0;
    }
    acc[categoria] += despesa.valor;
    return acc;
  }, {} as Record<string, number>);

  const allChartData = Object.entries(categoriaData)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Top 8 para o gráfico de pizza
  const top8ChartData = allChartData.slice(0, 8);
  
  // Outros (se houver mais de 8 categorias)
  const othersValue = allChartData.slice(8).reduce((sum, item) => sum + item.value, 0);
  if (othersValue > 0) {
    top8ChartData.push({ name: "Outros", value: othersValue });
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Gráfico de Pizza - Top 8 */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-card-foreground">
              Top 8 Categorias ({despesas.length} {despesas.length === 1 ? 'despesa' : 'despesas'})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {top8ChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={top8ChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    percent > 0.05 ? `${name.length > 12 ? name.substring(0, 12) + '...' : name} (${(percent * 100).toFixed(0)}%)` : ''
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {top8ChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value) => value.length > 20 ? value.substring(0, 20) + '...' : value}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[350px] text-muted-foreground">
              Nenhuma despesa para exibir
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Barras - Top 8 */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-card-foreground">
              Ranking de Gastos por Categoria
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {top8ChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={top8ChartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  type="number" 
                  tickFormatter={(value) => `R$ ${value.toFixed(0)}`}
                  stroke="hsl(var(--foreground))"
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={90}
                  stroke="hsl(var(--foreground))"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                  {top8ChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[350px] text-muted-foreground">
              Nenhuma despesa para exibir
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
