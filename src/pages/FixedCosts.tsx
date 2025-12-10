import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Check, AlertCircle, Trash2, Edit, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, isSameMonth, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface FixedCost {
    id: number;
    title: string;
    description?: string;
    amount: number;
    category: string;
    due_day: number;
    last_paid_date?: string;
    auto_generate?: boolean;
    payment_method?: string;
}

export const FixedCosts = () => {
    const [costs, setCosts] = useState<FixedCost[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isPayOpen, setIsPayOpen] = useState(false);
    const [selectedCost, setSelectedCost] = useState<FixedCost | null>(null);
    const [categorias, setCategorias] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const { toast } = useToast();

    // Form States
    const [formData, setFormData] = useState({
        title: "",
        amount: "",
        category: "",
        due_day: "",
        description: "",
        auto_generate: true,
        payment_method: "Débito"
    });

    const [payData, setPayData] = useState({
        date: format(new Date(), "yyyy-MM-dd"),
        method: "Débito" as "Crédito" | "Débito" | "Pix" | "Dinheiro",
        amount: ""
    });

    useEffect(() => {
        fetchCosts();
        fetchCategorias();
    }, []);

    const fetchCosts = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from("fixed_costs" as any)
                .select("*")
                .eq("user_id", user.id)
                .order("due_day");

            if (error) throw error;
            setCosts((data as any) || []);
        } catch (error) {
            console.error("Error fetching fixed costs:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategorias = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
                .from("categorias" as any)
                .select("nome")
                .eq("user_id", user.id)
                .order("nome") as any;
            setCategorias(data?.map((c: any) => c.nome) || []);
        } catch (error) {
            console.error("Error fetching categories:", error);
        }
    };

    const handleSave = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user found");

            const payload = {
                user_id: user.id,
                title: formData.title,
                amount: parseFloat(formData.amount),
                category: formData.category,
                due_day: parseInt(formData.due_day),
                description: formData.description,
                auto_generate: false, // BYPASS DB TRIGGER enforced
                payment_method: formData.payment_method
            };

            let savedCostId: number;
            let savedCostData: any = { ...payload };

            if (selectedCost) {
                // Update
                // 1. DELETE all existing pending expenses for this cost (to ensure full sync of changes)
                await supabase.from("Financeiro Cartão").delete().eq("fixed_cost_id", selectedCost.id).eq("status", "pendente");
                await supabase.from("Financeiro Debito").delete().eq("fixed_cost_id", selectedCost.id).eq("status", "pendente");

                // 2. Update the definition
                const { error } = await supabase
                    .from("fixed_costs" as any)
                    .update(payload)
                    .eq("id", selectedCost.id);
                if (error) throw error;
                savedCostId = selectedCost.id;
                savedCostData.id = savedCostId;
                toast({ title: "Custo fixo atualizado e pendências sincronizadas!" });
            } else {
                // Insert
                const { data, error } = await supabase
                    .from("fixed_costs" as any)
                    .insert([payload])
                    .select()
                    .single();

                if (error) throw error;
                savedCostId = data.id;
                savedCostData.id = savedCostId;
                toast({ title: "Custo fixo criado!" });
            }

            // MANUAL GENERATION (Frontend safe logic)
            // Works for both Insert and Update (since we deleted pending on update above)
            if (formData.auto_generate) {
                await handleAutoGenerateInFrontend(user.id, {
                    ...savedCostData,
                    auto_generate: true
                });
            }

            setIsAddOpen(false);
            fetchCosts();
            resetForm();
        } catch (error: any) {
            console.error("Error saving:", error);
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        }
    };

    // --- LOGICA DE GERAÇÃO (FRONTEND) ---
    // Agora gera 12 meses para frente garantido
    const handleAutoGenerateInFrontend = async (userId: string, cost: any) => {
        try {
            const today = new Date();
            // Começa do mês ATUAL
            let baseDate = new Date(today.getFullYear(), today.getMonth(), 1);

            // Loop para gerar 24 meses (2 anos) para garantir cobertura total
            for (let i = 0; i < 24; i++) {
                let targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);

                // Safe Day Logic
                const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
                const safeDay = Math.min(cost.due_day, lastDayOfMonth);
                targetDate.setDate(safeDay);

                // Formatamos a data para query e para match
                // Obs: Banco supõe DD/MM/YYYY padrão string no app atual
                const dateStr = format(targetDate, "dd/MM/yyyy");
                const monthYearStr = format(targetDate, "MM/yyyy");

                // Busca duplicata (Pendente ou Pago)
                const tableName = cost.payment_method === 'Crédito' ? 'Financeiro Cartão' : 'Financeiro Debito';

                // Busca se já existe algum item com esse fixed_cost_id e essa data (mês/ano)
                // Usando ILIKE para achar '/MM/yyyy' na string de data
                const { data: existing } = await supabase
                    .from(tableName)
                    .select('id')
                    .eq('fixed_cost_id', cost.id)
                    .ilike('Data', `%/${monthYearStr}`);

                if (existing && existing.length > 0) {
                    continue; // Pula esse mês, já tem registro (pendente ou pago)
                }

                // Inserir Pendência
                await supabase
                    .from(tableName)
                    .insert({
                        user_id: userId,
                        "Responsavel": 'Sistema',
                        "Tipo": cost.payment_method,
                        "Categoria": cost.category,
                        "Parcelas": 'A vista',
                        "Descrição": `${cost.title} (Custo Fixo)`,
                        "Data": dateStr,
                        "valor": cost.amount,
                        "status": 'pendente',
                        "fixed_cost_id": cost.id,
                        "created_at": new Date().toISOString()
                    });
            }

        } catch (e) {
            console.error("Frontend Auto-Gen error", e);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Tem certeza que deseja excluir este custo fixo? Isso removerá também as cobranças pendentes geradas para ele.")) return;
        try {
            // 1. Delete associated PENDING expenses first
            // We verify both tables just in case
            await supabase.from("Financeiro Cartão").delete().eq("fixed_cost_id", id).eq("status", "pendente");
            await supabase.from("Financeiro Debito").delete().eq("fixed_cost_id", id).eq("status", "pendente");

            // 2. Delete the fixed cost definition
            const { error } = await supabase.from("fixed_costs" as any).delete().eq("id", id);

            if (error) throw error;
            toast({ title: "Custo fixo e pendências excluídos" });
            fetchCosts();
        } catch (error) {
            console.error("Error deleting:", error);
            toast({ title: "Erro ao excluir", variant: "destructive" });
        }
    };

    const handleGenerateFutureExpenses = async () => {
        setIsGenerating(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user found");

            // Loop por TODOS os custos fixos existentes e gera para cada um
            for (const cost of costs) {
                if (cost.auto_generate !== false) { // Se não tiver explicitamente desligado
                    await handleAutoGenerateInFrontend(user.id, cost);
                }
            }

            toast({
                title: "Geração Concluída!",
                description: "Verificação de 12 meses realizada com sucesso.",
            });
            fetchCosts();
        } catch (error: any) {
            console.error("Error generating future expenses:", error);
            toast({ title: "Erro ao gerar", description: error.message });
        } finally {
            setIsGenerating(false);
        }
    };

    const openPayModal = (cost: FixedCost) => {
        setSelectedCost(cost);
        setPayData({
            date: format(new Date(), "yyyy-MM-dd"),
            method: "Pix",
            amount: cost.amount.toString()
        });
        setIsPayOpen(true);
    };

    const handlePay = async () => {
        if (!selectedCost) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user found");

            // 1. Insert into expenses (PAGO)
            const tableName = payData.method === "Crédito" ? "Financeiro Cartão" : "Financeiro Debito";
            const { error: insertError } = await supabase
                .from(tableName)
                .insert([{
                    user_id: user.id,
                    Responsavel: "Sistema",
                    Tipo: payData.method,
                    Categoria: selectedCost.category,
                    Parcelas: "A vista",
                    Descrição: `${selectedCost.title} (Custo Fixo)`,
                    Data: format(parseISO(payData.date), "dd/MM/yyyy"),
                    valor: parseFloat(payData.amount),
                    fixed_cost_id: selectedCost.id, // VINCULO IMPORTANTE
                    created_at: new Date().toISOString()
                }]);

            if (insertError) throw insertError;

            // 2. Procurar e Remover a pendência deste mês (Lógica de Limpeza Frontend)
            // A data do pagamento define qual mês estamos pagando.
            const payDate = parseISO(payData.date);
            const monthStr = format(payDate, 'MM/yyyy');

            // Remove do Cartão (se houver pendencia lá)
            await supabase.from("Financeiro Cartão")
                .delete()
                .eq('fixed_cost_id', selectedCost.id)
                .eq('status', 'pendente')
                .ilike('Data', `%/${monthStr}`);

            // Remove do Débito
            await supabase.from("Financeiro Debito")
                .delete()
                .eq('fixed_cost_id', selectedCost.id)
                .eq('status', 'pendente')
                .ilike('Data', `%/${monthStr}`);

            // 3. Update last_paid_date in Fixed Cost def
            const { error: updateError } = await supabase
                .from("fixed_costs" as any)
                .update({ last_paid_date: payData.date })
                .eq("id", selectedCost.id);

            if (updateError) throw updateError;

            toast({ title: "Pagamento registrado!", description: "Próximos meses foram verificados." });

            // 4. GARANTIR FUTURO: Chama a geração para repor qualquer buraco e extender 12 meses
            await handleAutoGenerateInFrontend(user.id, selectedCost);

            setIsPayOpen(false);
            fetchCosts();
        } catch (error: any) {
            console.error(error);
            toast({ title: "Erro ao registrar pagamento", description: error.message, variant: "destructive" });
        }
    };

    const resetForm = () => {
        setFormData({
            title: "",
            amount: "",
            category: "",
            due_day: "",
            description: "",
            auto_generate: true,
            payment_method: "Débito"
        });
        setSelectedCost(null);
    };

    const getStatus = (cost: FixedCost) => {
        const today = new Date();
        const currentDay = today.getDate();
        const dueDay = cost.due_day;

        // Check if paid in current month
        const isPaidThisMonth = cost.last_paid_date && isSameMonth(parseISO(cost.last_paid_date), today);

        if (isPaidThisMonth) return { status: "paid", label: "Pago", color: "text-green-500", bg: "bg-green-500/10" };

        if (currentDay > dueDay) return { status: "overdue", label: "Atrasado", color: "text-red-500", bg: "bg-red-500/10" };

        if (dueDay - currentDay <= 3) return { status: "upcoming", label: "Vence em breve", color: "text-orange-500", bg: "bg-orange-500/10" };

        return { status: "pending", label: "Pendente", color: "text-muted-foreground", bg: "bg-secondary" };
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-card-foreground">
                    Custos Fixos
                </h1>
                <div className="flex gap-2">
                    <Button
                        onClick={handleGenerateFutureExpenses}
                        variant="outline"
                        disabled={isGenerating || costs.length === 0}
                    >
                        <RefreshCw className={cn("mr-2 h-4 w-4", isGenerating && "animate-spin")} />
                        {isGenerating ? "Gerando..." : "Gerar Despesas Pendentes"}
                    </Button>
                    <Button onClick={() => { resetForm(); setIsAddOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Novo Custo
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {costs.map((cost) => {
                    const status = getStatus(cost);
                    return (
                        <Card key={cost.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-primary/50 relative overflow-hidden group">
                            <div className={cn("absolute top-0 right-0 px-3 py-1 text-xs font-bold rounded-bl-lg", status.bg, status.color)}>
                                {status.label}
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex justify-between items-start">
                                    <span className="text-xl">{cost.title}</span>
                                </CardTitle>
                                <div className="text-sm text-muted-foreground">{cost.category}</div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-between items-end mt-4">
                                    <div>
                                        <div className="text-2xl font-bold">
                                            R$ {cost.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            {status.status === 'paid' ? (
                                                <span>Próximo vencimento: {format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, cost.due_day), "dd/MM/yyyy")}</span>
                                            ) : (
                                                <span>Vencimento: {format(new Date(new Date().getFullYear(), new Date().getMonth(), cost.due_day), "dd/MM/yyyy")}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => {
                                            setSelectedCost(cost);
                                            setFormData({
                                                title: cost.title,
                                                amount: cost.amount.toString(),
                                                category: cost.category,
                                                due_day: cost.due_day.toString(),
                                                description: cost.description || "",
                                                auto_generate: cost.auto_generate ?? true,
                                                payment_method: cost.payment_method || "Débito"
                                            });
                                            setIsAddOpen(true);
                                        }}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(cost.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {status.status !== "paid" && (
                                    <Button className="w-full mt-4" onClick={() => openPayModal(cost)}>
                                        <Check className="mr-2 h-4 w-4" /> Registrar Pagamento
                                    </Button>
                                )}
                                {status.status === "paid" && (
                                    <Button className="w-full mt-4" variant="outline" disabled>
                                        <Check className="mr-2 h-4 w-4" /> Pago em {cost.last_paid_date && format(parseISO(cost.last_paid_date), 'dd/MM')}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
                {costs.length === 0 && !loading && (
                    <div className="col-span-full text-center py-10 text-muted-foreground">
                        Nenhum custo fixo cadastrado.
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedCost ? "Editar Custo Fixo" : "Novo Custo Fixo"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Título</Label>
                            <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Ex: Aluguel" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Valor</Label>
                                <Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Dia de Vencimento</Label>
                                <Input type="number" min="1" max="31" value={formData.due_day} onChange={(e) => setFormData({ ...formData, due_day: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Categoria</Label>
                            <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categorias.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Método de Pagamento Padrão</Label>
                            <Select value={formData.payment_method} onValueChange={(val) => setFormData({ ...formData, payment_method: val })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categorias.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                    <SelectItem value="Débito">Débito</SelectItem>
                                    <SelectItem value="Pix">Pix</SelectItem>
                                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                                    <SelectItem value="Crédito">Crédito</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Gerar Automaticamente</Label>
                                <p className="text-xs text-muted-foreground">
                                    Criar uma despesa pendente automaticamente
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={formData.auto_generate}
                                onChange={(e) => setFormData({ ...formData, auto_generate: e.target.checked })}
                                className="h-5 w-5 rounded border-gray-300"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Pay Modal */}
            <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Registrar Pagamento</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Valor a pagar</Label>
                            <Input type="number" value={payData.amount} onChange={(e) => setPayData({ ...payData, amount: e.target.value })} />
                            <p className="text-xs text-muted-foreground">
                                O valor original era R$ {selectedCost?.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label>Data do Pagamento</Label>
                            <Input type="date" value={payData.date} onChange={(e) => setPayData({ ...payData, date: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Forma de Pagamento</Label>
                            <Select value={payData.method} onValueChange={(val: any) => setPayData({ ...payData, method: val })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Débito">Débito</SelectItem>
                                    <SelectItem value="Pix">Pix</SelectItem>
                                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                                    <SelectItem value="Crédito">Crédito</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPayOpen(false)}>Cancelar</Button>
                        <Button onClick={handlePay} className="bg-green-600 hover:bg-green-700 text-white">Confirmar Pagamento</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
