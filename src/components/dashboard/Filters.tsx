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
  responsavelFilter: string[];
  setResponsavelFilter: (value: string[]) => void;
  tipoFilter: string[];
  setTipoFilter: (value: string[]) => void;
  categoriaFilter: string[];
  setCategoriaFilter: (value: string[]) => void;
  parcelaFilter: string[];
  setParcelaFilter: (value: string[]) => void;
  dataInicio: string;
  setDataInicio: (value: string) => void;
  dataFim: string;
  setDataFim: (value: string) => void;
  onMesSelecionado?: (mes: number | null) => void;
  anoSelecionado?: number;
  setAnoSelecionado?: (ano: number) => void;
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
  anoSelecionado,
  setAnoSelecionado,
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

  const ANOS = [2025, 2026, 2027, 2028];

  const handleParcelaToggle = (value: string) => {
    if (parcelaFilter.includes(value)) {
      setParcelaFilter(parcelaFilter.filter(p => p !== value));
    } else {
      setParcelaFilter([...parcelaFilter, value]);
    }
  };

  const handleResponsavelToggle = (value: string) => {
    if (responsavelFilter.includes(value)) {
      setResponsavelFilter(responsavelFilter.filter(r => r !== value));
    } else {
      setResponsavelFilter([...responsavelFilter, value]);
    }
  };

  const handleCategoriaToggle = (value: string) => {
    if (categoriaFilter.includes(value)) {
      setCategoriaFilter(categoriaFilter.filter(c => c !== value));
    } else {
      setCategoriaFilter([...categoriaFilter, value]);
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

  // Filtra períodos pelo ano selecionado se disponível
  const periodosFiltrados = periodosMensais.filter(p => {
    if (!anoSelecionado) return true;
    return p.ano_referencia === anoSelecionado;
  }).sort((a, b) => a.mes_referencia - b.mes_referencia);

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

        {/* Grid ajustado para melhor distribuição */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

          {/* Ano (Novo) */}
          {anoSelecionado && setAnoSelecionado && (
            <div className="space-y-2">
              <Label htmlFor="ano" className="text-card-foreground flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Ano
              </Label>
              <Select
                value={anoSelecionado.toString()}
                onValueChange={(val) => setAnoSelecionado(parseInt(val))}
              >
                <SelectTrigger id="ano" className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {ANOS.map((ano) => (
                    <SelectItem key={ano} value={ano.toString()}>{ano}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Período Mensal */}
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
                {periodosFiltrados.length === 0 ? (
                  <SelectItem value="vazio" disabled>
                    {anoSelecionado ? `Sem períodos para ${anoSelecionado}` : "Configure os períodos primeiro"}
                  </SelectItem>
                ) : (
                  periodosFiltrados.map((periodo) => (
                    <SelectItem key={periodo.id} value={periodo.id.toString()}>
                      {periodo.nome_periodo || MESES[periodo.mes_referencia - 1]}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsavel" className="text-card-foreground flex items-center gap-1">
              <User className="h-4 w-4" />
              Responsável
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start bg-secondary border-border text-card-foreground"
                >
                  {responsavelFilter.length === 0
                    ? "Selecionar responsáveis"
                    : `${responsavelFilter.length} selecionado(s)`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 bg-popover border-border">
                <div className="space-y-2">
                  {responsaveis.map((resp) => (
                    <div key={resp} className="flex items-center space-x-2">
                      <Checkbox
                        id={`resp-${resp}`}
                        checked={responsavelFilter.includes(resp)}
                        onCheckedChange={() => handleResponsavelToggle(resp)}
                      />
                      <label
                        htmlFor={`resp-${resp}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {resp}
                      </label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo" className="text-card-foreground flex items-center gap-1">
              <CreditCard className="h-4 w-4" />
              Tipo
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start bg-secondary border-border text-card-foreground"
                >
                  {tipoFilter.length === 0
                    ? "Selecionar tipos"
                    : `${tipoFilter.length} selecionado(s)`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 bg-popover border-border">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="tipo-credito"
                      checked={tipoFilter.includes("Crédito")}
                      onCheckedChange={(checked) => {
                        if (checked) setTipoFilter([...tipoFilter, "Crédito"]);
                        else setTipoFilter(tipoFilter.filter((t) => t !== "Crédito"));
                      }}
                    />
                    <label
                      htmlFor="tipo-credito"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Crédito
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="tipo-debito"
                      checked={tipoFilter.includes("Débito")}
                      onCheckedChange={(checked) => {
                        if (checked) setTipoFilter([...tipoFilter, "Débito"]);
                        else setTipoFilter(tipoFilter.filter((t) => t !== "Débito"));
                      }}
                    />
                    <label
                      htmlFor="tipo-debito"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Débito
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="tipo-pix"
                      checked={tipoFilter.includes("Pix")}
                      onCheckedChange={(checked) => {
                        if (checked) setTipoFilter([...tipoFilter, "Pix"]);
                        else setTipoFilter(tipoFilter.filter((t) => t !== "Pix"));
                      }}
                    />
                    <label
                      htmlFor="tipo-pix"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      PIX
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="tipo-dinheiro"
                      checked={tipoFilter.includes("Dinheiro")}
                      onCheckedChange={(checked) => {
                        if (checked) setTipoFilter([...tipoFilter, "Dinheiro"]);
                        else setTipoFilter(tipoFilter.filter((t) => t !== "Dinheiro"));
                      }}
                    />
                    <label
                      htmlFor="tipo-dinheiro"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Dinheiro
                    </label>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoria" className="text-card-foreground flex items-center gap-1">
              <Tag className="h-4 w-4" />
              Categoria
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start bg-secondary border-border text-card-foreground"
                >
                  {categoriaFilter.length === 0
                    ? "Selecionar categorias"
                    : `${categoriaFilter.length} selecionada(s)`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 bg-popover border-border max-h-[300px] overflow-y-auto">
                <div className="space-y-2">
                  {categorias.map((cat) => (
                    <div key={cat} className="flex items-center space-x-2">
                      <Checkbox
                        id={`cat-${cat}`}
                        checked={categoriaFilter.includes(cat)}
                        onCheckedChange={() => handleCategoriaToggle(cat)}
                      />
                      <label
                        htmlFor={`cat-${cat}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {cat}
                      </label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
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
