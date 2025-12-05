import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";

interface BulkEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApply: (updates: BulkEditUpdates) => Promise<void>;
    selectedCount: number;
    categorias: string[];
    responsaveis: string[];
}

export interface BulkEditUpdates {
    categoria?: string;
    tipo?: string;
    responsavel?: string;
    created_at?: string;
}

export const BulkEditDialog = ({
    open,
    onOpenChange,
    onApply,
    selectedCount,
    categorias,
    responsaveis,
}: BulkEditDialogProps) => {
    const [updateCategoria, setUpdateCategoria] = useState(false);
    const [updateTipo, setUpdateTipo] = useState(false);
    const [updateResponsavel, setUpdateResponsavel] = useState(false);
    const [updateCreatedAt, setUpdateCreatedAt] = useState(false);

    const [categoria, setCategoria] = useState<string>("");
    const [tipo, setTipo] = useState<string>("");
    const [responsavel, setResponsavel] = useState<string>("");
    const [createdAt, setCreatedAt] = useState<string>("");

    const [showConfirmation, setShowConfirmation] = useState(false);
    const [isApplying, setIsApplying] = useState(false);

    const handleApply = async () => {
        const updates: BulkEditUpdates = {};

        if (updateCategoria && categoria) {
            updates.categoria = categoria;
        }
        if (updateTipo && tipo) {
            updates.tipo = tipo;
        }
        if (updateResponsavel && responsavel) {
            updates.responsavel = responsavel;
        }
        if (updateCreatedAt && createdAt) {
            updates.created_at = new Date(createdAt).toISOString();
        }

        // Se nenhum campo foi selecionado, não fazer nada
        if (Object.keys(updates).length === 0) {
            return;
        }

        setIsApplying(true);
        try {
            await onApply(updates);
            handleClose();
        } finally {
            setIsApplying(false);
        }
    };

    const handleClose = () => {
        setUpdateCategoria(false);
        setUpdateTipo(false);
        setUpdateResponsavel(false);
        setUpdateCreatedAt(false);
        setCategoria("");
        setTipo("");
        setResponsavel("");
        setCreatedAt("");
        setShowConfirmation(false);
        onOpenChange(false);
    };

    const handlePrimaryAction = () => {
        if (!showConfirmation) {
            setShowConfirmation(true);
        } else {
            handleApply();
        }
    };

    const hasAnyFieldSelected = updateCategoria || updateTipo || updateResponsavel || updateCreatedAt;
    const hasValidValues =
        (!updateCategoria || categoria) &&
        (!updateTipo || tipo) &&
        (!updateResponsavel || responsavel) &&
        (!updateCreatedAt || createdAt);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-md" aria-describedby="bulk-edit-description">
                <DialogHeader>
                    <DialogTitle>
                        {showConfirmation ? "Confirmar Alterações" : "Edição em Massa"}
                    </DialogTitle>
                    <DialogDescription id="bulk-edit-description">
                        {showConfirmation
                            ? `Você está prestes a modificar ${selectedCount} ${selectedCount === 1 ? 'despesa' : 'despesas'}. Esta ação não pode ser desfeita automaticamente.`
                            : `Selecione quais campos deseja alterar nas ${selectedCount} ${selectedCount === 1 ? 'despesa selecionada' : 'despesas selecionadas'}.`
                        }
                    </DialogDescription>
                </DialogHeader>

                {!showConfirmation ? (
                    <div className="space-y-4 py-4">
                        {/* Categoria */}
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="update-categoria"
                                    checked={updateCategoria}
                                    onCheckedChange={(checked) => setUpdateCategoria(checked as boolean)}
                                />
                                <Label htmlFor="update-categoria" className="text-sm font-medium cursor-pointer">
                                    Atualizar Categoria
                                </Label>
                            </div>
                            {updateCategoria && (
                                <Select value={categoria} onValueChange={setCategoria}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione uma categoria" />
                                    </SelectTrigger>
                                    <SelectContent side="bottom">
                                        {[...categorias].sort((a, b) => a.localeCompare(b)).map((cat) => (
                                            <SelectItem key={cat} value={cat}>
                                                {cat}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* Tipo */}
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="update-tipo"
                                    checked={updateTipo}
                                    onCheckedChange={(checked) => setUpdateTipo(checked as boolean)}
                                />
                                <Label htmlFor="update-tipo" className="text-sm font-medium cursor-pointer">
                                    Atualizar Tipo
                                </Label>
                            </div>
                            {updateTipo && (
                                <Select value={tipo} onValueChange={setTipo}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione um tipo" />
                                    </SelectTrigger>
                                    <SelectContent side="bottom">
                                        <SelectItem value="Crédito">Crédito</SelectItem>
                                        <SelectItem value="Débito">Débito</SelectItem>
                                        <SelectItem value="Pix">Pix</SelectItem>
                                        <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* Responsável */}
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="update-responsavel"
                                    checked={updateResponsavel}
                                    onCheckedChange={(checked) => setUpdateResponsavel(checked as boolean)}
                                />
                                <Label htmlFor="update-responsavel" className="text-sm font-medium cursor-pointer">
                                    Atualizar Responsável
                                </Label>
                            </div>
                            {updateResponsavel && (
                                <Select value={responsavel} onValueChange={setResponsavel}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione um responsável" />
                                    </SelectTrigger>
                                    <SelectContent side="bottom">
                                        {[...responsaveis].sort((a, b) => a.localeCompare(b)).map((resp) => (
                                            <SelectItem key={resp} value={resp}>
                                                {resp}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* Created At */}
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="update-created-at"
                                    checked={updateCreatedAt}
                                    onCheckedChange={(checked) => setUpdateCreatedAt(checked as boolean)}
                                />
                                <Label htmlFor="update-created-at" className="text-sm font-medium cursor-pointer">
                                    Atualizar Data de Criação
                                </Label>
                            </div>
                            {updateCreatedAt && (
                                <input
                                    id="created-at"
                                    type="datetime-local"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={createdAt}
                                    onChange={(e) => setCreatedAt(e.target.value)}
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="py-4">
                        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                            <div className="flex gap-3">
                                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                <div className="space-y-2 text-sm">
                                    <p className="font-medium text-amber-900 dark:text-amber-100">
                                        As seguintes alterações serão aplicadas:
                                    </p>
                                    <ul className="list-disc list-inside space-y-1 text-amber-800 dark:text-amber-200">
                                        {updateCategoria && categoria && (
                                            <li>Categoria: <strong>{categoria}</strong></li>
                                        )}
                                        {updateTipo && tipo && (
                                            <li>Tipo: <strong>{tipo}</strong></li>
                                        )}
                                        {updateResponsavel && responsavel && (
                                            <li>Responsável: <strong>{responsavel}</strong></li>
                                        )}
                                        {updateCreatedAt && createdAt && (
                                            <li>Data de Criação: <strong>{new Date(createdAt).toLocaleString()}</strong></li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={showConfirmation ? () => setShowConfirmation(false) : handleClose}
                        disabled={isApplying}
                    >
                        {showConfirmation ? "Voltar" : "Cancelar"}
                    </Button>
                    <Button
                        type="button"
                        onClick={handlePrimaryAction}
                        disabled={!hasAnyFieldSelected || !hasValidValues || isApplying}
                    >
                        {isApplying ? "Aplicando..." : showConfirmation ? "Confirmar" : "Continuar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
