import { useState } from "react";
import { Despesa } from "@/types/despesa";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, Calendar } from "lucide-react";

interface PeriodoMensal {
  id: number;
  mes_referencia: number;
  dia_inicio: number;
  mes_inicio_offset: number;
  dia_fim: number;
}

interface GraficosComparativosProps {
  despesas: Despesa[];
  periodosMensais: PeriodoMensal[];
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export const GraficosComparativos = ({ despesas, periodosMensais }: GraficosComparativosProps) => {
  const [tipoVisualizacao, setTipoVisualizacao] = useState<"total" | "usuario" | "categoria">("total");
  const categorias = [...new Set(despesas.map(d => d.Categoria).filter(Boolean))].sort();
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>(categorias[0] || "");
  const [tipoGrafico, setTipoGrafico] = useState<"credito" | "debito">("credito");

  // Converter data brasileira para objeto Date
  const brToDate = (dataBr: string): Date => {
    const [dia, mes, ano] = dataBr.split('/');
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  };

  // Função para encontrar o período mensal de uma data
  const encontrarPeriodoMensal = (data: Date, ano: number): { mesReferencia: number; ano: number } | null => {
    if (!periodosMensais || periodosMensais.length === 0) {
      // Fallback para mês do calendário se não houver períodos configurados
      return { mesReferencia: data.getMonth() + 1, ano: data.getFullYear() };
    }

    const dia = data.getDate();
    const mes = data.getMonth() + 1; // 1-12

    for (const periodo of periodosMensais) {
      const mesRef = periodo.mes_referencia;
      const mesInicio = periodo.mes_inicio_offset === -1 ? mesRef - 1 : mesRef;

      // Verifica se a data está dentro do período
      let dentroInicio = false;
      let dentroFim = false;

      if (periodo.mes_inicio_offset === -1) {
        // Período começa no mês anterior
        if (mes === (mesInicio === 0 ? 12 : mesInicio)) {
          dentroInicio = dia >= periodo.dia_inicio;
        } else if (mes === mesRef) {
          dentroFim = dia <= periodo.dia_fim;
        }

        const anoInicio = mesInicio === 0 ? ano - 1 : ano;
        if (data.getFullYear() === anoInicio && mes === (mesInicio === 0 ? 12 : mesInicio) && dia >= periodo.dia_inicio) {
          return { mesReferencia: mesRef, ano };
        }
        if (data.getFullYear() === ano && mes === mesRef && dia <= periodo.dia_fim) {
          return { mesReferencia: mesRef, ano };
        }
      } else {
        // Período começa no mesmo mês
        if (mes === mesRef && dia >= periodo.dia_inicio && dia <= periodo.dia_fim) {
          return { mesReferencia: mesRef, ano: data.getFullYear() };
        }
      }
    }

    return null;
  };

  // Separar despesas por tipo
  const despesasCartao = despesas.filter(d => d.Tipo === "Crédito");
  const despesasOutros = despesas.filter(d => d.Tipo === "Débito" || d.Tipo === "Pix" || d.Tipo === "Dinheiro");

  // Filtrar por categoria se necessário
  const despesasCartaoFiltradas = categoriaSelecionada === "todas"
    ? despesasCartao
    : despesasCartao.filter(d => d.Categoria === categoriaSelecionada);

  const despesasOutrosFiltradas = categoriaSelecionada === "todas"
    ? despesasOutros
    : despesasOutros.filter(d => d.Categoria === categoriaSelecionada);

  // Agrupar despesas de CARTÃO por período mensal configurado
  const dadosCartaoPorMes = despesasCartaoFiltradas.reduce((acc, despesa) => {
    const data = brToDate(despesa.Data);
    const ano = data.getFullYear();
    const periodoInfo = encontrarPeriodoMensal(data, ano);

    if (!periodoInfo) return acc;

    const chave = `${periodoInfo.ano}-${String(periodoInfo.mesReferencia).padStart(2, '0')}`;
    const mesNome = MESES[periodoInfo.mesReferencia - 1];
    const label = `${mesNome}/${periodoInfo.ano}`;

    if (!acc[chave]) {
      acc[chave] = {
        mesAno: label,
        total: 0,
        ordem: new Date(periodoInfo.ano, periodoInfo.mesReferencia - 1, 1).getTime(),
      };
    }

    acc[chave].total += despesa.valor || 0;
    return acc;
  }, {} as Record<string, { mesAno: string; total: number; ordem: number }>);

  // Agrupar despesas de DÉBITO/PIX/DINHEIRO por mês normal (01 a 31)
  const dadosOutrosPorMes = despesasOutrosFiltradas.reduce((acc, despesa) => {
    const data = brToDate(despesa.Data);
    const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    const mesNome = MESES[data.getMonth()];
    const ano = data.getFullYear();
    const chave = `${mesNome}/${ano}`;

    if (!acc[mesAno]) {
      acc[mesAno] = {
        mesAno: chave,
        total: 0,
        ordem: data.getTime(),
      };
    }

    acc[mesAno].total += despesa.valor || 0;
    return acc;
  }, {} as Record<string, { mesAno: string; total: number; ordem: number }>);

  // Ordenar por data e formatar
  const dadosGraficoCartao = Object.values(dadosCartaoPorMes)
    .sort((a, b) => a.ordem - b.ordem)
    .map(item => ({
      mes: item.mesAno,
      total: Number(item.total.toFixed(2)),
    }));

  const dadosGraficoOutros = Object.values(dadosOutrosPorMes)
    .sort((a, b) => a.ordem - b.ordem)
    .map(item => ({
      mes: item.mesAno,
      total: Number(item.total.toFixed(2)),
    }));

  // Dados para gastos totais mensais (todas as despesas)
  const dadosTotaisPorMes = despesas.reduce((acc, despesa) => {
    const data = brToDate(despesa.Data);
    const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    const mesNome = MESES[data.getMonth()];
    const ano = data.getFullYear();
    const chave = `${mesNome}/${ano}`;

    if (!acc[mesAno]) {
      acc[mesAno] = {
        mesAno: chave,
        total: 0,
        ordem: data.getTime(),
      };
    }

    acc[mesAno].total += despesa.valor || 0;
    return acc;
  }, {} as Record<string, { mesAno: string; total: number; ordem: number }>);

  const dadosGraficoTotais = Object.values(dadosTotaisPorMes)
    .sort((a, b) => a.ordem - b.ordem)
    .map(item => ({
      mes: item.mesAno,
      total: Number(item.total.toFixed(2)),
    }));

  // Dados por usuário
  const usuarios = [...new Set(despesas.map(d => d.Responsavel).filter(Boolean))];
  const dadosPorUsuario = usuarios.map(usuario => ({
    name: usuario,
    value: despesas.filter(d => d.Responsavel === usuario).reduce((sum, d) => sum + (d.valor || 0), 0)
  })).sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      {/* Seletor de Tipo de Visualização */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Tipo de Análise</CardTitle>
          <CardDescription>Escolha o tipo de visualização dos dados</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={tipoVisualizacao} onValueChange={(value: "total" | "usuario" | "categoria") => setTipoVisualizacao(value)}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              <SelectItem value="total">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Gastos Mensais Totais
                </div>
              </SelectItem>
              <SelectItem value="usuario">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Comparação por Usuário
                </div>
              </SelectItem>
              <SelectItem value="categoria">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Evolução por Categoria
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* GASTOS MENSAIS TOTAIS */}
      {tipoVisualizacao === "total" && (
        <>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Evolução Total de Gastos Mensais
              </CardTitle>
              <CardDescription>
                Visualize a evolução total dos seus gastos ao longo dos meses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dadosGraficoTotais.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={dadosGraficoTotais}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="mes"
                      stroke="hsl(var(--foreground))"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      stroke="hsl(var(--foreground))"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--popover-foreground))'
                      }}
                      formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Total']}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--chart-1))', r: 5 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Gastos Mensais (Barras)</CardTitle>
              <CardDescription>Comparação visual mês a mês</CardDescription>
            </CardHeader>
            <CardContent>
              {dadosGraficoTotais.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={dadosGraficoTotais}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="mes"
                      stroke="hsl(var(--foreground))"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      stroke="hsl(var(--foreground))"
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--popover-foreground))'
                      }}
                      formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Total']}
                    />
                    <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* COMPARAÇÃO POR USUÁRIO */}
      {tipoVisualizacao === "usuario" && (
        <>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Gastos por Usuário (Pizza)
              </CardTitle>
              <CardDescription>Distribuição percentual dos gastos entre usuários</CardDescription>
            </CardHeader>
            <CardContent>
              {dadosPorUsuario.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={dadosPorUsuario}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        percent > 0.05 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''
                      }
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {dadosPorUsuario.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Gastos por Usuário (Barras)</CardTitle>
              <CardDescription>Comparação de gastos entre usuários</CardDescription>
            </CardHeader>
            <CardContent>
              {dadosPorUsuario.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={dadosPorUsuario} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
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
                      formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                      {dadosPorUsuario.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* EVOLUÇÃO POR CATEGORIA (EXISTENTE) */}
      {tipoVisualizacao === "categoria" && (
        <>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Evolução de Gastos por Categoria
              </CardTitle>
              <CardDescription>
                Acompanhe a evolução dos gastos de uma categoria ao longo dos meses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="tipo-grafico-select">Tipo de Gráfico</Label>
                  <Select value={tipoGrafico} onValueChange={(value: "credito" | "debito") => setTipoGrafico(value)}>
                    <SelectTrigger id="tipo-grafico-select" className="bg-secondary border-border mt-2">
                      <SelectValue placeholder="Escolha o tipo" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border z-50">
                      <SelectItem value="credito">Cartão de Crédito</SelectItem>
                      <SelectItem value="debito">Débito/Pix/Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="categoria-select">Selecione a Categoria</Label>
                  <Select value={categoriaSelecionada} onValueChange={setCategoriaSelecionada}>
                    <SelectTrigger id="categoria-select" className="bg-secondary border-border mt-2">
                      <SelectValue placeholder="Escolha uma categoria" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border z-50">
                      <SelectItem value="todas">Todas as Categorias (Total Geral)</SelectItem>
                      {categorias.map((categoria) => (
                        <SelectItem key={categoria} value={categoria}>
                          {categoria}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {categoriaSelecionada && (tipoGrafico === "credito" ? dadosGraficoCartao.length > 0 : dadosGraficoOutros.length > 0) ? (
            <>
              {/* Gráfico de CARTÃO - Períodos Configurados */}
              {tipoGrafico === "credito" && dadosGraficoCartao.length > 0 && (
                <>
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle>
                        Cartão de Crédito - {categoriaSelecionada === "todas" ? "Total Geral" : categoriaSelecionada}
                      </CardTitle>
                      <CardDescription>
                        Gastos de cartão usando períodos de faturamento configurados
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={dadosGraficoCartao}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="mes"
                            stroke="hsl(var(--foreground))"
                            tick={{ fill: 'hsl(var(--foreground))' }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis
                            stroke="hsl(var(--foreground))"
                            tick={{ fill: 'hsl(var(--foreground))' }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              color: 'hsl(var(--popover-foreground))'
                            }}
                            formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Total']}
                          />
                          <Line
                            type="monotone"
                            dataKey="total"
                            stroke="hsl(var(--chart-1))"
                            strokeWidth={3}
                            dot={{ fill: 'hsl(var(--chart-1))', r: 5 }}
                            activeDot={{ r: 8 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle>
                        Cartão de Crédito (Barras) - {categoriaSelecionada === "todas" ? "Total Geral" : categoriaSelecionada}
                      </CardTitle>
                      <CardDescription>
                        Comparação mensal de gastos no cartão
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={dadosGraficoCartao}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="mes"
                            stroke="hsl(var(--foreground))"
                            tick={{ fill: 'hsl(var(--foreground))' }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis
                            stroke="hsl(var(--foreground))"
                            tick={{ fill: 'hsl(var(--foreground))' }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              color: 'hsl(var(--popover-foreground))'
                            }}
                            formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Total']}
                          />
                          <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Gráfico de DÉBITO/PIX/DINHEIRO - Mês Normal */}
              {tipoGrafico === "debito" && dadosGraficoOutros.length > 0 && (
                <>
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle>
                        Débito/Pix/Dinheiro - {categoriaSelecionada === "todas" ? "Total Geral" : categoriaSelecionada}
                      </CardTitle>
                      <CardDescription>
                        Gastos usando mês calendário (01 a 31)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={dadosGraficoOutros}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="mes"
                            stroke="hsl(var(--foreground))"
                            tick={{ fill: 'hsl(var(--foreground))' }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis
                            stroke="hsl(var(--foreground))"
                            tick={{ fill: 'hsl(var(--foreground))' }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              color: 'hsl(var(--popover-foreground))'
                            }}
                            formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Total']}
                          />
                          <Line
                            type="monotone"
                            dataKey="total"
                            stroke="hsl(var(--chart-2))"
                            strokeWidth={3}
                            dot={{ fill: 'hsl(var(--chart-2))', r: 5 }}
                            activeDot={{ r: 8 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle>
                        Débito/Pix/Dinheiro (Barras) - {categoriaSelecionada === "todas" ? "Total Geral" : categoriaSelecionada}
                      </CardTitle>
                      <CardDescription>
                        Comparação mensal de gastos em débito, pix e dinheiro
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={dadosGraficoOutros}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="mes"
                            stroke="hsl(var(--foreground))"
                            tick={{ fill: 'hsl(var(--foreground))' }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis
                            stroke="hsl(var(--foreground))"
                            tick={{ fill: 'hsl(var(--foreground))' }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              color: 'hsl(var(--popover-foreground))'
                            }}
                            formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Total']}
                          />
                          <Bar dataKey="total" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center text-muted-foreground">
                {categoriaSelecionada
                  ? "Nenhum dado encontrado para esta categoria"
                  : "Selecione uma categoria para visualizar os gráficos"}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
