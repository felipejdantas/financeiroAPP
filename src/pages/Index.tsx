import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Despesa, ResponsavelFilter, TipoFilter } from "@/types/despesa";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, Plus, LogOut, Trash2, MoreVertical, BarChart3, X, Smile } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { CategoryCharts } from "@/components/dashboard/CategoryCharts";
import { DespesasTable } from "@/components/dashboard/DespesasTable";
import { YearMonthFilter } from "@/components/dashboard/YearMonthFilter";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { DespesaForm } from "@/components/dashboard/DespesaForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { PeriodoFaturamentoConfig } from "@/components/dashboard/PeriodoFaturamentoConfig";
import { PeriodosMensaisManager } from "@/components/dashboard/PeriodosMensaisManager";
import { GraficosComparativos } from "@/components/dashboard/GraficosComparativos";
import { CategoryEmojiManager } from "@/components/dashboard/CategoryEmojiManager";
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
  // Trata "A vista" (com ou sem acento) como 1 parcela
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

const Index = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [dataInicioCartao, setDataInicioCartao] = useState("");
  const [dataFimCartao, setDataFimCartao] = useState("");

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
  const [configMesesOpen, setConfigMesesOpen] = useState(false);
  const [periodoCartaoOpen, setPeriodoCartaoOpen] = useState(false);
  const [registrosMostrados, setRegistrosMostrados] = useState(10);
  const [mesSelecionado, setMesSelecionado] = useState<number | null>(null);
  const [periodosMensais, setPeriodosMensais] = useState<any[]>([]);
  const [graficosOpen, setGraficosOpen] = useState(false);
  const [emojiManagerOpen, setEmojiManagerOpen] = useState(false);
  const [categoryEmojis, setCategoryEmojis] = useState<Record<string, string>>({});
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [filterMonth, setFilterMonth] = useState<number | null>(null);

  const fetchDespesas = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

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
      setError(errorMessage);
      toast({
        title: "Erro ao carregar dados",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calcularPeriodoDoMes = async (uid: string, mesRef: number): Promise<{ dataInicio: string, dataFim: string }> => {
    try {
      const hoje = new Date();
      const anoAtual = hoje.getFullYear();

      // Busca o período configurado para o mês especificado
      const { data, error } = await supabase
        .from("periodos_mensais_cartao")
        .select("*")
        .eq("user_id", uid)
        .eq("mes_referencia", mesRef)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        // Se tiver as novas colunas de data, usa elas
        if (data.data_inicio && data.data_fim) {
          return {
            dataInicio: data.data_inicio,
            dataFim: data.data_fim
          };
        }

        // Fallback para lógica antiga
        const mesInicio = mesRef + data.mes_inicio_offset;
        const anoInicio = mesInicio < 1 ? anoAtual - 1 : anoAtual;
        const mesInicioAjustado = mesInicio < 1 ? 12 : mesInicio;

        const dataInicio = new Date(anoInicio, mesInicioAjustado - 1, data.dia_inicio);
        const dataFim = new Date(anoAtual, mesRef - 1, data.dia_fim);

        return {
          dataInicio: dataInicio.toISOString().split('T')[0],
          dataFim: dataFim.toISOString().split('T')[0]
        };
      } else {
        // Padrão: mês completo especificado
        const primeiroDia = new Date(anoAtual, mesRef - 1, 1);
        const ultimoDia = new Date(anoAtual, mesRef, 0);
        return {
          dataInicio: format(primeiroDia, "yyyy-MM-dd"),
          dataFim: format(ultimoDia, "yyyy-MM-dd")
        };
      }
    } catch (error: any) {
      console.error("Erro ao calcular período:", error);
      // Fallback: usa mês especificado completo
      const primeiroDia = new Date(new Date().getFullYear(), mesRef - 1, 1);
      const ultimoDia = new Date(new Date().getFullYear(), mesRef, 0);
      return {
        dataInicio: format(primeiroDia, "yyyy-MM-dd"),
        dataFim: format(ultimoDia, "yyyy-MM-dd")
      };
    }
  };

  const calcularPeriodoAtualDoCartao = async (uid: string) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const anoAtual = hoje.getFullYear();

    try {
      // Busca todos os períodos configurados
      const { data: periodos, error } = await supabase
        .from("periodos_mensais_cartao")
        .select("*")
        .eq("user_id", uid)
        .order("mes_referencia");

      if (error) throw error;

      if (periodos && periodos.length > 0) {
        // Para cada período, calcula as datas e verifica se hoje está dentro
        for (const periodo of periodos) {
          const mesInicio = periodo.mes_referencia + periodo.mes_inicio_offset;
          const anoInicio = mesInicio < 1 ? anoAtual - 1 : (mesInicio > 12 ? anoAtual + 1 : anoAtual);
          const mesInicioAjustado = mesInicio < 1 ? 12 + mesInicio : (mesInicio > 12 ? mesInicio - 12 : mesInicio);

          const dataInicio = new Date(anoInicio, mesInicioAjustado - 1, periodo.dia_inicio);
          dataInicio.setHours(0, 0, 0, 0);

          const dataFim = new Date(anoAtual, periodo.mes_referencia - 1, periodo.dia_fim);
          dataFim.setHours(23, 59, 59, 999);

          // Se hoje está dentro deste período, usa ele
          if (hoje >= dataInicio && hoje <= dataFim) {
            setDataInicioCartao(dataInicio.toISOString().split('T')[0]);
            setDataFimCartao(dataFim.toISOString().split('T')[0]);
            return;
          }
        }
      }

      // Fallback: usa mês atual completo
      const mesAtual = hoje.getMonth() + 1;
      const periodo = await calcularPeriodoDoMes(uid, mesAtual);
      setDataInicioCartao(periodo.dataInicio);
      setDataFimCartao(periodo.dataFim);

    } catch (error) {
      console.error("Erro ao calcular período:", error);
      // Fallback: usa mês atual completo
      const mesAtual = hoje.getMonth() + 1;
      const periodo = await calcularPeriodoDoMes(uid, mesAtual);
      setDataInicioCartao(periodo.dataInicio);
      setDataFimCartao(periodo.dataFim);
    }
  };

  const loadUserProfile = async (uid: string) => {
    await calcularPeriodoAtualDoCartao(uid);

    // Buscar nome do usuário do perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", uid)
      .single();

    if (profile?.nome) {
      setUserName(profile.nome);
    }
  };

  const aplicarFiltrosIniciais = async (uid: string) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const anoAtual = hoje.getFullYear();

    try {
      // Busca todos os períodos configurados
      const { data: periodos, error } = await supabase
        .from("periodos_mensais_cartao")
        .select("*")
        .eq("user_id", uid)
        .order("mes_referencia");

      if (error) throw error;

      if (periodos && periodos.length > 0) {
        // Para cada período, calcula as datas e verifica se hoje está dentro
        for (const periodo of periodos) {
          const mesInicio = periodo.mes_referencia + periodo.mes_inicio_offset;
          const anoInicio = mesInicio < 1 ? anoAtual - 1 : (mesInicio > 12 ? anoAtual + 1 : anoAtual);
          const mesInicioAjustado = mesInicio < 1 ? 12 + mesInicio : (mesInicio > 12 ? mesInicio - 12 : mesInicio);

          const dataInicio = new Date(anoInicio, mesInicioAjustado - 1, periodo.dia_inicio);
          dataInicio.setHours(0, 0, 0, 0);

          const dataFim = new Date(anoAtual, periodo.mes_referencia - 1, periodo.dia_fim);
          dataFim.setHours(23, 59, 59, 999);

          // Se hoje está dentro deste período, aplica nos filtros
          if (hoje >= dataInicio && hoje <= dataFim) {
            setDataInicio(dataInicio.toISOString().split('T')[0]);
            setDataFim(dataFim.toISOString().split('T')[0]);
            setMesSelecionado(periodo.mes_referencia);
            return;
          }
        }
      }

      // Fallback: usa mês atual completo se nenhum período estiver ativo
      const mesAtual = hoje.getMonth() + 1;
      const periodo = await calcularPeriodoDoMes(uid, mesAtual);
      setDataInicio(periodo.dataInicio);
      setDataFim(periodo.dataFim);

    } catch (error) {
      console.error("Erro ao aplicar filtros:", error);
      // Fallback: usa mês atual completo
      const mesAtual = hoje.getMonth() + 1;
      const periodo = await calcularPeriodoDoMes(uid, mesAtual);
      setDataInicio(periodo.dataInicio);
      setDataFim(periodo.dataFim);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        loadUserProfile(session.user.id);
      } else {
        navigate('/auth');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        loadUserProfile(session.user.id);
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
      aplicarFiltrosIniciais(userId);
    }
  }, [userId]);

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
      const { data, error } = await (supabase as any)
        .from("categoria_emojis")
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;

      // Convert array to Record<string, string>
      const emojiMap: Record<string, string> = {};
      (data || []).forEach((item: any) => {
        emojiMap[item.categoria] = item.emoji;
      });
      setCategoryEmojis(emojiMap);
    } catch (error: any) {
      console.error("Erro ao carregar emojis das categorias:", error);
    }
  };

  const despesasFiltradas = despesas.filter((despesa) => {
    // Filtro de responsável
    if (responsavelFilter !== "todos" && despesa.Responsavel !== responsavelFilter) {
      return false;
    }

    // Filtro de tipo
    if (tipoFilter !== "todos" && despesa.Tipo !== tipoFilter) {
      return false;
    }

    // Filtro de categoria
    if (categoriaFilter !== "todas" && despesa.Categoria !== categoriaFilter) {
      return false;
    }

    // Filtro de parcelas
    if (parcelaFilter.length > 0) {
      const totalParcelas = getTotalParcelas(despesa.Parcelas || "");
      if (!totalParcelas) return false;
      if (!parcelaFilter.includes(totalParcelas)) return false;
    }

    // Filtro de Ano/Mês
    if (filterYear !== null || filterMonth !== null) {
      const despesaDate = brToDate(despesa.Data);
      const despesaYear = despesaDate.getFullYear();
      const despesaMonth = despesaDate.getMonth() + 1; // getMonth() returns 0-11

      // Filter by year
      if (filterYear !== null && despesaYear !== filterYear) {
        return false;
      }

      // Filter by month (only if month is selected)
      if (filterMonth !== null && despesaMonth !== filterMonth) {
        return false;
      }
    }

    // Filtro de Data (fallback para compatibilidade com filtros existentes)
    if (!filterYear && !filterMonth) {
      const despesaDate = brToDate(despesa.Data);

      // Lógica diferenciada por tipo
      if (despesa.Tipo === "Crédito") {
        // Cartão segue o período configurado (dataInicio/dataFim)
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
        // Débito/Pix/Dinheiro
        if (mesSelecionado) {
          // Se tem mês selecionado, usa o mês civil (01 a 30/31)
          const anoRef = dataInicio ? inputToDate(dataInicio).getFullYear() : new Date().getFullYear();
          const inicioMes = new Date(anoRef, mesSelecionado - 1, 1);
          inicioMes.setHours(0, 0, 0, 0);

          const fimMes = new Date(anoRef, mesSelecionado, 0);
          fimMes.setHours(23, 59, 59, 999);

          if (despesaDate < inicioMes || despesaDate > fimMes) return false;
        } else {
          // Se não tem mês selecionado (filtro manual), segue as datas do filtro
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
        // Verificar se há parcelas
        const parcelasMatch = despesa.Parcelas?.match(/(\d+)x?/i);
        const numeroParcelas = parcelasMatch ? parseInt(parcelasMatch[1]) : 1;

        if (numeroParcelas > 1) {
          // Criar múltiplas despesas parceladas
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
          // Criar despesa única
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

  const handleSelecionarMes = async (mes: number) => {
    if (!userId) return;

    const periodo = await calcularPeriodoDoMes(userId, mes);
    setDataInicioCartao(periodo.dataInicio);
    setDataFimCartao(periodo.dataFim);
    setTipoFilter("Crédito");
    setMesSelecionado(mes);
    setRegistrosMostrados(10);

    toast({
      title: "Mês selecionado",
      description: `Mostrando despesas de cartão do período configurado.`,
    });
  };

  const despesasOrdenadas = [...despesasFiltradas].sort((a, b) => (b.id || 0) - (a.id || 0));
  const despesasVisiveis = despesasOrdenadas.slice(0, registrosMostrados);
  const temMaisDespesas = despesasOrdenadas.length > registrosMostrados;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleSavePeriodoFatura = (dataInicio: string, dataFim: string) => {
    setDataInicioCartao(dataInicio);
    setDataFimCartao(dataFim);

    toast({
      title: "Período atualizado temporariamente!",
      description: "Use 'Configurar Meses' para salvar configurações permanentes.",
    });
  };

  const handleFormSubmit = async (data: any) => {
    await handleAddOrUpdate({
      ...data,
      id: editingDespesa?.id
    });
    handleFormClose();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-3 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
              Fin DantasInfo
            </h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
              Gerencie suas despesas de forma eficiente
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setFormOpen(true)} className="flex-1 sm:flex-none">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Nova Despesa</span>
              <span className="sm:hidden">Nova</span>
            </Button>
            <ExportButton
              despesas={despesasFiltradas}
              filtrosAtivos={{
                responsavel: responsavelFilter,
                tipo: tipoFilter,
                categoria: categoriaFilter
              }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex-1 sm:flex-none">
                  <MoreVertical className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Mais Opções</span>
                  <span className="sm:hidden">Mais</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border z-50">
                <DropdownMenuItem onClick={() => setGraficosOpen(true)}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Gráficos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConfigMesesOpen(true)}>
                  Configurar Meses
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPeriodoCartaoOpen(true)}>
                  Período Cartão
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEmojiManagerOpen(true)}>
                  <Smile className="mr-2 h-4 w-4" />
                  Gerenciar Emojis
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    Filtrar por Mês do Cartão
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map((mes, idx) => (
                        <DropdownMenuItem
                          key={idx}
                          onClick={() => handleSelecionarMes(idx + 1)}
                          className={mesSelecionado === idx + 1 ? "bg-accent" : ""}
                        >
                          {mes}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" onClick={fetchDespesas} size="icon" className="shrink-0">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="destructive" onClick={handleLogout} size="icon" className="shrink-0">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Erro:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {!loading && despesasFiltradas.length === 0 && despesas.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhuma despesa encontrada com os filtros aplicados.
            </AlertDescription>
          </Alert>
        )}



        <SummaryCards despesas={despesasFiltradas} />

        <CategoryCharts despesas={despesasFiltradas} />

        <DespesasTable
          despesas={despesasVisiveis}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onDuplicate={handleDuplicate}
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
            categorias={[...new Set(despesas.map(d => d.Categoria).filter(Boolean))]}
            responsaveis={[...new Set(despesas.map(d => d.Responsavel).filter(Boolean))]}
            defaultResponsavel={userName}
          />
        )}

        {userId && configMesesOpen && (
          <PeriodosMensaisManager
            userId={userId}
            onUpdate={() => loadUserProfile(userId)}
            open={configMesesOpen}
            onOpenChange={setConfigMesesOpen}
          />
        )}

        {periodoCartaoOpen && (
          <PeriodoFaturamentoConfig
            dataInicio={dataInicioCartao}
            dataFim={dataFimCartao}
            onSave={handleSavePeriodoFatura}
            open={periodoCartaoOpen}
            onOpenChange={setPeriodoCartaoOpen}
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
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {graficosOpen && (
          <div className="fixed inset-0 bg-background/95 z-50 overflow-y-auto">
            <div className="container mx-auto py-8 px-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Análise de Gastos</h2>
                <Button variant="ghost" size="icon" onClick={() => setGraficosOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <GraficosComparativos despesas={despesasFiltradas} periodosMensais={periodosMensais} />
            </div>
          </div>
        )}

        {userId && emojiManagerOpen && (
          <CategoryEmojiManager
            open={emojiManagerOpen}
            onOpenChange={setEmojiManagerOpen}
            userId={userId}
            categorias={[...new Set(despesas.map(d => d.Categoria).filter(Boolean))]}
            onUpdate={fetchCategoryEmojis}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
