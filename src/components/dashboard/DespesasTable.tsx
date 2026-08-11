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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Despesa } from "@/types/despesa";
import { Receipt, Pencil, Trash2, Copy, Edit3, Clock, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";

interface DespesasTableProps {
  despesas: Despesa[];
  onEdit: (despesa: Despesa) => void;
  onDelete: (id: number) => void;
  onDuplicate: (despesa: Despesa) => void;
  onBulkEditClick?: (selectedIds: number[]) => void;
  onBulkDeleteClick?: (selectedIds: number[]) => void;
  categoryEmojis?: Record<string, string>;
  totalFiltered?: number;
  loading?: boolean;
}

export const DespesasTable = ({ despesas, onEdit, onDelete, onDuplicate, onBulkEditClick, onBulkDeleteClick, categoryEmojis = {}, totalFiltered, loading }: DespesasTableProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Reset selection when despesas change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [despesas]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(despesas.filter(d => d.id).map(d => d.id!));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkEdit = () => {
    if (onBulkEditClick && selectedIds.size > 0) {
      onBulkEditClick(Array.from(selectedIds));
    }
  };

  const handleBulkDelete = () => {
    if (onBulkDeleteClick && selectedIds.size > 0) {
      onBulkDeleteClick(Array.from(selectedIds));
    }
  };

  const allSelected = despesas.length > 0 && despesas.filter(d => d.id).every(d => selectedIds.has(d.id!));
  const someSelected = selectedIds.size > 0 && !allSelected;

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

  const getCategoryEmoji = (categoria: string) => {
    // First check if there's a custom emoji for this category
    if (categoryEmojis[categoria]) {
      return categoryEmojis[categoria];
    }

    // Fallback to hardcoded emojis
    const emojis: { [key: string]: string } = {
      "Alimentação": "🍔",
      "Transporte": "🚗",
      "Saúde": "💊",
      "Educação": "📚",
      "Lazer": "🎉",
      "Moradia": "🏠",
      "Contas": "💡",
      "Vestuário": "👕",
      "Outros": "📦",
      "Salário": "💰",
      "Investimento": "📈",
      "Presente": "🎁",
      "Viagem": "✈️",
      "Pet": "🐾",
      "Mercado": "🛒",
      "Farmácia": "⚕️",
      "Restaurante": "🍽️",
      "Serviços": "🔧",
      "Assinaturas": "📺",
      "Beleza": "💅",
      "Esporte": "⚽",
      "Eletrônicos": "📱",
      "Carro": "🚘",
      "Moto": "🏍️",
      "Uber": "🚕",
      "Ônibus": "🚌",
      "Metrô": "🚇",
      "Trem": "🚆",
      "Combustível": "⛽",
      "Estacionamento": "🅿️",
      "Pedágio": "🚧",
      "Seguro": "🛡️",
      "Imposto": "💸",
      "Taxa": "📉",
      "Juros": "📊",
      "Multa": "🚫",
      "Doação": "🤝",
      "Empréstimo": "💳",
      "Dívida": "📉",
      "Poupança": "🐷",
      "Reserva": "🏦",
      "Emergência": "🚨",
      "Manutenção": "🛠️",
      "Reforma": "🔨",
      "Decoração": "🖼️",
      "Móveis": "🪑",
      "Eletrodomésticos": "🔌",
      "Limpeza": "🧹",
      "Higiene": "🚿",
      "Cosméticos": "💄",
      "Roupas": "👗",
      "Sapatos": "👠",
      "Acessórios": "💍",
      "Jóias": "💎",
      "Livros": "📖",
      "Cursos": "🎓",
      "Escola": "🏫",
      "Faculdade": "🏛️",
      "Material Escolar": "✏️",
      "Cinema": "🎬",
      "Teatro": "🎭",
      "Show": "🎤",
      "Jogos": "🎮",
      "Streaming": "📺",
      "Internet": "🌐",
      "Celular": "📱",
      "Telefone": "☎️",
      "TV": "📺",
      "Água": "💧",
      "Luz": "💡",
      "Gás": "🔥",
      "Condomínio": "🏢",
      "Aluguel": "🏠",
      "IPTU": "🏙️",
      "IPVA": "🚗",
      "Licenciamento": "📄",
    };
    return emojis[categoria] || "📝";
  };

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm md:text-base lg:text-lg text-card-foreground">
              Todas as Despesas ({despesas.length} {despesas.length === 1 ? 'despesa' : 'despesas'})
              {totalFiltered !== undefined && (
                <span className="ml-2 text-primary font-bold">
                  - Total: {formatCurrency(totalFiltered)}
                </span>
              )}
            </CardTitle>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
              <span className="text-sm font-medium text-primary">
                {selectedIds.size} selecionada{selectedIds.size > 1 ? 's' : ''}
              </span>
              <Button
                size="sm"
                variant="default"
                onClick={handleBulkEdit}
                className="h-7 gap-1"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
                className="h-7 gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 md:p-6">
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                {onBulkEditClick && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected || someSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Selecionar todas"
                      className={someSelected ? "opacity-50" : ""}
                    />
                  </TableHead>
                )}
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
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={`loading-${index}`} className="border-border">
                    {onBulkEditClick && <TableCell><div className="h-4 w-4 bg-muted animate-pulse rounded" /></TableCell>}
                    <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell className="hidden md:table-cell"><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-12 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell className="text-right"><div className="h-4 w-20 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                    <TableCell className="text-right"><div className="h-8 w-24 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : despesas.length > 0 ? (
                despesas.map((despesa, index) => (
                  <TableRow key={index} className="border-border hover:bg-muted/50">
                    {onBulkEditClick && despesa.id && (
                      <TableCell className="w-12">
                        <Checkbox
                          checked={selectedIds.has(despesa.id)}
                          onCheckedChange={(checked) => handleSelectOne(despesa.id!, checked as boolean)}
                          aria-label={`Selecionar despesa ${despesa.Descrição}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-foreground font-medium text-[10px] md:text-xs whitespace-nowrap">
                      {formatDate(despesa.Data)}
                    </TableCell>
                    <TableCell className="text-foreground text-[10px] md:text-xs max-w-[120px] truncate">
                      <div className="flex items-center gap-1">
                        <span>{despesa.Descrição}</span>
                        {despesa.valor < 0 && (
                          <Badge
                            variant="outline"
                            className="text-[8px] px-1 py-0 h-4 flex items-center gap-0.5 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                          >
                            Estorno
                          </Badge>
                        )}
                        {despesa.fixed_cost_id && (
                          <Badge
                            variant={despesa.status === 'pendente' ? 'outline' : 'secondary'}
                            className="text-[8px] px-1 py-0 h-4 flex items-center gap-0.5"
                          >
                            {despesa.status === 'pendente' ? (
                              <>
                                <Clock className="h-2.5 w-2.5" />
                                Pendente
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Auto
                              </>
                            )}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground text-[10px] md:text-xs hidden sm:table-cell">{despesa.Responsavel}</TableCell>
                    <TableCell className="text-foreground text-[10px] md:text-xs hidden md:table-cell">
                      {despesa.Tipo}
                      {(despesa.Tipo || "").trim().toLowerCase().startsWith("cr") && despesa.banco_cartao && (
                        <span className="text-muted-foreground"> · {despesa.banco_cartao}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-foreground text-[10px] md:text-xs hidden lg:table-cell">
                      {getCategoryEmoji(despesa.Categoria)} {despesa.Categoria}
                    </TableCell>
                    <TableCell className="text-foreground text-[10px] md:text-xs">{despesa.Parcelas}</TableCell>
                    <TableCell className={`text-right font-medium text-[10px] md:text-xs whitespace-nowrap ${despesa.valor < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-primary"}`}>
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
                    colSpan={onBulkEditClick ? 9 : 8}
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
