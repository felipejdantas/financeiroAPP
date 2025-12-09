import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from "recharts";

interface BudgetVsActualProps {
    currentMonth: number;
    currentYear: number;
    userId: string;
}

interface CategoryData {
    name: string;
    budget: number;
    actual: number;
    percentage: number;
}

export function BudgetVsActual({ currentMonth, currentYear, userId }: BudgetVsActualProps) {
    const [data, setData] = useState<CategoryData[]>([]);
    const [totalBudget, setTotalBudget] = useState(0);
    const [totalActual, setTotalActual] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [currentMonth, currentYear, userId]);

    const fetchData = async () => {
        if (!userId) return;
        setLoading(true);

        try {
            // 1. Fetch Budget Goals
            const { data: budgets, error: budgetError } = await (supabase
                .from("budget_planning" as any)
                .select("*")
                .eq("user_id", userId)
                .eq("ano", currentYear)) as any;

            if (budgetError) throw budgetError;

            // 2. Fetch Actual Expenses
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

            // 3. Process Data
            const categoryMap: Record<string, { budget: number; actual: number }> = {};

            // Initialize with budgets
            budgets?.forEach((b: any) => {
                if (!categoryMap[b.categoria]) {
                    categoryMap[b.categoria] = { budget: 0, actual: 0 };
                }
                categoryMap[b.categoria].budget = b.meta || 0;
            });

            // Sum actuals for the current month
            allExpenses.forEach((expense: any) => {
                const [dia, mes, ano] = expense.Data.split('/');
                const expenseMonth = parseInt(mes);
                const expenseYear = parseInt(ano);

                if (expenseMonth === currentMonth && expenseYear === currentYear) {
                    const cat = expense.Categoria;
                    if (!categoryMap[cat]) {
                        categoryMap[cat] = { budget: 0, actual: 0 };
                    }
                    categoryMap[cat].actual += expense.valor || 0;
                }
            });

            // Convert to array and sort
            let totalB = 0;
            let totalA = 0;
            const processedData: CategoryData[] = Object.entries(categoryMap)
                .map(([name, values]) => {
                    totalB += values.budget;
                    totalA += values.actual;
                    return {
                        name,
                        budget: values.budget,
                        actual: values.actual,
                        percentage: values.budget > 0 ? (values.actual / values.budget) * 100 : 0
                    };
                })
                .filter(item => item.budget > 0) // Only show items with a defined budget
                .sort((a, b) => b.percentage - a.percentage); // Sort by highest percentage used

            setData(processedData);
            setTotalBudget(totalB);
            setTotalActual(totalA);

        } catch (error) {
            console.error("Error fetching budget vs actual:", error);
        } finally {
            setLoading(false);
        }
    };

    const totalPercentage = totalBudget > 0 ? Math.min((totalActual / totalBudget) * 100, 100) : 0;
    const chartData = [
        { name: "Used", value: totalActual, color: "hsl(var(--primary))" }, // Theme Primary
        { name: "Remaining", value: Math.max(totalBudget - totalActual, 0), color: "hsl(var(--muted))" } // Theme Muted
    ];

    if (loading) return <div className="h-64 flex items-center justify-center">Carregando...</div>;

    return (
        <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                    DESPESAS: REALIZADO VS PLANEJADO
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* List of Categories */}
                    <div className="md:col-span-2 space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {data.map((item) => (
                            <div key={item.name} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-slate-700 dark:text-slate-300 w-32 truncate" title={item.name}>
                                        {item.name}
                                    </span>
                                    <div className="flex gap-4 text-xs">
                                        <span className="font-bold text-slate-600 dark:text-slate-400">
                                            {item.percentage.toFixed(1)}%
                                        </span>
                                        <span className="text-slate-500 w-24 text-right">
                                            R$ {item.actual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                                <Progress
                                    value={Math.min(item.percentage, 100)}
                                    className="h-2"
                                    indicatorClassName={item.actual > item.budget ? "bg-destructive" : "bg-primary"}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Circular Chart */}
                    <div className="h-64 relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    startAngle={90}
                                    endAngle={-270}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-4xl font-bold text-slate-800 dark:text-white">
                                {Math.round(totalPercentage)}%
                            </span>
                            <span className="text-xs text-slate-500 uppercase mt-1">do orçamento</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
