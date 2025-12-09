import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Notification {
    key: string; // Unique key for dismissal
    title: string;
    message: string;
    type: "warning" | "destructive" | "default";
    date?: string;
}

export const Notifications = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [count, setCount] = useState(0);
    const { toast } = useToast();

    useEffect(() => {
        checkNotifications();
    }, []);

    const checkNotifications = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const today = new Date();
            const currentDay = today.getDate();
            const currentMonth = today.getMonth(); // 0-indexed
            const currentYear = today.getFullYear();

            // Fetch dismissals
            const { data: dismissedData } = await supabase
                .from("dismissed_notifications" as any)
                .select("notification_key")
                .eq("user_id", user.id);

            const dismissedKeys = new Set(dismissedData?.map((d: any) => d.notification_key) || []);

            const activeNotifications: Notification[] = [];

            // 1. Check Fixed Costs
            const { data: costs } = await supabase
                .from("fixed_costs" as any)
                .select("*")
                .eq("user_id", user.id);

            if (costs) {
                costs.forEach((cost: any) => {
                    // Check if paid this month
                    let isPaid = false;
                    if (cost.last_paid_date) {
                        const lastPaid = parseISO(cost.last_paid_date);
                        if (lastPaid.getMonth() === currentMonth && lastPaid.getFullYear() === currentYear) {
                            isPaid = true;
                        }
                    }

                    if (!isPaid) {
                        const diff = cost.due_day - currentDay;
                        if (diff < 0) {
                            const key = `fc_${cost.id}_overdue_${currentMonth}_${currentYear}`;
                            if (!dismissedKeys.has(key)) {
                                activeNotifications.push({
                                    key,
                                    title: "Conta Atrasada",
                                    message: `${cost.title} venceu dia ${cost.due_day}`,
                                    type: "destructive"
                                });
                            }
                        } else if (diff <= 3) {
                            const key = `fc_${cost.id}_upcoming_${currentMonth}_${currentYear}`;
                            if (!dismissedKeys.has(key)) {
                                activeNotifications.push({
                                    key,
                                    title: "Vence em Breve",
                                    message: `${cost.title} vence dia ${cost.due_day}`,
                                    type: "warning"
                                });
                            }
                        }
                    }
                });
            }

            // 2. Check Budget Goals
            const { data: budgets } = await (supabase
                .from("budget_planning" as any)
                .select("*")
                .eq("user_id", user.id)
                .eq("ano", currentYear)
                .eq("mes", currentMonth + 1)) as any;

            if (budgets && budgets.length > 0) {
                const [cartaoResult, debitoResult] = await Promise.all([
                    supabase.from("Financeiro Cartão").select("val:valor, cat:Categoria, dt:Data").eq('user_id', user.id),
                    supabase.from("Financeiro Debito").select("val:valor, cat:Categoria, dt:Data").eq('user_id', user.id),
                ]);

                const expenses = [
                    ...(cartaoResult.data || []),
                    ...(debitoResult.data || [])
                ];

                const categoryTotals: Record<string, number> = {};

                expenses.forEach((exp: any) => {
                    const [d, m, y] = exp.dt.split('/');
                    if (parseInt(m) === currentMonth + 1 && parseInt(y) === currentYear) {
                        const val = parseFloat(exp.val) || 0;
                        if (exp.cat) {
                            categoryTotals[exp.cat] = (categoryTotals[exp.cat] || 0) + val;
                        }
                    }
                });

                budgets.forEach((budget: any) => {
                    const actual = categoryTotals[budget.categoria] || 0;
                    const meta = budget.meta || 0;

                    if (meta > 0) {
                        const percentage = (actual / meta) * 100;

                        if (percentage >= 100) {
                            const key = `bg_${budget.categoria}_critical_${currentMonth}_${currentYear}`;
                            if (!dismissedKeys.has(key)) {
                                activeNotifications.push({
                                    key,
                                    title: "Meta Excedida",
                                    message: `Você excedeu o orçamento de ${budget.categoria} (${percentage.toFixed(0)}%)`,
                                    type: "destructive"
                                });
                            }
                        } else if (percentage >= 80) {
                            const key = `bg_${budget.categoria}_warning_${currentMonth}_${currentYear}`;
                            if (!dismissedKeys.has(key)) {
                                activeNotifications.push({
                                    key,
                                    title: "Atenção ao Orçamento",
                                    message: `Você usou ${percentage.toFixed(0)}% do orçamento de ${budget.categoria}`,
                                    type: "warning"
                                });
                            }
                        }
                    }
                });
            }

            setNotifications(activeNotifications);
            setCount(activeNotifications.length);

        } catch (error) {
            console.error("Error checking notifications:", error);
        }
    };

    const handleDismiss = async (key: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Optimistic update
            setNotifications(prev => prev.filter(n => n.key !== key));
            setCount(prev => Math.max(0, prev - 1));

            const { error } = await supabase
                .from("dismissed_notifications" as any)
                .insert([{
                    user_id: user.id,
                    notification_key: key
                }]);

            if (error) throw error;

        } catch (error: any) {
            console.error("Error dismissing notification:", error);
            toast({
                title: "Erro",
                description: "Não foi possível marcar como lida.",
                variant: "destructive"
            });
            // Re-fetch to sync state if failed
            checkNotifications();
        }
    };

    if (notifications.length === 0) {
        return (
            <Button variant="ghost" size="icon" className="relative text-muted-foreground">
                <Bell className="h-5 w-5" />
            </Button>
        );
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {count > 0 && (
                        <Badge className="absolute -top-1 -right-1 px-1 min-w-[1.2rem] h-5 flex items-center justify-center bg-destructive text-destructive-foreground rounded-full text-xs">
                            {count}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium leading-none">Notificações</h4>
                    <span className="text-xs text-muted-foreground">{count} não lidas</span>
                </div>
                <ScrollArea className="h-[300px]">
                    <div className="space-y-4">
                        {notifications.map((notif) => (
                            <div key={notif.key} className="flex flex-col gap-1 border-b pb-2 last:border-0 relative group">
                                <div className="flex justify-between items-start pr-6">
                                    <span className="font-semibold text-sm">{notif.title}</span>
                                    <Badge
                                        variant={notif.type === "destructive" ? "destructive" : "outline"}
                                        className={notif.type === "warning" ? "text-orange-500 border-orange-500" : ""}
                                    >
                                        {notif.type === "destructive" ? "Crítico" : (notif.type === "warning" ? "Alerta" : "Info")}
                                    </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {notif.message}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleDismiss(notif.key)}
                                    title="Marcar como lida"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
};
