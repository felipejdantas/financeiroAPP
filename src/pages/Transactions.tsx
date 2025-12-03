import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Despesa, ResponsavelFilter, TipoFilter } from "@/types/despesa";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus } from "lucide-react";
import { Filters } from "@/components/dashboard/Filters";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { DespesasTable } from "@/components/dashboard/DespesasTable";
import { DespesaForm } from "@/components/dashboard/DespesaForm";
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
    const [periodosMensais, setPeriodosMensais] = useState<any[]>([]);

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
            const tableName = despesa.Tipo === "Débito" ? "Financeiro Debito" : "Financeiro Cartão";

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
                        valor: despesa.valor
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
                            user_id: userId
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
                            user_id: userId
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
            const tableName = despesa.Tipo === "Débito" ? "Financeiro Debito" : "Financeiro Cartão";

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

            const tableName = despesa.Tipo === "Débito" ? "Financeiro Debito" : "Financeiro Cartão";

            const { error } = await supabase
                .from(tableName)
                .delete()
                .eq("id", despesaToDelete);

            if (error) throw error;

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
            id: editingDespesa?.id
        });
        handleFormClose();
    };

    const despesasOrdenadas = [...despesasFiltradas].sort((a, b) => (b.id || 0) - (a.id || 0));
    const despesasVisiveis = despesasOrdenadas.slice(0, registrosMostrados);
    const temMaisDespesas = despesasOrdenadas.length > registrosMostrados;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-card-foreground">Transações</h1>
                    <p className="text-muted-foreground mt-2">
                        Visualize e gerencie todas as suas transações
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setFormOpen(true)}>
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
                    />
                    <Button variant="outline" onClick={fetchDespesas} size="icon">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

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
                categorias={[...new Set(despesas.map(d => d.Categoria).filter(Boolean))]}
                responsaveis={[...new Set(despesas.map(d => d.Responsavel).filter(Boolean))]}
                periodosMensais={periodosMensais}
                userId={userId || ""}
                onClearFilters={limparFiltros}
            />

            <DespesasTable
                despesas={despesasVisiveis}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onDuplicate={handleDuplicate}
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
                    categorias={[...new Set(despesas.map(d => d.Categoria).filter(Boolean))]}
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
        </div>
    );
}
