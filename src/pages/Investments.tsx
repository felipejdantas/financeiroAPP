import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, ArrowUpRight, ArrowDownLeft, Trash2, Edit2, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

interface Investment {
  id: number;
  tipo: string;
  valor_atual: number;
  descricao: string;
  created_at: string;
}

const Investments = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Form states
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isRescueModalOpen, setIsRescueModalOpen] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [amount, setAmount] = useState("");
  const [tipo, setTipo] = useState("");
  const [descricao, setDescricao] = useState("");

  const fetchInvestments = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from("investimentos" as any)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvestments(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar investimentos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
      }
    });
  }, []);

  useEffect(() => {
    if (userId) {
      fetchInvestments();
    }
  }, [userId]);

  const handleTransfer = async () => {
    if (!userId || !amount || !tipo) return;

    try {
      const val = parseFloat(amount);
      
      // 1. Procurar se já existe investimento desse tipo
      const existing = investments.find(i => i.tipo === tipo);
      
      if (existing) {
        // Atualizar valor
        const { error: upError } = await supabase
          .from("investimentos" as any)
          .update({ valor_atual: existing.valor_atual + val })
          .eq("id", existing.id);
        if (upError) throw upError;
      } else {
        // Criar novo
        const { error: insError } = await supabase
          .from("investimentos" as any)
          .insert([{
            user_id: userId,
            tipo,
            valor_atual: val,
            descricao
          }]);
        if (insError) throw insError;
      }

      // 2. Criar registro de débito para reduzir o saldo
      const { error: debError } = await supabase
        .from("Financeiro Debito" as any)
        .insert([{
          user_id: userId,
          Responsavel: "Sistema",
          Tipo: "Débito",
          Categoria: "Investimento",
          Descrição: `Transferência para ${tipo}: ${descricao}`,
          Data: format(new Date(), "dd/MM/yyyy"),
          valor: val
        }]);
      if (debError) throw debError;

      toast({ title: "Transferência realizada com sucesso!" });
      setIsTransferModalOpen(false);
      setAmount("");
      setTipo("");
      setDescricao("");
      fetchInvestments();
    } catch (error: any) {
      toast({ title: "Erro na transferência", description: error.message, variant: "destructive" });
    }
  };

  const handleRescue = async () => {
    if (!userId || !amount || !selectedInvestment) return;

    try {
      const val = parseFloat(amount);
      if (val > selectedInvestment.valor_atual) {
        toast({ title: "Valor insuficiente", description: "O valor de resgate é maior que o saldo do investimento.", variant: "destructive" });
        return;
      }

      // 1. Atualizar investimento
      const { error: upError } = await supabase
        .from("investimentos" as any)
        .update({ valor_atual: selectedInvestment.valor_atual - val })
        .eq("id", selectedInvestment.id);
      if (upError) throw upError;

      // 2. Criar registro de receita para aumentar o saldo
      const { error: recError } = await supabase
        .from("Financeiro Receita" as any)
        .insert([{
          user_id: userId,
          Responsavel: "Sistema",
          Categoria: "Resgate Investimento",
          Descrição: `Resgate de ${selectedInvestment.tipo}`,
          Data: format(new Date(), "dd/MM/yyyy"),
          valor: val
        }]);
      if (recError) throw recError;

      toast({ title: "Resgate realizado com sucesso!" });
      setIsRescueModalOpen(false);
      setAmount("");
      setSelectedInvestment(null);
      fetchInvestments();
    } catch (error: any) {
      toast({ title: "Erro no resgate", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Tem certeza que deseja excluir este registro de investimento? O saldo não será devolvido ao caixa automaticamente.")) return;
    try {
      const { error } = await supabase.from("investimentos" as any).delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Investimento excluído." });
      fetchInvestments();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };

  const totalInvestido = investments.reduce((acc, curr) => acc + curr.valor_atual, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Investimentos</h1>
          <p className="text-muted-foreground">Gerencie suas reservas e aplicações financeiras.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <ArrowUpRight className="h-4 w-4" />
                Transferir do Saldo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transferir para Investimento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tipo de Investimento</Label>
                  <Select onValueChange={setTipo} value={tipo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Poupança">Poupança</SelectItem>
                      <SelectItem value="CDB">CDB</SelectItem>
                      <SelectItem value="Tesouro Direto">Tesouro Direto</SelectItem>
                      <SelectItem value="Ações">Ações</SelectItem>
                      <SelectItem value="Cripto">Criptomoedas</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input 
                    type="number" 
                    placeholder="0,00" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição (Opcional)</Label>
                  <Input 
                    placeholder="Ex: Reserva de Emergência" 
                    value={descricao} 
                    onChange={(e) => setDescricao(e.target.value)} 
                  />
                </div>
                <Button className="w-full" onClick={handleTransfer}>Confirmar Transferência</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Investido</CardTitle>
            <PiggyBank className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalInvestido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Soma de todas as suas aplicações</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Maior Alocação</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {investments.length > 0 
                ? [...investments].sort((a,b) => b.valor_atual - a.valor_atual)[0].tipo 
                : "Nenhum"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Investimento com maior saldo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Qtd. Ativos</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{investments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Diferentes tipos de investimento</p>
          </CardContent>
        </Card>
      </div>

      {/* Investment List */}
      <Card>
        <CardHeader>
          <CardTitle>Meus Investimentos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">Carregando...</div>
          ) : investments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Você ainda não possui investimentos registrados.
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-4 font-medium">Tipo</th>
                    <th className="text-left p-4 font-medium">Descrição</th>
                    <th className="text-right p-4 font-medium">Saldo Atual</th>
                    <th className="text-right p-4 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {investments.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-medium">{inv.tipo}</td>
                      <td className="p-4 text-muted-foreground">{inv.descricao || "-"}</td>
                      <td className="p-4 text-right font-bold text-primary">
                        {inv.valor_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-1"
                            onClick={() => {
                              setSelectedInvestment(inv);
                              setIsRescueModalOpen(true);
                            }}
                          >
                            <ArrowDownLeft className="h-4 w-4" />
                            Resgatar
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDelete(inv.id)}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rescue Modal */}
      <Dialog open={isRescueModalOpen} onOpenChange={setIsRescueModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resgatar de {selectedInvestment?.tipo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-md text-sm">
              Saldo disponível: <span className="font-bold text-primary">
                {selectedInvestment?.valor_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="space-y-2">
              <Label>Valor do Resgate</Label>
              <Input 
                type="number" 
                placeholder="0,00" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
              />
            </div>
            <Button className="w-full" onClick={handleRescue}>Confirmar Resgate</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Investments;
