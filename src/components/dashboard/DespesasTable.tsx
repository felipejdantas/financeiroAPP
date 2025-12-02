import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Despesa } from "@/types/despesa";
import { Receipt, Pencil, Trash2, Copy } from "lucide-react";

interface DespesasTableProps {
  despesas: Despesa[];
  onEdit: (despesa: Despesa) => void;
  onDelete: (id: number) => void;
  onDuplicate: (despesa: Despesa) => void;
}

export const DespesasTable = ({ despesas, onEdit, onDelete, onDuplicate }: DespesasTableProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    try {
      // Data já vem formatada como "10/11/2025"
      return dateString;
    } catch {
      return dateString;
    }
  };

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <CardTitle className="text-sm md:text-base lg:text-lg text-card-foreground">
            Todas as Despesas ({despesas.length} {despesas.length === 1 ? 'despesa' : 'despesas'})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0 md:p-6">
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="text-muted-foreground whitespace-nowrap text-[10px] md:text-xs">Data</TableHead>
                <TableHead className="text-muted-foreground whitespace-nowrap text-[10px] md:text-xs">Descrição</TableHead>
                <TableHead className="text-muted-foreground whitespace-nowrap text-[10px] md:text-xs hidden sm:table-cell">Responsável</TableHead>
                <TableHead className="text-muted-foreground whitespace-nowrap text-[10px] md:text-xs hidden md:table-cell">Tipo</TableHead>
                <TableHead className="text-muted-foreground whitespace-nowrap text-[10px] md:text-xs hidden lg:table-cell">Categoria</TableHead>
                <TableHead className="text-muted-foreground whitespace-nowrap text-[10px] md:text-xs">Parcela</TableHead>
                <TableHead className="text-right text-muted-foreground whitespace-nowrap text-[10px] md:text-xs">Valor</TableHead>
                <TableHead className="text-right text-muted-foreground whitespace-nowrap text-[10px] md:text-xs">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {despesas.length > 0 ? (
                despesas.map((despesa, index) => (
                  <TableRow key={index} className="border-border hover:bg-muted/50">
                    <TableCell className="text-foreground font-medium text-[10px] md:text-xs whitespace-nowrap">
                      {formatDate(despesa.Data)}
                    </TableCell>
                    <TableCell className="text-foreground text-[10px] md:text-xs max-w-[120px] truncate">{despesa.Descrição}</TableCell>
                    <TableCell className="text-foreground text-[10px] md:text-xs hidden sm:table-cell">{despesa.Responsavel}</TableCell>
                    <TableCell className="text-foreground text-[10px] md:text-xs hidden md:table-cell">{despesa.Tipo}</TableCell>
                    <TableCell className="text-foreground text-[10px] md:text-xs hidden lg:table-cell">{despesa.Categoria}</TableCell>
                    <TableCell className="text-foreground text-[10px] md:text-xs">{despesa.Parcelas}</TableCell>
                    <TableCell className="text-right font-medium text-primary text-[10px] md:text-xs whitespace-nowrap">
                      {formatCurrency(despesa.valor)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onDuplicate(despesa)}
                          title="Duplicar"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onEdit(despesa)}
                          title="Editar"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => despesa.id && onDelete(despesa.id)}
                          title="Deletar"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground h-24"
                  >
                    Nenhuma despesa encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
