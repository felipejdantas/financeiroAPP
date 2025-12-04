import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";

interface BudgetData {
    categoria: string;
    meta: number;
    actual: number[];
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function Planning() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [userId, setUserId] = useState<string | null>(null);
    const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
    const [budgetData, setBudgetData] = useState<Record<string, BudgetData>>({});
    const [loading, setLoading] = useState(true);
    const [categorias, setCategorias] = useState<string[]>([]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUserId(session.user.id);
            } else {
                navigate('/auth');
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                setUserId(session.user.id);
            } else {
                navigate('/auth');
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate]);

    useEffect(() => {
        if (userId) {
            fetchData();
        }
    }, [userId, anoSelecionado]);

    const fetchData = async () => {
        if (!userId) return;
        setLoading(true);

        try {
            // Fetch categories
            const { data: cats, error: catError } = await supabase
                .from("categorias")
                .select("nome")
                .eq("user_id", userId)
                .order("nome");

            if (catError) throw catError;
            const categoryNames = cats?.map(c => c.nome) || [];
            setCategorias(categoryNames);

            // Fetch budget goals
            const { data: budgets, error: budgetError } = await supabase
                .from("budget_planning")
                .select("*")
                .eq("user_id", userId)
                .eq("ano", anoSelecionado);

            if (budgetError) throw budgetError;

            // Fetch actual expenses
            const [cartaoResult, debitoResult] = await Promise.all([
                supabase.from("Financeiro Cartão").select("*").eq('user_id', userId),
                supabase.from("Financeiro Debito").select("*").eq('user_id', userId),
            ]);

            if (cartaoResult.error) throw cartaoResult.error;
            if (debitoResult.error) throw debitoResult.error;

            const allExpenses = [
                ...(cartaoResult.data || []),
                ...(debitoResult.data || []),
            ];

            // Process data
            const budgetMap: Record<string, BudgetData> = {};

            categoryNames.forEach(cat => {
                const monthlyActuals = new Array(12).fill(0);

                // Calculate actual spending per month
                allExpenses.forEach(expense => {
                    if (expense.Categoria === cat) {
                        const [dia, mes, ano] = expense.Data.split('/');
                        const expenseYear = parseInt(ano);
                        const expenseMonth = parseInt(mes) - 1; // 0-indexed

                        if (expenseYear === anoSelecionado) {
                            monthlyActuals[expenseMonth] += expense.valor || 0;
                        }
                    }
                });

                // Get budget goal (default to 0)
                const categoryBudgets = budgets?.filter(b => b.categoria === cat) || [];
                const meta = categoryBudgets.reduce((sum, b) => sum + (b.meta || 0), 0) / 12; // Average monthly budget

                budgetMap[cat] = {
                    categoria: cat,
                    meta: meta,
                    actual: monthlyActuals
                };
            });

            setBudgetData(budgetMap);
        } catch (error: any) {
            console.error("Erro ao carregar dados:", error);
            toast({
                title: "Erro ao carregar dados",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleBudgetChange = async (categoria: string, newMeta: number) => {
        if (!userId) return;

        try {
            // Update all 12 months with the same budget
            const updates = MONTHS.map((_, index) => ({
                user_id: userId,
                categoria: categoria,
                mes: index + 1,
                ano: anoSelecionado,
                meta: newMeta
            }));

            const { error } = await supabase
                .from("budget_planning")
                .upsert(updates, { onConflict: 'user_id, categoria, mes, ano' });

            if (error) throw error;

            // Update local state
            setBudgetData(prev => ({
                ...prev,
                [categoria]: {
                    ...prev[categoria],
                    meta: newMeta
                }
            }));

            toast({
                title: "Meta atualizada",
                description: `Meta de ${categoria} atualizada com sucesso!`,
            });
        } catch (error: any) {
            console.error("Erro ao atualizar meta:", error);
            toast({
                title: "Erro ao atualizar meta",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const totalBudget = Object.values(budgetData).reduce((sum, cat) => sum + cat.meta, 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-3 md:p-6">
            <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                            Planejamento de Orçamento
                        </h1>
                        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
                            Defina metas e acompanhe seus gastos mensais
                        </p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <Select value={anoSelecionado.toString()} onValueChange={(value) => setAnoSelecionado(parseInt(value))}>
                            <SelectTrigger className="w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent side="bottom">
                                <SelectItem value="2024">2024</SelectItem>
                                <SelectItem value="2025">2025</SelectItem>
                                <SelectItem value="2026">2026</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={fetchData} size="icon">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Orçamento Total: R$ {totalBudget.toFixed(2)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-2 sticky left-0 bg-background z-10">Categoria</th>
                                        <th className="text-right p-2">Meta Mensal</th>
                                        <th className="text-right p-2">%</th>
                                        {MONTHS.map(month => (
                                            <th key={month} className="text-right p-2 min-w-[100px]">{month} {anoSelecionado}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.values(budgetData).map((cat) => (
                                        <tr key={cat.categoria} className="border-b hover:bg-muted/50">
                                            <td className="p-2 font-medium sticky left-0 bg-background">{cat.categoria}</td>
                                            <td className="p-2">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={cat.meta}
                                                    onChange={(e) => handleBudgetChange(cat.categoria, parseFloat(e.target.value) || 0)}
                                                    className="w-24 text-right"
                                                />
                                            </td>
                                            <td className="text-right p-2">
                                                {totalBudget > 0 ? ((cat.meta / totalBudget) * 100).toFixed(1) : 0}%
                                            </td>
                                            {cat.actual.map((value, index) => (
                                                <td
                                                    key={index}
                                                    className={`text-right p-2 ${value > cat.meta ? 'text-red-600 font-bold' : ''}`}
                                                >
                                                    R$ {value.toFixed(2)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
