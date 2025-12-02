import { useState } from "react";
import { Despesa } from "@/types/despesa";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { TrendingUp } from "lucide-react";

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

  return (
    <div className="space-y-6">
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
    </div>
  );
};
