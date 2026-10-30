import { useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RegistrarPagamentoSheetProps {
  conta: { user_id: string; email: string; nome: string | null; ativo_ate: string | null } | null;
  onOpenChange: (open: boolean) => void;
  onRegistrado: () => void;
}

export const RegistrarPagamentoSheet = ({ conta, onOpenChange, onRegistrado }: RegistrarPagamentoSheetProps) => {
  const { toast } = useToast();
  const [dias, setDias] = useState("30");
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (conta) {
      setDias("30");
      setValor("");
      setObservacao("");
    }
  }, [conta]);

  const diasNumero = Number(dias);
  const diasValidos = Number.isInteger(diasNumero) && diasNumero >= 1 && diasNumero <= 3660;

  // Mesma regra do banco (fin_admin_registrar_pagamento): soma ao que falta; se já venceu, conta de hoje
  const vencimentoAtual = conta?.ativo_ate ? new Date(conta.ativo_ate) : null;
  const base = vencimentoAtual && vencimentoAtual > new Date() ? vencimentoAtual : new Date();
  const novoVencimento = diasValidos ? addDays(base, diasNumero) : null;

  const handleRegistrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conta) return;
    setSalvando(true);
    const { data, error } = await supabase.rpc("fin_admin_registrar_pagamento" as any, {
      p_user_id: conta.user_id,
      p_dias: diasNumero,
      p_valor: valor.trim() === "" ? null : Number(valor.replace(",", ".")),
      p_observacao: observacao.trim() || null,
    });
    setSalvando(false);
    if (error) {
      toast({ title: "Erro ao registrar pagamento", description: error.message, variant: "destructive" });
      return;
    }
    const ativoAte = (data as unknown as { ativo_ate: string })?.ativo_ate;
    toast({
      title: "Pagamento registrado!",
      description: ativoAte ? `${conta.nome || conta.email} tem acesso até ${format(new Date(ativoAte), "dd/MM/yyyy")}.` : undefined,
    });
    onRegistrado();
    onOpenChange(false);
  };

  return (
    <Sheet open={!!conta} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" /> Registrar pagamento
          </SheetTitle>
          <SheetDescription>
            {conta?.nome || conta?.email}. Os dias são somados ao que ainda falta, e a conta é desbloqueada.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleRegistrar} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pag-dias">Dias de acesso</Label>
              <Input id="pag-dias" type="number" min={1} max={3660} value={dias} onChange={(e) => setDias(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pag-valor">Valor pago (opcional)</Label>
              <Input id="pag-valor" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pag-obs">Observação (opcional)</Label>
            <Input id="pag-obs" placeholder="Ex: Pix, mensalidade de novembro" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>

          <div className="p-3 border rounded-lg text-sm space-y-1 bg-secondary/30">
            <p>
              <span className="text-muted-foreground">Vencimento atual:</span>{" "}
              {vencimentoAtual ? format(vencimentoAtual, "dd/MM/yyyy") : "nenhum"}
              {vencimentoAtual && vencimentoAtual <= new Date() && " (vencido)"}
            </p>
            {novoVencimento && (
              <p>
                <span className="text-muted-foreground">Novo vencimento:</span>{" "}
                <strong>{format(novoVencimento, "dd/MM/yyyy")}</strong>
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={salvando || !diasValidos}>
            {salvando ? "Registrando..." : "Registrar pagamento"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
};
