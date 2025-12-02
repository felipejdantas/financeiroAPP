import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ResponsavelFilter, TipoFilter } from "@/types/despesa";
import { Filter, User, CreditCard, Tag, Calendar, X } from "lucide-react";
import { format } from "date-fns";

interface FiltersProps {
  responsavelFilter: ResponsavelFilter;
  setResponsavelFilter: (value: ResponsavelFilter) => void;
  tipoFilter: TipoFilter;
  setTipoFilter: (value: TipoFilter) => void;
  categoriaFilter: string;
  setCategoriaFilter: (value: string) => void;
  parcelaFilter: string[];
  setParcelaFilter: (value: string[]) => void;
  dataInicio: string;
  setDataInicio: (value: string) => void;
  dataFim: string;
  setDataFim: (value: string) => void;
  onMesSelecionado?: (mes: number | null) => void;
  categorias: string[];
  responsaveis: string[];
  periodosMensais: any[];
  userId: string;
  onClearFilters: () => void;
}

export const Filters = ({
  responsavelFilter,
  setResponsavelFilter,
  tipoFilter,
  setTipoFilter,
  categoriaFilter,
  setCategoriaFilter,
  parcelaFilter,
  setParcelaFilter,
  dataInicio,
  setDataInicio,
  dataFim,
  setDataFim,
  onMesSelecionado,
  categorias,
  responsaveis,
  periodosMensais,
  userId,
  onClearFilters,
}: FiltersProps) => {
  const opcoesParcelamento = [
    { value: "1", label: "A vista" },
    { value: "2", label: "2x" },
    { value: "3", label: "3x" },
    { value: "4", label: "4x" },
    { value: "5", label: "5x" },
    { value: "6", label: "6x" },
    { value: "7", label: "7x" },
    { value: "8", label: "8x" },
    { value: "9", label: "9x" },
    { value: "10", label: "10x" },
    { value: "11", label: "11x" },
    { value: "12", label: "12x" },
  ];

  const handleParcelaToggle = (value: string) => {
    if (parcelaFilter.includes(value)) {
      setParcelaFilter(parcelaFilter.filter(p => p !== value));
    } else {
      setParcelaFilter([...parcelaFilter, value]);
    }
  };

  const handleMesAnoChange = (periodoId: string) => {
    if (!periodoId) {
      setDataInicio("");
      setDataFim("");
      if (onMesSelecionado) onMesSelecionado(null);
      return;
    }

    const periodo = periodosMensais.find(p => p.id.toString() === periodoId);
    if (!periodo) return;

    // Se tiver as novas colunas de data, usa elas
    if (periodo.data_inicio && periodo.data_fim) {
      setDataInicio(periodo.data_inicio);
      setDataFim(periodo.data_fim);
      if (onMesSelecionado) onMesSelecionado(periodo.mes_referencia);
      return;
    }

    // Fallback para o sistema antigo (caso a migração não tenha rodado ainda)
    const anoAtual = new Date().getFullYear();
    const mesRef = periodo.mes_referencia;

    if (onMesSelecionado) onMesSelecionado(mesRef);

    // Calcula a data de início
    const mesInicio = periodo.mes_inicio_offset === -1 ? mesRef - 1 : mesRef;
    const anoInicio = mesInicio < 1 ? anoAtual - 1 : anoAtual;
    const mesInicioAjustado = mesInicio < 1 ? 12 : mesInicio;
    const dataInicioCalculada = new Date(anoInicio, mesInicioAjustado - 1, periodo.dia_inicio);

    // Calcula a data de fim (sempre no mês de referência)
    const dataFimCalculada = new Date(anoAtual, mesRef - 1, periodo.dia_fim);

    setDataInicio(format(dataInicioCalculada, "yyyy-MM-dd"));
    setDataFim(format(dataFimCalculada, "yyyy-MM-dd"));
  };

  const MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-card-foreground">Filtros</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground hover:text-destructive">
            <X className="mr-2 h-4 w-4" />
            Limpar Filtros
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-7">
          <div className="space-y-2">
            <Label htmlFor="responsavel" className="text-card-foreground flex items-center gap-1">
              <User className="h-4 w-4" />
              Responsável
            </Label>
            <Select
              value={responsavelFilter}
              onValueChange={(value) => setResponsavelFilter(value as ResponsavelFilter)}
            >
              <SelectTrigger id="responsavel" className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="todos">Todos</SelectItem>
                {responsaveis.map((resp) => (
                  <SelectItem key={resp} value={resp}>{resp}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo" className="text-card-foreground flex items-center gap-1">
              <CreditCard className="h-4 w-4" />
              Tipo
            </Label>
            <Select
              value={tipoFilter}
              onValueChange={(value) => setTipoFilter(value as TipoFilter)}
            >
              <SelectTrigger id="tipo" className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Crédito">Crédito</SelectItem>
                <SelectItem value="Débito">Débito</SelectItem>
                <SelectItem value="Pix">PIX</SelectItem>
                <SelectItem value="Dinheiro">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoria" className="text-card-foreground flex items-center gap-1">
              <Tag className="h-4 w-4" />
              Categoria
            </Label>
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger id="categoria" className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="todas">Todas</SelectItem>
                {categorias.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="parcela" className="text-card-foreground flex items-center gap-1">
              <Tag className="h-4 w-4" />
              Qtd. Parcelas
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start bg-secondary border-border text-card-foreground"
                >
                  {parcelaFilter.length === 0
                    ? "Selecionar parcelas"
                    : `${parcelaFilter.length} selecionada(s)`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 bg-popover border-border">
                <div className="space-y-2">
                  {opcoesParcelamento.map((opcao) => (
                    <div key={opcao.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`parcela-${opcao.value}`}
                        checked={parcelaFilter.includes(opcao.value)}
                        onCheckedChange={() => handleParcelaToggle(opcao.value)}
                      />
                      <label
                        htmlFor={`parcela-${opcao.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {opcao.label}
                      </label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="periodoMensal" className="text-card-foreground flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Período Mensal
            </Label>
            <Select onValueChange={handleMesAnoChange}>
              <SelectTrigger id="periodoMensal" className="bg-secondary border-border">
                <SelectValue placeholder="Selecione um período" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {periodosMensais.length === 0 ? (
                  <SelectItem value="vazio" disabled>
                    Configure os períodos primeiro
                  </SelectItem>
                ) : (
                  periodosMensais
                    .sort((a, b) => a.mes_referencia - b.mes_referencia)
                    .map((periodo) => (
                      <SelectItem key={periodo.id} value={periodo.id.toString()}>
                        {periodo.nome_periodo || MESES[periodo.mes_referencia - 1]}
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataInicio" className="text-card-foreground flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Data Início
            </Label>
            <Input
              id="dataInicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="bg-secondary border-border text-card-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataFim" className="text-card-foreground flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Data Fim
            </Label>
            <Input
              id="dataFim"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="bg-secondary border-border text-card-foreground"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
