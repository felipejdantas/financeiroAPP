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
import { format, isSameMonth, parseISO, parse } from "date-fns";
import { cn } from "@/lib/utils";
import { z } from "zod";

const fixedCostSchema = z.object({
    title: z.string().trim().min(1, "Título é obrigatório"),
    amount: z.coerce.number({ message: "Valor inválido" }).positive("Valor deve ser maior que zero"),
    category: z.string().trim().min(1, "Categoria é obrigatória"),
    due_day: z.coerce.number({ message: "Dia de vencimento inválido" }).int().min(1, "Dia deve ser entre 1 e 31").max(31, "Dia deve ser entre 1 e 31"),
});

const payAmountSchema = z.coerce.number({ message: "Valor inválido" }).positive("Valor deve ser maior que zero");

const formatMonth = (monthStr: string) => {
    // monthStr is "yyyy-MM"
    const [year, month] = monthStr.split("-");
    const monthNames = [
        "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
        "Jul", "Ago", "Set", "Out", "Nov", "Dez"
    ];
    const monthIdx = parseInt(month, 10) - 1;
    return `${monthNames[monthIdx]}/${year.substring(2)}`;
};

interface FixedCost {
    responsavel?: string;
    id: number;
    title: string;
    description?: string;
    amount: number;
    category: string;
    due_day: number;
    last_paid_date?: string;
    last_paid_competence?: string;
    auto_generate?: boolean;
    payment_method?: string;
    total_cycles?: number;
}

export const FixedCosts = () => {
    const [costs, setCosts] = useState<FixedCost[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isPayOpen, setIsPayOpen] = useState(false);
    const [selectedCost, setSelectedCost] = useState<FixedCost | null>(null);
    const [categorias, setCategorias] = useState<string[]>([]);
    const [responsaveis, setResponsaveis] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [paidMonthsMap, setPaidMonthsMap] = useState<Record<number, string[]>>({});
    const { toast } = useToast();

    // UI States for "New Responsible" input
    const [showNewResponsavelInputFormData, setShowNewResponsavelInputFormData] = useState(false);
    const [newResponsavelFormData, setNewResponsavelFormData] = useState("");

    const [showNewResponsavelInputPayData, setShowNewResponsavelInputPayData] = useState(false);
    const [newResponsavelPayData, setNewResponsavelPayData] = useState("");

    // Form States
    const [formData, setFormData] = useState({
        title: "",
        amount: "",
        category: "",
        due_day: "",
        description: "",
        auto_generate: true,
        payment_method: "Débito",
        total_cycles: "",
        responsavel: "Felipe"
    });

    const [payData, setPayData] = useState({
        date: format(new Date(), "yyyy-MM-dd"),
        method: "Débito" as "Crédito" | "Débito" | "Pix" | "Dinheiro",
        amount: "",
        responsavel: "Felipe",
        referenceMonth: format(new Date(), "yyyy-MM") // Formato YYYY-MM
    });

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
            const costsList = (data as any) || [];
            setCosts(costsList);

            if (costsList.length > 0) {
                const costIds = costsList.map((c: any) => c.id);

                // Buscar lançamentos de cartão
                const { data: cartaoData } = await supabase
                    .from("Financeiro Cartão" as any)
                    .select("fixed_cost_id, Data, status, Descrição")
                    .in("fixed_cost_id", costIds);

                // Buscar lançamentos de débito/pix/dinheiro
                const { data: debitoData } = await supabase
                    .from("Financeiro Debito" as any)
                    .select("fixed_cost_id, Data, status, Descrição")
                    .in("fixed_cost_id", costIds);

                const allExpenses = [...(cartaoData || []), ...(debitoData || [])];
                const paidExpenses = allExpenses.filter((exp: any) => exp.status !== 'pendente');

                const map: Record<number, string[]> = {};
                costsList.forEach((c: any) => {
                    map[c.id] = [];
                });

                paidExpenses.forEach((exp: any) => {
                    const costId = exp.fixed_cost_id;
                    if (!costId) return;

                    let monthStr = "";
                    const desc = exp.Descrição || "";

                    const refMatchObj = desc.match(/\(Ref:\s*(\d{2})\/(\d{4})\)/);
                    if (refMatchObj && refMatchObj[1] && refMatchObj[2]) {
                        monthStr = `${refMatchObj[2]}-${refMatchObj[1]}`;
                    } else {
                        const refMatchObj2 = desc.match(/\(Ref:\s*(\d{4})-(\d{2})\)/);
                        if (refMatchObj2 && refMatchObj2[1] && refMatchObj2[2]) {
                            monthStr = `${refMatchObj2[1]}-${refMatchObj2[2]}`;
                        } else {
                            const dateParts = (exp.Data || "").split("/");
                            if (dateParts.length === 3) {
                                monthStr = `${dateParts[2]}-${dateParts[1]}`;
                            }
                        }
                    }

                    if (monthStr && !map[costId].includes(monthStr)) {
                        map[costId].push(monthStr);
                    }
                });

                Object.keys(map).forEach((key: any) => {
                    map[key].sort((a, b) => a.localeCompare(b));
                });

                setPaidMonthsMap(map);
            }
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

    const fetchResponsaveis = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch distinct responsibles from both tables (last 500 records to gather recent names)
            const { data: cartao } = await supabase.from("Financeiro Cartão").select("Responsavel").order("created_at", { ascending: false }).limit(500);
            const { data: debito } = await supabase.from("Financeiro Debito").select("Responsavel").order("created_at", { ascending: false }).limit(500);

            const names = new Set<string>();

            // Add defaults
            names.add("Felipe");
            names.add("Dantas");
            names.add("Danta Info");
            names.add("Sistema");

            if (cartao) cartao.forEach((d: any) => { if (d.Responsavel) names.add(d.Responsavel); });
            if (debito) debito.forEach((d: any) => { if (d.Responsavel) names.add(d.Responsavel); });

            setResponsaveis(Array.from(names).sort());
        } catch (error) {
            console.error("Error fetching responsibles:", error);
        }
    };

    useEffect(() => {
        fetchCosts();
        fetchCategorias();
        fetchResponsaveis();
    }, []);

    const handleSave = async () => {
        const parsed = fixedCostSchema.safeParse({
            title: formData.title,
            amount: formData.amount,
            category: formData.category,
            due_day: formData.due_day,
        });
        if (!parsed.success) {
            toast({ title: "Dados inválidos", description: parsed.error.issues[0]?.message, variant: "destructive" });
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user found");

            const payload = {
                user_id: user.id,
                title: parsed.data.title,
                amount: parsed.data.amount,
                category: parsed.data.category,
                due_day: parsed.data.due_day,
                description: formData.description,
                auto_generate: false, // BYPASS DB TRIGGER enforced
                payment_method: formData.payment_method,
                total_cycles: formData.total_cycles ? parseInt(formData.total_cycles) : null,
                responsavel: formData.responsavel
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
                savedCostId = (data as any).id;
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

    // --- LOGICA DE GERAÇÃO (FRONTEND) OTIMIZADA ---
    // Gera 24 meses para frente em lote (Batch) para evitar lentidão
    const handleAutoGenerateInFrontend = async (userId: string, cost: any) => {
        try {
            const tableName = cost.payment_method === 'Crédito' ? 'Financeiro Cartão' : 'Financeiro Debito';

            // 1. Busca TODAS as despesas existentes para este custo fixo de uma vez só
            const { data: existingExpenses } = await supabase
                .from(tableName)
                .select('Data')
                .eq('fixed_cost_id', cost.id);

            // Check Cycle Limit
            const maxCycles = cost.total_cycles;
            let currentCount = existingExpenses?.length || 0;

            if (maxCycles && currentCount >= maxCycles) {
                console.log(`Limite de parcelas atingido para ${cost.title}: ${currentCount}/${maxCycles}`);
                return;
            }

            // Set de datas existentes para busca rápida (formato MM/yyyy)
            const existingDates = new Set(
                (existingExpenses || []).map(e => {
                    const parts = e.Data.split('/'); // assumindo DD/MM/YYYY
                    if (parts.length === 3) return `${parts[1]}/${parts[2]}`; // MM/yyyy
                    return '';
                })
            );

            const toInsert = [];
            const today = new Date();
            let baseDate = new Date(today.getFullYear(), today.getMonth(), 1);

            // 2. Loop local de cálculo (sem chamadas ao banco)
            for (let i = 0; i < 24; i++) {
                // Se temos limite, paramos quando atingir
                if (maxCycles && (currentCount + toInsert.length) >= maxCycles) {
                    break;
                }

                let targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);

                // Safe Day Logic
                const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
                const safeDay = Math.min(cost.due_day, lastDayOfMonth);
                targetDate.setDate(safeDay);

                const monthYearStr = format(targetDate, "MM/yyyy");

                // Se já existe, pula
                if (existingDates.has(monthYearStr)) {
                    continue;
                }

                // Adiciona ao array de inserção em massa
                const dateStr = format(targetDate, "dd/MM/yyyy");

                // Formatar descrição da parcela se tiver limite
                let descricao = `${cost.title} (Custo Fixo)`;
                if (maxCycles) {
                    const parcelaNum = currentCount + toInsert.length + 1;
                    descricao = `${cost.title} (${parcelaNum}/${maxCycles})`;
                }

                toInsert.push({
                    user_id: userId,
                    "Responsavel": cost.responsavel || 'Sistema',
                    "Tipo": cost.payment_method,
                    "Categoria": cost.category,
                    "Parcelas": 'A vista',
                    "Descrição": descricao,
                    "Data": dateStr,
                    "valor": cost.amount,
                    "status": 'pendente',
                    "fixed_cost_id": cost.id,
                    "created_at": new Date().toISOString()
                });
            }

            // 3. Inserção em massa (Batch Insert) - 1 única chamada
            if (toInsert.length > 0) {
                const { error } = await supabase
                    .from(tableName)
                    .insert(toInsert);

                if (error) console.error("Erro no batch insert:", error);
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
        // Default reference month:
        // If paid this month (by competence), suggest next month.
        // Otherwise, current month.
        let defaultRef = format(new Date(), "yyyy-MM");

        if (cost.last_paid_competence) {
            const lastComp = parseISO(cost.last_paid_competence);
            const nextComp = new Date(lastComp.getFullYear(), lastComp.getMonth() + 1, 1);
            defaultRef = format(nextComp, "yyyy-MM");
        }

        setPayData({
            date: format(new Date(), "yyyy-MM-dd"),
            method: "Pix",
            amount: cost.amount.toString(),
            responsavel: cost.responsavel || "Felipe",
            referenceMonth: defaultRef
        });
        setIsPayOpen(true);
    };

    const handlePay = async () => {
        if (!selectedCost) return;

        const parsedAmount = payAmountSchema.safeParse(payData.amount);
        if (!parsedAmount.success) {
            toast({ title: "Valor inválido", description: parsedAmount.error.issues[0]?.message, variant: "destructive" });
            return;
        }

        // Validação para evitar duplicidade de lançamento para a mesma competência
        const costPaidMonths = paidMonthsMap[selectedCost.id] || [];
        if (costPaidMonths.includes(payData.referenceMonth)) {
            const formattedRefMonth = formatMonth(payData.referenceMonth);
            const proceed = window.confirm(
                `Atenção: Já existe um lançamento cadastrado para a despesa "${selectedCost.title}" no mês de referência ${formattedRefMonth}.\n\nDeseja continuar com o cadastro da despesa novamente?`
            );
            if (!proceed) return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user found");

            // 1. Insert into expenses (PAGO)
            const tableName = payData.method === "Crédito" ? "Financeiro Cartão" : "Financeiro Debito";

            const payDate = parseISO(payData.date);

            // Usar MÊS DE REFERÊNCIA para buscar pendências e limpar (MM/yyyy)
            const monthStr = format(parse(payData.referenceMonth, "yyyy-MM", new Date()), "MM/yyyy");

            // 1. Tenta encontrar o item pendente correspondente (por ID ou por Nome+Mês)
            let pendingItemToDelete = null;

            // Tentativa 1: Pelo ID do Custo Fixo (mais preciso)
            const { data: byId } = await supabase
                .from(tableName as any)
                .select("id, Descrição")
                .eq("fixed_cost_id", selectedCost.id)
                .eq("status", "pendente")
                .ilike("Data", `%/${monthStr}`)
                .maybeSingle();

            if (byId) {
                pendingItemToDelete = byId;
            } else {
                // Tentativa 2: Pelo Nome e Mês (fallback para itens antigos ou gerados sem ID)
                // Usamos o título do custo fixo para tentar casar com a descrição
                // A descrição geralmente é "Titulo (x/12)" ou só "Titulo"
                const { data: byName } = await supabase
                    .from(tableName as any)
                    .select("id, Descrição")
                    .eq("status", "pendente")
                    .ilike("Data", `%/${monthStr}`)
                    .ilike("Descrição", `${selectedCost.title}%`) // Começa com o título
                    .is("fixed_cost_id", null) // Só pega se não tiver ID (para não pegar o de outro custo)
                    .maybeSingle();

                if (byName) {
                    pendingItemToDelete = byName;
                }
            }

            let baseDesc = selectedCost.title;
            if (pendingItemToDelete && (pendingItemToDelete as any).Descrição) {
                baseDesc = (pendingItemToDelete as any).Descrição;
            }
            baseDesc = baseDesc.replace(/\s*\(Ref:\s*\d{2}\/\d{4}\)/g, "").replace(/\s*\(Ref:\s*\d{4}-\d{2}\)/g, "");
            const finalDescription = `${baseDesc} (Ref: ${monthStr})`;

            const newExpense = {
                user_id: user.id,
                Responsavel: payData.responsavel || "Felipe",
                Tipo: payData.method,
                Categoria: selectedCost.category,
                Parcelas: selectedCost.total_cycles ? `${1}/${selectedCost.total_cycles}` : "1/1",
                Descrição: finalDescription, // Salva descrição contendo a referência da competência
                Data: format(parseISO(payData.date), "dd/MM/yyyy"),
                valor: parsedAmount.data,
                created_at: new Date().toISOString(),
                fixed_cost_id: selectedCost.id
            };

            // Inserir o novo pagamento
            const { error: insertError } = await supabase
                .from(tableName as any)
                .insert([newExpense]);

            if (insertError) throw insertError;

            // 2. Se encontrou um item pendente, deleta ele
            if (pendingItemToDelete) {
                await supabase
                    .from(tableName as any)
                    .delete()
                    .eq("id", pendingItemToDelete.id);
            }

            // 3. Atualiza o custo fixo com a última competência paga
            // Parsear a data de referência para salvar corretamente (dia 01 do mês)
            const referenceDate = parse(payData.referenceMonth, "yyyy-MM", new Date());
            const competenceDate = format(referenceDate, "yyyy-MM-01");

            const { error: updateError } = await supabase
                .from("fixed_costs" as any)
                .update({
                    last_paid_at: new Date().toISOString(),
                    last_paid_amount: parsedAmount.data,
                    last_paid_competence: competenceDate
                })
                .eq("id", selectedCost.id);

            if (updateError) throw updateError;

            toast({
                title: "Pagamento registrado!",
                description: `Pagamento de ${selectedCost.title} referente a ${monthStr} realizado com sucesso.`,
            });

            setIsPayOpen(false);
            fetchCosts();
        } catch (error: any) {
            console.error("Error registering payment:", error);
            toast({
                title: "Erro ao registrar pagamento",
                description: error.message,
                variant: "destructive",
            });
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
            payment_method: "Débito",
            total_cycles: "",
            responsavel: "Felipe"
        });
        setSelectedCost(null);
        setShowNewResponsavelInputFormData(false);
        setNewResponsavelFormData("");
    };

    const getStatus = (cost: FixedCost) => {
        const today = new Date();
        const currentMonthStr = format(today, "yyyy-MM");
        
        // Verifica se a competência do mês atual já foi paga
        const paidMonths = paidMonthsMap[cost.id] || [];
        const isPaidThisMonth = paidMonths.includes(currentMonthStr);

        if (isPaidThisMonth) return {
            status: "paid",
            label: "Pago",
            badgeClass: "bg-green-500/10 text-green-500 border border-green-500/20",
            borderClass: "border-l-4 border-l-green-500",
            cardClass: "bg-green-50/10 dark:bg-green-950/5"
        };

        // Quando virar o mês e não estiver pago, fica vermelho (Pendente)
        return {
            status: "unpaid",
            label: "Pendente",
            badgeClass: "bg-red-600 text-white shadow-sm", // Badge vermelho sólido
            borderClass: "border-2 border-red-600", // Borda inteira vermelha
            cardClass: "shadow-md shadow-red-100 dark:shadow-red-900/20 bg-red-50/30 dark:bg-red-900/10" // Fundo avermelhado
        };
    };

    // Helper para gerar meses para o seletor
    const generateReferenceMonths = () => {
        const today = new Date();
        const months = [];
        // Gera 12 meses para trás e 12 para frente
        for (let i = -12; i <= 12; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
            months.push({
                value: format(d, "yyyy-MM"),
                label: format(d, "MMMM/yyyy", {}) // Poderia usar locale pt-BR se importado
            });
        }
        return months;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-2 md:p-8 animate-fade-in">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <h1 className="text-3xl font-bold text-card-foreground text-center md:text-left">
                        Despesas Fixas
                    </h1>
                    <div className="flex flex-wrap gap-2 justify-center md:justify-end w-full md:w-auto">
                        <Button
                            onClick={handleGenerateFutureExpenses}
                            variant="outline"
                            disabled={isGenerating || costs.length === 0}
                            className="flex-1 md:flex-none"
                        >
                            <RefreshCw className={cn("mr-2 h-4 w-4", isGenerating && "animate-spin")} />
                            {isGenerating ? "Gerando..." : "Gerar Pendentes"}
                        </Button>
                        <Button onClick={() => { resetForm(); setIsAddOpen(true); }} className="flex-1 md:flex-none">
                            <Plus className="mr-2 h-4 w-4" /> Novo Custo
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {costs.map((cost) => {
                        const status = getStatus(cost);
                        const costPaidMonths = paidMonthsMap[cost.id] || [];
                        const displayedMonths = costPaidMonths.slice(-6); // Mostrar os últimos 6 lançamentos
                        const hasMoreMonths = costPaidMonths.length > 6;

                        return (
                            <Card key={cost.id} className={cn(
                                "hover:shadow-lg transition-all relative overflow-hidden group",
                                status.borderClass,
                                status.cardClass
                            )}>
                                <div className={cn("absolute top-0 right-0 px-3 py-1 text-xs font-bold rounded-bl-lg z-10", status.badgeClass)}>
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
                                            {cost.total_cycles && ( // VISUALIZAÇÃO DO TOTAL DE PARCELAS
                                                <div className="text-xs text-muted-foreground mt-2 font-medium">
                                                    Limite: {cost.total_cycles} parcelas
                                                </div>
                                            )}

                                            {/* Exibição dos meses lançados para evitar duplicidade */}
                                            <div className="mt-3 text-xs">
                                                <span className="font-semibold text-muted-foreground">Meses lançados:</span>
                                                {costPaidMonths.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {displayedMonths.map((m) => (
                                                            <span
                                                                key={m}
                                                                className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-900/50"
                                                            >
                                                                {formatMonth(m)}
                                                            </span>
                                                        ))}
                                                        {hasMoreMonths && (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-secondary text-muted-foreground border border-secondary">
                                                                +{costPaidMonths.length - 6}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-muted-foreground italic text-[11px] mt-0.5">Nenhum mês lançado</div>
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
                                                    payment_method: cost.payment_method || "Débito",
                                                    total_cycles: cost.total_cycles ? cost.total_cycles.toString() : "",
                                                    responsavel: cost.responsavel || "Felipe"
                                                });
                                                setShowNewResponsavelInputFormData(false); // Reset UI state
                                                setIsAddOpen(true);
                                            }}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(cost.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Botão de pagamento sempre habilitado para permitir antecipação */}
                                    <Button
                                        className={cn("w-full mt-4", status.status === "paid" && "bg-green-600 hover:bg-green-700")}
                                        variant={status.status === "paid" ? "outline" : "default"}
                                        onClick={() => openPayModal(cost)}
                                    >
                                        <Check className="mr-2 h-4 w-4" />
                                        {status.status === "paid"
                                            ? `Pago (${cost.last_paid_competence ? format(parseISO(cost.last_paid_competence), 'MM/yy') : (cost.last_paid_date && format(parseISO(cost.last_paid_date), 'dd/MM'))}) - Antecipar`
                                            : "Registrar Pagamento"
                                        }
                                    </Button>
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
                                <Label>Total de Parcelas (Opcional)</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    placeholder="Ex: 24 (Deixe vazio para infinito)"
                                    value={formData.total_cycles}
                                    onChange={(e) => setFormData({ ...formData, total_cycles: e.target.value })}
                                />
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
                                        <SelectItem value="Débito">Débito</SelectItem>
                                        <SelectItem value="Pix">Pix</SelectItem>
                                        <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                                        <SelectItem value="Crédito">Crédito</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Responsável Padrão</Label>
                                <Select
                                    value={showNewResponsavelInputFormData ? "__novo__" : formData.responsavel}
                                    onValueChange={(val) => {
                                        if (val === "__novo__") {
                                            setShowNewResponsavelInputFormData(true);
                                            setFormData({ ...formData, responsavel: "" });
                                        } else {
                                            setShowNewResponsavelInputFormData(false);
                                            setFormData({ ...formData, responsavel: val });
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {responsaveis.map(r => (
                                            <SelectItem key={r} value={r}>{r}</SelectItem>
                                        ))}
                                        <SelectItem value="__novo__">+ Novo Responsável</SelectItem>
                                    </SelectContent>
                                </Select>
                                {showNewResponsavelInputFormData && (
                                    <Input
                                        placeholder="Digite o nome..."
                                        className="mt-2"
                                        value={newResponsavelFormData}
                                        onChange={(e) => {
                                            setNewResponsavelFormData(e.target.value);
                                            setFormData({ ...formData, responsavel: e.target.value });
                                        }}
                                    />
                                )}
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
                                <Label>Mês de Referência (Competência)</Label>
                                <Select value={payData.referenceMonth} onValueChange={(val) => setPayData({ ...payData, referenceMonth: val })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[200px]">
                                        {generateReferenceMonths().map(m => (
                                            <SelectItem key={m.value} value={m.value}>{m.value} ({m.label})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">O mês que será marcado como pago.</p>
                                {selectedCost && (paidMonthsMap[selectedCost.id] || []).includes(payData.referenceMonth) && (
                                    <div className="flex items-center gap-2 p-2 rounded bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 text-[11px] font-medium mt-1">
                                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                        <span>Atenção: Já existe um lançamento registrado para este mês.</span>
                                    </div>
                                )}
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
                            <div className="grid gap-2">
                                <Label>Responsável</Label>
                                <Select
                                    value={showNewResponsavelInputPayData ? "__novo__" : payData.responsavel}
                                    onValueChange={(val: any) => {
                                        if (val === "__novo__") {
                                            setShowNewResponsavelInputPayData(true);
                                            setPayData({ ...payData, responsavel: "" });
                                        } else {
                                            setShowNewResponsavelInputPayData(false);
                                            setPayData({ ...payData, responsavel: val });
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {responsaveis.map(r => (
                                            <SelectItem key={r} value={r}>{r}</SelectItem>
                                        ))}
                                        <SelectItem value="__novo__">+ Novo Responsável</SelectItem>
                                    </SelectContent>
                                </Select>
                                {showNewResponsavelInputPayData && (
                                    <Input
                                        placeholder="Digite o nome..."
                                        className="mt-2"
                                        value={newResponsavelPayData}
                                        onChange={(e) => {
                                            setNewResponsavelPayData(e.target.value);
                                            setPayData({ ...payData, responsavel: e.target.value });
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsPayOpen(false)}>Cancelar</Button>
                            <Button onClick={handlePay} className="bg-green-600 hover:bg-green-700 text-white">Confirmar Pagamento</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};
