import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface PeriodoMensal {
  mes_referencia: number;
  ano_referencia: number;
  data_inicio: string; // YYYY-MM-DD
  data_fim: string; // YYYY-MM-DD
  nome_periodo: string;
  // Campos legados para compatibilidade
  dia_inicio?: number;
  mes_inicio_offset?: number;
  dia_fim?: number;
}

interface PeriodosMensaisManagerProps {
  userId: string;
  onUpdate: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const ANOS = [2025, 2026, 2027, 2028];

export const PeriodosMensaisManager = ({ userId, onUpdate, open, onOpenChange }: PeriodosMensaisManagerProps) => {
  const [periodos, setPeriodos] = useState<PeriodoMensal[]>([]);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && userId) {
      loadPeriodos();
    }
  }, [open, userId, anoSelecionado]);

  const loadPeriodos = async () => {
    setLoading(true);
    try {
      // Busca períodos do ano selecionado
      const { data, error } = await supabase
        .from("periodos_mensais_cartao")
        .select("*")
        .eq("user_id", userId)
        .eq("ano_referencia", anoSelecionado)
        .order("mes_referencia");

      if (error) throw error;

      // Cria um mapa dos períodos existentes
      const periodosMap = new Map(
        data?.map(p => [p.mes_referencia, p]) || []
      );

      // Inicializa todos os 12 meses para o ano selecionado
      const todosPeriodos: PeriodoMensal[] = [];

      for (let mes = 1; mes <= 12; mes++) {
        const existente = periodosMap.get(mes);

        if (existente) {
          // Se já tem data_inicio (migrado), usa. Se não, calcula.
          let dataInicio = existente.data_inicio;
          let dataFim = existente.data_fim;

          if (!dataInicio && existente.dia_inicio) {
            const mesInicio = mes + (existente.mes_inicio_offset || 0);
            const anoInicio = mesInicio < 1 ? anoSelecionado - 1 : (mesInicio > 12 ? anoSelecionado + 1 : anoSelecionado);
            const mesInicioAjustado = mesInicio < 1 ? 12 + mesInicio : (mesInicio > 12 ? mesInicio - 12 : mesInicio);
            dataInicio = format(new Date(anoInicio, mesInicioAjustado - 1, existente.dia_inicio), "yyyy-MM-dd");
          }

          if (!dataFim && existente.dia_fim) {
            dataFim = format(new Date(anoSelecionado, mes - 1, existente.dia_fim), "yyyy-MM-dd");
          }

          todosPeriodos.push({
            mes_referencia: mes,
            ano_referencia: anoSelecionado,
            data_inicio: dataInicio || format(new Date(anoSelecionado, mes - 1, 1), "yyyy-MM-dd"),
            data_fim: dataFim || format(new Date(anoSelecionado, mes, 0), "yyyy-MM-dd"),
            nome_periodo: existente.nome_periodo || MESES[mes - 1],
            dia_inicio: existente.dia_inicio,
            mes_inicio_offset: existente.mes_inicio_offset,
            dia_fim: existente.dia_fim
          });
        } else {
          // Período padrão: mês completo
          const primeiroDia = new Date(anoSelecionado, mes - 1, 1);
          const ultimoDia = new Date(anoSelecionado, mes, 0);

          todosPeriodos.push({
            mes_referencia: mes,
            ano_referencia: anoSelecionado,
            data_inicio: format(primeiroDia, "yyyy-MM-dd"),
            data_fim: format(ultimoDia, "yyyy-MM-dd"),
            nome_periodo: MESES[mes - 1],
            dia_inicio: 1,
            mes_inicio_offset: 0,
            dia_fim: ultimoDia.getDate()
          });
        }
      }

      setPeriodos(todosPeriodos);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar períodos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Validar períodos
      for (const periodo of periodos) {
        if (!periodo.data_inicio || !periodo.data_fim) {
          toast({
            title: "Erro de validação",
            description: "Todos os campos de data são obrigatórios",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const inicio = new Date(periodo.data_inicio);
        const fim = new Date(periodo.data_fim);

        if (fim <= inicio) {
          toast({
            title: "Erro de validação",
            description: `${periodo.nome_periodo}: A data de fim deve ser posterior à data de início`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      // Deletar períodos existentes do usuário para o ano selecionado
      await supabase
        .from("periodos_mensais_cartao")
        .delete()
        .eq("user_id", userId)
        .eq("ano_referencia", anoSelecionado);

      // Inserir os novos períodos
      const periodosParaInserir = periodos.map(p => {
        const dataInicio = new Date(p.data_inicio);
        const dataFim = new Date(p.data_fim);

        return {
          user_id: userId,
          mes_referencia: p.mes_referencia,
          ano_referencia: p.ano_referencia,
          data_inicio: p.data_inicio,
          data_fim: p.data_fim,
          nome_periodo: p.nome_periodo,
          // Preenche campos legados com valores aproximados/compatíveis
          dia_inicio: dataInicio.getDate(),
          mes_inicio_offset: 0,
          dia_fim: dataFim.getDate()
        };
      });

      const { error } = await supabase
        .from("periodos_mensais_cartao")
        .insert(periodosParaInserir);

      if (error) throw error;

      toast({
        title: "Períodos salvos!",
        description: "Configurações aplicadas com sucesso.",
      });

      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar períodos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePeriodo = (mes: number, field: 'data_inicio' | 'data_fim', value: string) => {
    setPeriodos(prev =>
      prev.map(p =>
        p.mes_referencia === mes ? { ...p, [field]: value } : p
      )
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Períodos de Faturamento do Cartão</DialogTitle>
          <DialogDescription>
            Configure o período de faturamento para cada mês do ano com datas completas.
          </DialogDescription>
        </DialogHeader>

        {/* Seletor de Ano */}
        <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
          <Calendar className="h-5 w-5 text-primary" />
          <Label className="text-sm font-medium">Ano:</Label>
          <Select
            value={anoSelecionado.toString()}
            onValueChange={(value) => setAnoSelecionado(parseInt(value))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANOS.map(ano => (
                <SelectItem key={ano} value={ano.toString()}>
                  {ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-auto">
            Configurando períodos para {anoSelecionado}
          </span>
        </div>

        <div className="space-y-3 py-4">
          {periodos.map((periodo) => (
            <div key={periodo.mes_referencia} className="grid gap-3 p-4 border rounded-lg">
              <h3 className="font-semibold text-base">
                {periodo.nome_periodo}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">Data de Início</Label>
                  <Input
                    type="date"
                    value={periodo.data_inicio}
                    onChange={(e) => updatePeriodo(periodo.mes_referencia, "data_inicio", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Data de Fim</Label>
                  <Input
                    type="date"
                    value={periodo.data_fim}
                    onChange={(e) => updatePeriodo(periodo.mes_referencia, "data_fim", e.target.value)}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Período: {periodo.data_inicio ? format(new Date(periodo.data_inicio + 'T00:00:00'), "dd/MM/yyyy") : "___"} até {periodo.data_fim ? format(new Date(periodo.data_fim + 'T00:00:00'), "dd/MM/yyyy") : "___"}
              </p>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            Salvar Todos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
