
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Receita, RevenueTable } from "@/components/revenue/RevenueTable";
import { RevenueForm } from "@/components/revenue/RevenueForm";

export default function Revenue() {
    const navigate = useNavigate();
    const [userId, setUserId] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>("");
    const [receitas, setReceitas] = useState<Receita[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const [formOpen, setFormOpen] = useState(false);
    const [editingReceita, setEditingReceita] = useState<Receita | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [receitaToDelete, setReceitaToDelete] = useState<number | null>(null);
    const [categoryEmojis, setCategoryEmojis] = useState<Record<string, string>>({});

    // Derived state for dropdowns
    const [categoriasDisponiveis, setCategoriasDisponiveis] = useState<string[]>([]);
    const [responsaveisDisponiveis, setResponsaveisDisponiveis] = useState<string[]>([]);

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
            fetchReceitas();
            loadUserProfile(userId);
            fetchCategoryEmojis();
            fetchCategorias();
            fetchResponsaveis();
        }
    }, [userId]);

    const loadUserProfile = async (uid: string) => {
        const { data: profile } = await supabase
            .from("profiles")
            .select("nome")
            .eq("id", uid)
            .single();

        if (profile?.nome) {
            setUserName(profile.nome);
        }
    };

    const fetchCategorias = async () => {
        if (!userId) return;
        try {
            const { data, error } = await supabase
                .from("categorias" as any)
                .select("nome")
                .eq("user_id", userId)
                .order("nome");

            if (data) {
                setCategoriasDisponiveis(data.map((c: any) => c.nome));
            }
        } catch (error) {
            console.error("Erro ao carregar categorias:", error);
        }
    };

    const fetchResponsaveis = async () => {
        if (!userId) return;
        try {
            const [cartao, debito] = await Promise.all([
                supabase.from("Financeiro Cartão").select("Responsavel").eq("user_id", userId),
                supabase.from("Financeiro Debito").select("Responsavel").eq("user_id", userId)
            ]);

            const responsaveis = new Set<string>();
            if (cartao.data) cartao.data.forEach((d: any) => responsaveis.add(d.Responsavel));
            if (debito.data) debito.data.forEach((d: any) => responsaveis.add(d.Responsavel));

            setResponsaveisDisponiveis(Array.from(responsaveis).sort());
        } catch (error) {
            console.error("Erro ao carregar responsáveis:", error);
        }
    };

    const fetchCategoryEmojis = async () => {
        if (!userId) return;
        try {
            const { data, error } = await (supabase as any)
                .from('categoria_emojis')
                .select('categoria, emoji')
                .eq('user_id', userId);

            if (data) {
                const emojiMap: Record<string, string> = {};
                data.forEach((item: any) => {
                    emojiMap[item.categoria] = item.emoji;
                });
                setCategoryEmojis(emojiMap);
            }
        } catch (error) {
            console.error('Error fetching emojis:', error);
        }
    };

    const fetchReceitas = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("Financeiro Receita" as any)
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (error) throw error;

            setReceitas(data || []);


        } catch (error: any) {
            console.error("Erro ao carregar receitas:", error);
            toast({
                title: "Erro ao carregar receitas",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleFormSubmit = async (data: any) => {
        if (!userId) return;
        try {
            // Verify if category exists, if not create it
            if (data.Categoria && !categoriasDisponiveis.includes(data.Categoria)) {
                const { error: catError } = await supabase
                    .from("categorias" as any)
                    .insert([{
                        nome: data.Categoria,
                        user_id: userId,
                        cor: "#22c55e", // Default green for revenue categories
                        icone: ""
                    }]);

                if (catError) {
                    console.error("Erro ao criar categoria:", catError);
                    toast({
                        title: "Aviso",
                        description: "Receita salva, mas houve um erro ao salvar a nova categoria.",
                        variant: "destructive"
                    });
                } else {
                    // Update local state to include new category immediately
                    setCategoriasDisponiveis(prev => [...prev, data.Categoria].sort());
                }
            }

            if (editingReceita) {
                const { error } = await supabase
                    .from("Financeiro Receita" as any)
                    .update({
                        Responsavel: data.Responsavel,
                        Categoria: data.Categoria,
                        Descrição: data.Descrição,
                        Data: data.Data,
                        valor: data.valor,
                        created_at: data.created_at
                    })
                    .eq("id", editingReceita.id);
                if (error) throw error;
                toast({ title: "Receita atualizada!" });
            } else {
                const { error } = await supabase
                    .from("Financeiro Receita" as any)
                    .insert([{
                        ...data,
                        user_id: userId
                    }]);
                if (error) throw error;
                toast({ title: "Receita criada com sucesso!" });
            }
            setFormOpen(false);
            setEditingReceita(null);
            fetchReceitas();
            fetchCategorias(); // Refresh categories to be sure
        } catch (error: any) {
            console.error("Erro ao salvar:", error);
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        }
    };

    const handleDelete = async () => {
        if (!receitaToDelete) return;
        try {
            const { error } = await supabase
                .from("Financeiro Receita" as any)
                .delete()
                .eq("id", receitaToDelete);

            if (error) throw error;
            toast({ title: "Receita excluída!" });
            fetchReceitas();
        } catch (error: any) {
            toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        } finally {
            setDeleteDialogOpen(false);
            setReceitaToDelete(null);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-2 md:p-8 animate-fade-in">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="text-center md:text-left">
                        <h1 className="text-3xl font-bold text-card-foreground">Receitas</h1>
                        <p className="text-muted-foreground mt-2">
                            Gerencie suas entradas e ganhos
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => { setEditingReceita(null); setFormOpen(true); }}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nova Receita
                        </Button>
                        <Button variant="outline" onClick={fetchReceitas} size="icon">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <RevenueTable
                    receitas={receitas}
                    onEdit={(r) => { setEditingReceita(r); setFormOpen(true); }}
                    onDelete={(id) => { setReceitaToDelete(id); setDeleteDialogOpen(true); }}
                    categoryEmojis={categoryEmojis}
                />

                {formOpen && (
                    <RevenueForm
                        open={formOpen}
                        onOpenChange={setFormOpen}
                        onSubmit={handleFormSubmit}
                        receita={editingReceita}
                        categorias={categoriasDisponiveis}
                        responsaveis={[...new Set([...responsaveisDisponiveis, ...receitas.map(r => r.Responsavel), userName])].filter(Boolean)}
                        defaultResponsavel={userName}
                    />
                )}

                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                                Tem certeza que deseja excluir esta receita?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                                Excluir
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
