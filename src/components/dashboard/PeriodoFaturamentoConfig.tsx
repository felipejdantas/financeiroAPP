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

interface PeriodoFaturamentoConfigProps {
  dataInicio: string;
  dataFim: string;
  onSave: (dataInicio: string, dataFim: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PeriodoFaturamentoConfig = ({
  dataInicio,
  dataFim,
  onSave,
  open,
  onOpenChange,
}: PeriodoFaturamentoConfigProps) => {
  const [novaDataInicio, setNovaDataInicio] = useState(dataInicio);
  const [novaDataFim, setNovaDataFim] = useState(dataFim);

  // Atualiza os estados quando as props mudam
  useEffect(() => {
    setNovaDataInicio(dataInicio);
    setNovaDataFim(dataFim);
  }, [dataInicio, dataFim]);

  const handleSave = () => {
    onSave(novaDataInicio, novaDataFim);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Ajuste Temporário - Período Atual</DialogTitle>
            <DialogDescription>
              Ajusta o período apenas para visualização. Para configurar permanentemente, use "Configurar Meses".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="dataInicio">Data de início</Label>
              <Input
                id="dataInicio"
                type="date"
                value={novaDataInicio}
                onChange={(e) => setNovaDataInicio(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dataFim">Data de fim</Label>
              <Input
                id="dataFim"
                type="date"
                value={novaDataFim}
                onChange={(e) => setNovaDataFim(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Este ajuste é temporário e volta ao padrão ao recarregar a página.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
};
