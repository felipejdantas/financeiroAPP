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
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PeriodoMensal {
  mes_referencia: number;
  dia_inicio: number;
  mes_inicio_offset: number;
  dia_fim: number;
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

export const PeriodosMensaisManager = ({ userId, onUpdate, open, onOpenChange }: PeriodosMensaisManagerProps) => {
  const [periodos, setPeriodos] = useState<PeriodoMensal[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && userId) {
      loadPeriodos();
    }
  }, [open, userId]);

  const loadPeriodos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("periodos_mensais_cartao")
        .select("*")
        .eq("user_id", userId)
        .order("mes_referencia");

      if (error) throw error;

      // Inicializa com períodos padrão se não existirem
      const periodosMap = new Map(
        data?.map(p => [p.mes_referencia, p]) || []
      );

      const todosPeriodos: PeriodoMensal[] = [];
      for (let mes = 1; mes <= 12; mes++) {
        const existente = periodosMap.get(mes);
        if (existente) {
          todosPeriodos.push({
            mes_referencia: existente.mes_referencia,
            dia_inicio: existente.dia_inicio,
            mes_inicio_offset: existente.mes_inicio_offset,
            dia_fim: existente.dia_fim,
          });
        } else {
          // Padrão: do dia 1 ao último dia do mês
          todosPeriodos.push({
            mes_referencia: mes,
            dia_inicio: 1,
            mes_inicio_offset: 0,
            dia_fim: new Date(2024, mes, 0).getDate(), // último dia do mês
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
      // Deleta todos os períodos existentes do usuário
      await supabase
        .from("periodos_mensais_cartao")
        .delete()
        .eq("user_id", userId);

      // Insere os novos períodos
      const periodosParaInserir = periodos.map(p => ({
        user_id: userId,
        mes_referencia: p.mes_referencia,
        dia_inicio: p.dia_inicio,
        mes_inicio_offset: p.mes_inicio_offset,
        dia_fim: p.dia_fim,
      }));

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

  const updatePeriodo = (mes: number, field: keyof PeriodoMensal, value: number) => {
    setPeriodos(prev =>
      prev.map(p =>
        p.mes_referencia === mes ? { ...p, [field]: value } : p
      )
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Períodos Mensais do Cartão</DialogTitle>
            <DialogDescription>
              Configure o período de faturamento para cada mês do ano. Essas configurações se repetem anualmente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {periodos.map((periodo) => (
              <div key={periodo.mes_referencia} className="grid gap-3 p-4 border rounded-lg">
                <h3 className="font-semibold">
                  {MESES[periodo.mes_referencia - 1]}
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Início</Label>
                    <div className="flex gap-2">
                      <Select
                        value={periodo.mes_inicio_offset.toString()}
                        onValueChange={(value) =>
                          updatePeriodo(periodo.mes_referencia, "mes_inicio_offset", parseInt(value))
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-1">Mês anterior</SelectItem>
                          <SelectItem value="0">Mesmo mês</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={periodo.dia_inicio}
                        onChange={(e) =>
                          updatePeriodo(periodo.mes_referencia, "dia_inicio", parseInt(e.target.value))
                        }
                        className="w-20"
                        placeholder="Dia"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Fim (no próprio mês)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={periodo.dia_fim}
                      onChange={(e) =>
                        updatePeriodo(periodo.mes_referencia, "dia_fim", parseInt(e.target.value))
                      }
                      className="w-20"
                      placeholder="Dia"
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Exemplo: {periodo.mes_inicio_offset === -1 ? "Mês anterior" : "Mesmo mês"} dia {periodo.dia_inicio} até dia {periodo.dia_fim}
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
