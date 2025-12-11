
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, ArrowUpDown } from "lucide-react";
import { Despesa } from "@/types/despesa";
import { format } from "date-fns";

// Adapting type for Revenue (similar to Despesa but for Receita)
export type Receita = {
    id: number;
    user_id: string;
    Responsavel: string;
    Categoria: string;
    Descrição: string;
    Data: string;
    valor: number;
    created_at?: string;
};

interface RevenueTableProps {
    receitas: Receita[];
    onEdit: (receita: Receita) => void;
    onDelete: (id: number) => void;
    categoryEmojis?: Record<string, string>;
}

export const RevenueTable = ({ receitas, onEdit, onDelete, categoryEmojis = {} }: RevenueTableProps) => {

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);
    };

    return (
        <div className="rounded-md border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {receitas.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                Nenhuma receita encontrada.
                            </TableCell>
                        </TableRow>
                    ) : (
                        receitas.map((receita) => (
                            <TableRow key={receita.id}>
                                <TableCell>{receita.Data}</TableCell>
                                <TableCell>{receita.Responsavel}</TableCell>
                                <TableCell>
                                    <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                                        {categoryEmojis[receita.Categoria]} {receita.Categoria}
                                    </span>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate" title={receita.Descrição}>
                                    {receita.Descrição}
                                </TableCell>
                                <TableCell className="text-right font-medium text-green-600">
                                    {formatCurrency(receita.valor)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => onEdit(receita)}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => onDelete(receita.id)} className="text-destructive hover:text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
};
