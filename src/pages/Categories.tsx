import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tag, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Categoria } from "@/types/categoria";

export default function Categories() {
    const [loading, setLoading] = useState(false);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [expenseCount, setExpenseCount] = useState<Record<string, number>>({});
    const [formOpen, setFormOpen] = useState(false);
    const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
    const [formData, setFormData] = useState({ nome: "", cor: "#94a3b8", icone: "" });
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingCategoria, setDeletingCategoria] = useState<Categoria | null>(null);
    const { toast } = useToast();

    const fetchCategorias = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch categories
            const { data: cats, error: catError } = await supabase
                .from("categorias")
                .select("*")
                .eq("user_id", user.id)
                .order("nome");

            if (catError) throw catError;
            setCategorias(cats || []);

            // Fetch usage counts
            const [cartaoResult, debitoResult] = await Promise.all([
                supabase.from("Financeiro Cartão").select("Categoria").eq('user_id', user.id),
                supabase.from("Financeiro Debito").select("Categoria").eq('user_id', user.id),
            ]);

            const counts: Record<string, number> = {};

            cartaoResult.data?.forEach(d => {
                if (d.Categoria) counts[d.Categoria] = (counts[d.Categoria] || 0) + 1;
            });

            debitoResult.data?.forEach(d => {
                if (d.Categoria) counts[d.Categoria] = (counts[d.Categoria] || 0) + 1;
            });

            setExpenseCount(counts);

        } catch (error: any) {
            console.error("Erro ao carregar categorias:", error);
            toast({
                title: "Erro ao carregar",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategorias();
    }, []);

    const handleNewCategory = () => {
        setEditingCategoria(null);
        setFormData({ nome: "", cor: "#94a3b8", icone: "" });
        setFormOpen(true);
    };

    const handleEdit = (categoria: Categoria) => {
        setEditingCategoria(categoria);
        setFormData({
            nome: categoria.nome,
            cor: categoria.cor || "#94a3b8",
            icone: categoria.icone || ""
        });
        setFormOpen(true);
    };

    const handleDeleteClick = (categoria: Categoria) => {
        setDeletingCategoria(categoria);
        setDeleteDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (editingCategoria) {
                const { error } = await supabase
                    .from("categorias")
                    .update({
                        nome: formData.nome,
                        cor: formData.cor,
                        icone: formData.icone
                    })
                    .eq("id", editingCategoria.id);

                if (error) throw error;
                toast({ title: "Categoria atualizada com sucesso!" });
            } else {
                const { error } = await supabase
                    .from("categorias")
                    .insert([{
                        user_id: user.id,
                        nome: formData.nome,
                        cor: formData.cor,
                        icone: formData.icone
                    }]);

                if (error) throw error;
                toast({ title: "Categoria criada com sucesso!" });
            }

            setFormOpen(false);
            fetchCategorias();
        } catch (error: any) {
            toast({
                title: "Erro ao salvar",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleDelete = async () => {
        if (!deletingCategoria) return;
        try {
            const { error } = await supabase
                .from("categorias")
                .delete()
                .eq("id", deletingCategoria.id);

            if (error) throw error;

            toast({ title: "Categoria excluída com sucesso!" });
            setDeleteDialogOpen(false);
            fetchCategorias();
        } catch (error: any) {
            toast({
                title: "Erro ao excluir",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleSyncCategories = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Buscar todas as categorias usadas nas despesas
            const [cartaoResult, debitoResult] = await Promise.all([
                supabase.from("Financeiro Cartão").select("Categoria").eq('user_id', user.id),
                supabase.from("Financeiro Debito").select("Categoria").eq('user_id', user.id),
            ]);

            if (cartaoResult.error) throw cartaoResult.error;
            if (debitoResult.error) throw debitoResult.error;

            const categoriasUsadas = new Set<string>();

            cartaoResult.data?.forEach(d => {
                if (d.Categoria) categoriasUsadas.add(d.Categoria);
            });

            debitoResult.data?.forEach(d => {
                if (d.Categoria) categoriasUsadas.add(d.Categoria);
            });

            // 2. Buscar categorias já cadastradas
            const { data: categoriasExistentes, error: catError } = await supabase
                .from("categorias")
                .select("nome")
                .eq("user_id", user.id);

            if (catError) throw catError;

            const nomesExistentes = new Set(categoriasExistentes?.map(c => c.nome));

            // 3. Identificar novas categorias
            const novasCategorias = Array.from(categoriasUsadas).filter(c => !nomesExistentes.has(c));

            if (novasCategorias.length === 0) {
                toast({
                    title: "Sincronização concluída",
                    description: "Todas as categorias usadas já estão cadastradas.",
                });
                return;
            }

            // 4. Inserir novas categorias
            const categoriasParaInserir = novasCategorias.map(nome => ({
                user_id: user.id,
                nome: nome,
                cor: "#94a3b8", // Cor padrão (slate-400)
                icone: ""
            }));

            const { error: insertError } = await supabase
                .from("categorias")
                .insert(categoriasParaInserir);

            if (insertError) throw insertError;

            toast({
                title: "Sincronização concluída",
                description: `${novasCategorias.length} novas categorias foram importadas.`,
            });

            fetchCategorias();

        } catch (error: any) {
            toast({
                title: "Erro ao sincronizar",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-card-foreground">Categorias</h1>
                    <p className="text-muted-foreground mt-2">
                        Gerencie as categorias das suas despesas
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSyncCategories} disabled={loading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Sincronizar
                    </Button>
                    <Button onClick={handleNewCategory}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nova Categoria
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categorias.map((categoria) => (
                    <Card key={categoria.id}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: categoria.cor || "#3b82f6" }}
                                />
                                {categoria.nome}
                            </CardTitle>
                            <CardDescription>
                                {expenseCount[categoria.nome] || 0} despesa(s)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEdit(categoria)}
                                >
                                    <Pencil className="h-4 w-4 mr-1" />
                                    Editar
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteClick(categoria)}
                                >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Excluir
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {categorias.length === 0 && (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhuma categoria cadastrada</p>
                        <p className="text-sm mt-2">Clique em "Nova Categoria" para começar</p>
                    </CardContent>
                </Card>
            )}

            {/* Form Dialog */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingCategoria ? "Editar Categoria" : "Nova Categoria"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingCategoria
                                ? "Ao alterar o nome, todas as despesas com esta categoria serão atualizadas automaticamente."
                                : "Crie uma nova categoria para organizar suas despesas."}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="nome">Nome *</Label>
                                <Input
                                    id="nome"
                                    value={formData.nome}
                                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                    required
                                    placeholder="Ex: Alimentação"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cor">Cor</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="cor"
                                        type="color"
                                        value={formData.cor}
                                        onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                                        className="w-20 h-10"
                                    />
                                    <Input
                                        value={formData.cor}
                                        onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                                        placeholder="#3b82f6"
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit">
                                {editingCategoria ? "Atualizar" : "Criar"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir a categoria "{deletingCategoria?.nome}"?
                            {expenseCount[deletingCategoria?.nome || ""] > 0 && (
                                <span className="block mt-2 text-destructive font-medium">
                                    Atenção: Esta categoria possui {expenseCount[deletingCategoria?.nome || ""]} despesa(s) associada(s).
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
