import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Despesa, ResponsavelFilter, TipoFilter } from "@/types/despesa";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, Filter } from "lucide-react";
import { Filters } from "@/components/dashboard/Filters";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { DespesasTable } from "@/components/dashboard/DespesasTable";
import { DespesaForm } from "@/components/dashboard/DespesaForm";
import { BulkEditDialog, BulkEditUpdates } from "@/components/dashboard/BulkEditDialog";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, addMonths } from "date-fns";

// Funções utilitárias para conversão de datas
const brToDate = (dataBr: string): Date => {
    const [dia, mes, ano] = dataBr.split('/');
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
};

const inputToDate = (dateStr: string): Date => {
    const [ano, mes, dia] = dateStr.split('-');
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
};

const getTotalParcelas = (parcelas: string): string | null => {
    if (!parcelas) return null;
    const normalized = parcelas.trim().toLowerCase();
    if (normalized === "a vista" || normalized === "avista" || normalized === "à vista") {
        return "1";
    }
    const [atual, total] = parcelas.split('/').map((p) => p.trim());
    const bruto = total || atual;
    if (!bruto) return null;
    const numero = parseInt(bruto, 10);
    if (isNaN(numero)) return null;
    return numero.toString();
};

export default function Transactions() {
    const navigate = useNavigate();
    const [userId, setUserId] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>("");
    const [despesas, setDespesas] = useState<Despesa[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const [responsavelFilter, setResponsavelFilter] = useState<ResponsavelFilter>("todos");
    const [tipoFilter, setTipoFilter] = useState<TipoFilter>("todos");
    const [categoriaFilter, setCategoriaFilter] = useState("todas");
    const [parcelaFilter, setParcelaFilter] = useState<string[]>([]);
    const [dataInicio, setDataInicio] = useState("");
    const [dataFim, setDataFim] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [despesaToDelete, setDespesaToDelete] = useState<number | null>(null);
    const [registrosMostrados, setRegistrosMostrados] = useState(10);
    const [mesSelecionado, setMesSelecionado] = useState<number | null>(null);
    const [anoSelecionado, setAnoSelecionado] = useState<number>(new Date().getFullYear());
    const [periodosMensais, setPeriodosMensais] = useState<any[]>([]);
    const [categoryEmojis, setCategoryEmojis] = useState<Record<string, string>>({});
    const [categoriasDisponiveis, setCategoriasDisponiveis] = useState<string[]>([]);
    const [bulkEditOpen, setBulkEditOpen] = useState(false);
    const [selectedExpenseIds, setSelectedExpenseIds] = useState<number[]>([]);
    const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

    const [isFiltersOpen, setIsFiltersOpen] = useState(false);

    const fetchDespesas = async () => {
        if (!userId) return;

        setLoading(true);

        try {
            const [cartaoResult, debitoResult] = await Promise.all([
                supabase.from("Financeiro Cartão").select("*").eq('user_id', userId),
                supabase.from("Financeiro Debito").select("*").eq('user_id', userId),
            ]);

            if (cartaoResult.error) throw cartaoResult.error;
            if (debitoResult.error) throw debitoResult.error;

            const todasDespesas = [
                ...(cartaoResult.data || []),
                ...(debitoResult.data || []),
            ].sort((a, b) => (b.id || 0) - (a.id || 0));

            setDespesas(todasDespesas);
            toast({
                title: "Dados atualizados",
                description: `${todasDespesas.length} despesas carregadas com sucesso.`,
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Erro ao carregar dados";
            toast({
                title: "Erro ao carregar dados",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchPeriodosMensais = async () => {
        if (!userId) return;

        try {
            const { data, error } = await supabase
                .from("periodos_mensais_cartao")
                .select("*")
                .eq("user_id", userId)
                .order("mes_referencia");

            if (error) throw error;
            setPeriodosMensais(data || []);
        } catch (error: any) {
            console.error("Erro ao carregar períodos mensais:", error);
        }
    };

    const fetchCategoryEmojis = async () => {
        if (!userId) return;
        try {
            const { data, error } = await (supabase
                .from('categoria_emojis' as any)
                .select('categoria, emoji')
                .eq('user_id', userId)) as any;

            if (error) {
                console.error('Error fetching emojis:', error);
                return;
            }

            if (data) {
                const emojiMap: Record<string, string> = {};
                data.forEach((item: any) => {
                    emojiMap[item.categoria] = item.emoji;
                });
                setCategoryEmojis(emojiMap);
            }
        } catch (error) {
            console.error('Error in fetchCategoryEmojis:', error);
        }
    };

    const fetchCategorias = async () => {
        if (!userId) return;
        try {
            const { data, error } = await (supabase
                .from("categorias" as any)
                .select("nome")
                .eq("user_id", userId)
                .order("nome")) as any;

            if (error) throw error;
            setCategoriasDisponiveis(data?.map((c: any) => c.nome) || []);
        } catch (error) {
            console.error("Erro ao carregar categorias:", error);
        }
    };

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
            fetchDespesas();
            fetchPeriodosMensais();
            fetchCategoryEmojis();
            fetchCategorias();
            loadUserProfile(userId);
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

    const despesasFiltradas = despesas.filter((despesa) => {
        // Filtrar despesas pendentes de custos fixos (não mostrar em Transações)
        if (despesa.status === 'pendente') {
            return false;
        }

        if (responsavelFilter !== "todos" && despesa.Responsavel !== responsavelFilter) {
            return false;
        }

        if (tipoFilter !== "todos" && despesa.Tipo !== tipoFilter) {
            return false;
        }

        if (categoriaFilter !== "todas" && despesa.Categoria !== categoriaFilter) {
            return false;
        }

        if (parcelaFilter.length > 0) {
            const totalParcelas = getTotalParcelas(despesa.Parcelas || "");
            if (!totalParcelas) return false;
            if (!parcelaFilter.includes(totalParcelas)) return false;
        }

        const despesaDate = brToDate(despesa.Data);

        if (despesa.Tipo === "Crédito") {
            if (dataInicio) {
                const dataInicioDate = inputToDate(dataInicio);
                dataInicioDate.setHours(0, 0, 0, 0);
                if (despesaDate < dataInicioDate) return false;
            }
            if (dataFim) {
                const dataFimDate = inputToDate(dataFim);
                dataFimDate.setHours(23, 59, 59, 999);
                if (despesaDate > dataFimDate) return false;
            }
        } else {
            if (mesSelecionado) {
                const anoRef = dataInicio ? inputToDate(dataInicio).getFullYear() : new Date().getFullYear();
                const inicioMes = new Date(anoRef, mesSelecionado - 1, 1);
                inicioMes.setHours(0, 0, 0, 0);

                const fimMes = new Date(anoRef, mesSelecionado, 0);
                fimMes.setHours(23, 59, 59, 999);

                if (despesaDate < inicioMes || despesaDate > fimMes) return false;
            } else {
                if (dataInicio) {
                    const dataInicioDate = inputToDate(dataInicio);
                    dataInicioDate.setHours(0, 0, 0, 0);
                    if (despesaDate < dataInicioDate) return false;
                }
                if (dataFim) {
                    const dataFimDate = inputToDate(dataFim);
                    dataFimDate.setHours(23, 59, 59, 999);
                    if (despesaDate > dataFimDate) return false;
                }
            }
        }

        return true;
    });

    const handleAddOrUpdate = async (despesa: Omit<Despesa, "id"> & { id?: number }) => {
        if (!userId) return;

        try {
            const tableName = despesa.Tipo === "Crédito" ? "Financeiro Cartão" : "Financeiro Debito";

            if (despesa.id) {
                const { error } = await supabase
                    .from(tableName)
                    .update({
                        Responsavel: despesa.Responsavel,
                        Tipo: despesa.Tipo,
                        Categoria: despesa.Categoria,
                        Parcelas: despesa.Parcelas,
                        Descrição: despesa["Descrição"],
                        Data: despesa.Data,
                        valor: despesa.valor,
                        created_at: despesa.created_at
                    })
                    .eq("id", despesa.id);

                if (error) throw error;
                toast({ title: "Despesa atualizada com sucesso!" });
            } else {
                const parcelasMatch = despesa.Parcelas?.match(/(\d+)x?/i);
                const numeroParcelas = parcelasMatch ? parseInt(parcelasMatch[1]) : 1;

                if (numeroParcelas > 1) {
                    const valorParcela = despesa.valor / numeroParcelas;
                    const dataInicial = brToDate(despesa.Data);
                    const despesasParceladas = [];

                    for (let i = 0; i < numeroParcelas; i++) {
                        const dataParcelaDate = addMonths(dataInicial, i);
                        const dataParcela = format(dataParcelaDate, "dd/MM/yyyy");

                        despesasParceladas.push({
                            Responsavel: despesa.Responsavel,
                            Tipo: despesa.Tipo,
                            Categoria: despesa.Categoria,
                            Parcelas: `${i + 1}/${numeroParcelas}`,
                            Descrição: despesa["Descrição"],
                            Data: dataParcela,
                            valor: valorParcela,
                            user_id: userId,
                            created_at: despesa.created_at
                        });
                    }

                    const { error } = await supabase
                        .from(tableName)
                        .insert(despesasParceladas);

                    if (error) throw error;
                    toast({ title: `${numeroParcelas} despesas parceladas criadas com sucesso!` });
                } else {
                    const { error } = await supabase
                        .from(tableName)
                        .insert([{
                            Responsavel: despesa.Responsavel,
                            Tipo: despesa.Tipo,
                            Categoria: despesa.Categoria,
                            Parcelas: despesa.Parcelas,
                            Descrição: despesa["Descrição"],
                            Data: despesa.Data,
                            valor: despesa.valor,
                            user_id: userId,
                            created_at: despesa.created_at
                        }]);

                    if (error) throw error;
                    toast({ title: "Despesa adicionada com sucesso!" });
                }
            }

            fetchDespesas();
        } catch (error: any) {
            console.error("Erro ao salvar despesa:", error);
            toast({
                title: "Erro ao salvar despesa",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleDuplicate = async (despesa: Despesa) => {
        if (!userId) return;

        try {
            const tableName = despesa.Tipo === "Crédito" ? "Financeiro Cartão" : "Financeiro Debito";

            const { error } = await supabase
                .from(tableName)
                .insert([{
                    Responsavel: despesa.Responsavel,
                    Tipo: despesa.Tipo,
                    Categoria: despesa.Categoria,
                    Parcelas: despesa.Parcelas,
                    Descrição: despesa["Descrição"],
                    Data: despesa.Data,
                    valor: despesa.valor,
                    user_id: userId
                }]);

            if (error) throw error;

            toast({ title: "Despesa duplicada com sucesso!" });
            fetchDespesas();
        } catch (error: any) {
            console.error("Erro ao duplicar despesa:", error);
            toast({
                title: "Erro ao duplicar despesa",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleDelete = async () => {
        if (!despesaToDelete) return;

        try {
            const despesa = despesas.find((d) => d.id === despesaToDelete);
            if (!despesa) return;

            // Tenta deletar da tabela baseada no Tipo
            let tableName = despesa.Tipo === "Crédito" ? "Financeiro Cartão" : "Financeiro Debito";
            let { error, count } = await supabase
                .from(tableName as any)
                .delete({ count: 'exact' })
                .eq("id", despesaToDelete);

            // Se não encontrou/deletou nada (count === 0), tenta na outra tabela como fallback
            if (count === 0) {
                console.log("Tentando deletar da outra tabela (fallback)...");
                const otherTable = tableName === "Financeiro Cartão" ? "Financeiro Debito" : "Financeiro Cartão";
                const retry = await supabase
                    .from(otherTable as any)
                    .delete({ count: 'exact' })
                    .eq("id", despesaToDelete);

                if (retry.error) throw retry.error;
            } else if (error) {
                throw error;
            }

            toast({ title: "Despesa excluída com sucesso!" });
            fetchDespesas();
            setDeleteDialogOpen(false);
            setDespesaToDelete(null);
        } catch (error: any) {
            console.error("Erro ao excluir despesa:", error);
            toast({
                title: "Erro ao excluir despesa",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleEdit = (despesa: Despesa) => {
        setEditingDespesa(despesa);
        setFormOpen(true);
    };

    const handleDeleteClick = (id: number) => {
        setDespesaToDelete(id);
        setDeleteDialogOpen(true);
    };

    const handleFormClose = () => {
        setFormOpen(false);
        setEditingDespesa(null);
    };

    const limparFiltros = () => {
        setResponsavelFilter("todos");
        setTipoFilter("todos");
        setCategoriaFilter("todas");
        setParcelaFilter([]);
        setDataInicio("");
        setDataFim("");
        setMesSelecionado(null);
        setRegistrosMostrados(10);
    };

    const handleFormSubmit = async (data: any) => {
        await handleAddOrUpdate({
            ...data,
            id: editingDespesa?.id,
            created_at: data.created_at ? new Date(data.created_at).toISOString() : undefined
        });
        handleFormClose();
    };

    const handleBulkEditClick = (selectedIds: number[]) => {
        setSelectedExpenseIds(selectedIds);
        setBulkEditOpen(true);
    };

    const handleBulkDeleteClick = (selectedIds: number[]) => {
        setSelectedExpenseIds(selectedIds);
        setBulkDeleteDialogOpen(true);
    };

    const handleBulkDelete = async () => {
        if (!userId || selectedExpenseIds.length === 0) return;

        try {
            // Tenta apagar todos os IDs selecionados de AMBAS as tabelas para garantir
            // Isso previne erros se o Tipo estiver desincronizado com a tabela real

            const { error: error1 } = await supabase
                .from("Financeiro Cartão")
                .delete()
                .in("id", selectedExpenseIds);

            const { error: error2 } = await supabase
                .from("Financeiro Debito")
                .delete()
                .in("id", selectedExpenseIds);

            if (error1 && error2) throw new Error(error1.message + " | " + error2.message);

            toast({
                title: "Exclusão em massa concluída!",
                description: `${selectedExpenseIds.length} despesa(s) excluída(s) com sucesso.`,
            });

            fetchDespesas();
            setBulkDeleteDialogOpen(false);
            setSelectedExpenseIds([]);
        } catch (error: any) {
            console.error("Erro ao excluir despesas em massa:", error);
            toast({
                title: "Erro ao excluir despesas",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleBulkEditApply = async (updates: BulkEditUpdates) => {
        if (!userId || selectedExpenseIds.length === 0) return;

        try {
            const selectedDespesas = despesas.filter(d => d.id && selectedExpenseIds.includes(d.id));
            const cartaoDespesas = selectedDespesas.filter(d => d.Tipo === "Crédito");
            const debitoDespesas = selectedDespesas.filter(d => d.Tipo !== "Crédito");

            const updateData: any = {};
            if (updates.categoria) updateData.Categoria = updates.categoria;
            if (updates.responsavel) updateData.Responsavel = updates.responsavel;
            if (updates.created_at) updateData.created_at = updates.created_at;

            const needsTableChange = updates.tipo && selectedDespesas.some(d =>
                (updates.tipo === "Crédito" && d.Tipo !== "Crédito") ||
                (updates.tipo !== "Crédito" && d.Tipo === "Crédito")
            );

            if (needsTableChange && updates.tipo) {
                for (const despesa of selectedDespesas) {
                    const currentTable = despesa.Tipo === "Crédito" ? "Financeiro Cartão" : "Financeiro Debito";
                    const targetTable = updates.tipo === "Crédito" ? "Financeiro Cartão" : "Financeiro Debito";

                    if (currentTable !== targetTable) {
                        const newData = {
                            Responsavel: updates.responsavel || despesa.Responsavel,
                            Tipo: updates.tipo,
                            Categoria: updates.categoria || despesa.Categoria,
                            Parcelas: despesa.Parcelas,
                            Descrição: despesa.Descrição,
                            Data: despesa.Data,
                            valor: despesa.valor,
                            user_id: userId,
                            created_at: updates.created_at || despesa.created_at
                        };

                        const { error: insertError } = await supabase.from(targetTable).insert([newData]);
                        if (insertError) throw insertError;

                        const { error: deleteError } = await supabase.from(currentTable).delete().eq("id", despesa.id!);
                        if (deleteError) throw deleteError;
                    } else {
                        const updates_local: any = {};
                        if (updates.categoria) updates_local.Categoria = updates.categoria;
                        if (updates.responsavel) updates_local.Responsavel = updates.responsavel;
                        if (updates.tipo) updates_local.Tipo = updates.tipo;
                        if (updates.created_at) updates_local.created_at = updates.created_at;

                        const { error } = await supabase
                            .from(currentTable)
                            .update(updates_local)
                            .eq("id", despesa.id!);
                        if (error) throw error;
                    }
                }
            } else {
                if (updates.tipo) updateData.Tipo = updates.tipo;

                if (Object.keys(updateData).length > 0) {
                    if (cartaoDespesas.length > 0) {
                        const cartaoIds = cartaoDespesas.map(d => d.id!);
                        const { error } = await supabase
                            .from("Financeiro Cartão")
                            .update(updateData)
                            .in("id", cartaoIds);
                        if (error) throw error;
                    }

                    if (debitoDespesas.length > 0) {
                        const debitoIds = debitoDespesas.map(d => d.id!);
                        const { error } = await supabase
                            .from("Financeiro Debito")
                            .update(updateData)
                            .in("id", debitoIds);
                        if (error) throw error;
                    }
                }
            }

            toast({
                title: "Atualização em massa concluída!",
                description: `${selectedExpenseIds.length} despesa(s) atualizada(s) com sucesso.`,
            });

            fetchDespesas();
            setBulkEditOpen(false);
            setSelectedExpenseIds([]);
        } catch (error: any) {
            console.error("Erro ao atualizar despesas em massa:", error);
            toast({
                title: "Erro ao atualizar despesas",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const despesasOrdenadas = [...despesasFiltradas].sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA || (b.id || 0) - (a.id || 0);
    });
    const despesasVisiveis = despesasOrdenadas.slice(0, registrosMostrados);
    const temMaisDespesas = despesasOrdenadas.length > registrosMostrados;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-2 md:p-8 animate-fade-in">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="text-center md:text-left">
                        <h1 className="text-3xl font-bold text-card-foreground">Transações</h1>
                        <p className="text-muted-foreground mt-2">
                            Visualize e gerencie todas as suas transações
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 justify-center md:justify-end w-full md:w-auto">
                        <Button
                            variant={isFiltersOpen ? "secondary" : "outline"}
                            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                            className="flex-1 md:flex-none"
                        >
                            <Filter className="mr-2 h-4 w-4" />
                            Filtros
                        </Button>
                        <Button onClick={() => setFormOpen(true)} className="flex-1 md:flex-none">
                            <Plus className="mr-2 h-4 w-4" />
                            Nova Despesa
                        </Button>
                        <ExportButton
                            despesas={despesasFiltradas}
                            filtrosAtivos={{
                                responsavel: responsavelFilter,
                                tipo: tipoFilter,
                                categoria: categoriaFilter
                            }}
                            simple={true}
                        />
                        <Button variant="outline" onClick={fetchDespesas} size="icon">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {isFiltersOpen && (
                    <Filters
                        responsavelFilter={responsavelFilter}
                        setResponsavelFilter={setResponsavelFilter}
                        tipoFilter={tipoFilter}
                        setTipoFilter={setTipoFilter}
                        categoriaFilter={categoriaFilter}
                        setCategoriaFilter={setCategoriaFilter}
                        parcelaFilter={parcelaFilter}
                        setParcelaFilter={setParcelaFilter}
                        dataInicio={dataInicio}
                        setDataInicio={setDataInicio}
                        dataFim={dataFim}
                        setDataFim={setDataFim}
                        onMesSelecionado={setMesSelecionado}
                        anoSelecionado={anoSelecionado}
                        setAnoSelecionado={setAnoSelecionado}
                        categorias={[...new Set(despesas.map(d => d.Categoria).filter(Boolean))]}
                        responsaveis={[...new Set(despesas.map(d => d.Responsavel).filter(Boolean))]}
                        periodosMensais={periodosMensais}
                        userId={userId || ""}
                        onClearFilters={limparFiltros}
                    />
                )}

                <DespesasTable
                    despesas={despesasVisiveis}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                    onDuplicate={handleDuplicate}
                    onBulkEditClick={handleBulkEditClick}
                    onBulkDeleteClick={handleBulkDeleteClick}
                    categoryEmojis={categoryEmojis}
                />

                {temMaisDespesas && (
                    <div className="flex justify-center mt-4">
                        <Button
                            variant="outline"
                            onClick={() => setRegistrosMostrados(prev => prev + 10)}
                            className="min-w-[200px]"
                        >
                            Mostrar Mais 10 Registros
                            <span className="ml-2 text-muted-foreground">
                                ({despesasVisiveis.length} de {despesasOrdenadas.length})
                            </span>
                        </Button>
                    </div>
                )}

                {formOpen && (
                    <DespesaForm
                        open={formOpen}
                        onOpenChange={setFormOpen}
                        onSubmit={handleFormSubmit}
                        despesa={editingDespesa}
                        categorias={categoriasDisponiveis}
                        responsaveis={[...new Set(despesas.map(d => d.Responsavel).filter(Boolean))]}
                        defaultResponsavel={userName}
                    />
                )}

                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                                Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Excluir
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar exclusão em massa</AlertDialogTitle>
                            <AlertDialogDescription>
                                Tem certeza que deseja excluir as {selectedExpenseIds.length} despesas selecionadas? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Excluir Selecionadas
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <BulkEditDialog
                    open={bulkEditOpen}
                    onOpenChange={setBulkEditOpen}
                    onApply={handleBulkEditApply}
                    selectedCount={selectedExpenseIds.length}
                    categorias={categoriasDisponiveis}
                    responsaveis={[...new Set(despesas.map(d => d.Responsavel).filter(Boolean))]}
                />
            </div>
        </div>
    );
}
