import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Despesa } from "@/types/despesa";
import { Clock, DollarSign, Trash2 } from "lucide-react";

interface PendingExpensesProps {
    despesas: Despesa[];
    onDelete: (id: number) => void;
}

export const PendingExpenses = ({ despesas, onDelete }: PendingExpensesProps) => {
    const totalPendente = despesas.reduce((sum, d) => sum + (d.valor || 0), 0);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);
    };

    if (despesas.length === 0) {
        return null;
    }

    return (
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
                    <Clock className="h-5 w-5" />
                    Despesas Programadas (Custos Fixos)
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/50 dark:bg-black/20 rounded-lg">
                    <div>
                        <p className="text-sm text-muted-foreground">Total Programado</p>
                        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                            {formatCurrency(totalPendente)}
                        </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-orange-500" />
                </div>

                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">
                        {despesas.length} despesa{despesas.length > 1 ? 's' : ''} pendente{despesas.length > 1 ? 's' : ''}:
                    </p>
                    {despesas.map((despesa, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-white/70 dark:bg-black/30 rounded-md hover:bg-white/90 dark:hover:bg-black/40 transition-colors group"
                        >
                            <div className="flex-1">
                                <p className="font-medium text-sm text-foreground">
                                    {despesa.Descrição}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {despesa.Categoria} • {despesa.Tipo}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <p className="font-semibold text-orange-600 dark:text-orange-400">
                                    {formatCurrency(despesa.valor)}
                                </p>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => onDelete(despesa.id!)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="pt-2 border-t border-orange-200 dark:border-orange-800">
                    <p className="text-xs text-center text-muted-foreground">
                        💡 Estas despesas aparecerão em Transações quando você registrar o pagamento
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};
