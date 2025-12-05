import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Despesa } from "@/types/despesa";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, Plus, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { CategoryCharts } from "@/components/dashboard/CategoryCharts";
import { DespesasTable } from "@/components/dashboard/DespesasTable";
import { DespesaForm } from "@/components/dashboard/DespesaForm";
import { BudgetVsActual } from "@/components/dashboard/BudgetVsActual";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
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

const Dashboard = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [dataInicioCartao, setDataInicioCartao] = useState("");
  const [dataFimCartao, setDataFimCartao] = useState("");

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [despesaToDelete, setDespesaToDelete] = useState<number | null>(null);
  const [registrosMostrados, setRegistrosMostrados] = useState(10);
  const [mesSelecionado, setMesSelecionado] = useState<number | null>(null);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [periodosMensais, setPeriodosMensais] = useState<any[]>([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(new Date().getMonth()); // 0-11
  const [activeSummaryFilter, setActiveSummaryFilter] = useState<{ type: string; value?: string } | null>(null);
  const [categoryEmojis, setCategoryEmojis] = useState<Record<string, string>>({});
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState<string[]>([]);

  const handleSummaryFilterChange = (type: string, value?: string) => {
    if (type === "total") {
      setActiveSummaryFilter(null);
    } else {
      setActiveSummaryFilter({ type, value });
    }
    setRegistrosMostrados(10); // Reset pagination when filter changes
  };

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

  const calcularPeriodoDoMes = async (uid: string, mesRef: number, anoRef?: number): Promise<{ dataInicio: string, dataFim: string }> => {
    try {
      const anoUsar = anoRef || anoSelecionado;

      // Busca o período configurado para o mês e ano especificados
      const { data, error } = await supabase
        .from("periodos_mensais_cartao")
        .select("*")
        .eq("user_id", uid)
        .eq("mes_referencia", mesRef)
        .eq("ano_referencia", anoUsar)
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
        const mesInicio = mesRef + (data.mes_inicio_offset || 0);
        const anoInicio = mesInicio < 1 ? anoUsar - 1 : anoUsar;
        const mesInicioAjustado = mesInicio < 1 ? 12 : mesInicio;

        const dataInicio = new Date(anoInicio, mesInicioAjustado - 1, data.dia_inicio);
        const dataFim = new Date(anoUsar, mesRef - 1, data.dia_fim);

        return {
          dataInicio: dataInicio.toISOString().split('T')[0],
          dataFim: dataFim.toISOString().split('T')[0]
        };
      } else {
        // Padrão: mês completo especificado
        const primeiroDia = new Date(anoUsar, mesRef - 1, 1);
        const ultimoDia = new Date(anoUsar, mesRef, 0);
        return {
          dataInicio: format(primeiroDia, "yyyy-MM-dd"),
          dataFim: format(ultimoDia, "yyyy-MM-dd")
        };
      }
    } catch (error: any) {
      console.error("Erro ao calcular período:", error);
      // Fallback: usa mês especificado completo
      const anoUsar = anoRef || new Date().getFullYear();
      const primeiroDia = new Date(anoUsar, mesRef - 1, 1);
      const ultimoDia = new Date(anoUsar, mesRef, 0);
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
      fetchCategorias();
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

  const despesasFiltradas = despesas.filter((despesa) => {
    // Filtro de Data
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
            valor: despesa.valor,
            created_at: despesa.created_at
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

  const handleSelecionarMes = async (mes: number, ano?: number) => {
    if (!userId) return;

    const anoUsar = ano || anoSelecionado;
    const periodo = await calcularPeriodoDoMes(userId, mes, anoUsar);

    // Aplica as datas do período configurado aos filtros principais
    setDataInicio(periodo.dataInicio);
    setDataFim(periodo.dataFim);
    setMesSelecionado(mes);
    if (ano) setAnoSelecionado(ano);
    setRegistrosMostrados(10);

    toast({
      title: "Período selecionado",
      description: `Mostrando despesas de ${getMonthName(mes - 1)} ${anoUsar}.`,
    });
  };

  const despesasExibidas = despesasFiltradas.filter(despesa => {
    if (!activeSummaryFilter) return true;

    switch (activeSummaryFilter.type) {
      case "credito":
        return despesa.Tipo === "Crédito";
      case "outros":
        return ["Pix", "Débito", "Dinheiro"].includes(despesa.Tipo);
      case "responsavel":
        return despesa.Responsavel === activeSummaryFilter.value;
      default:
        return true;
    }
  });

  const despesasOrdenadas = [...despesasExibidas].sort((a, b) => (b.id || 0) - (a.id || 0));
  const despesasVisiveis = despesasOrdenadas.slice(0, registrosMostrados);
  const temMaisDespesas = despesasOrdenadas.length > registrosMostrados;

  const handleFormSubmit = async (data: any) => {
    await handleAddOrUpdate({
      ...data,
      id: editingDespesa?.id,
      created_at: data.created_at ? new Date(data.created_at).toISOString() : undefined
    });
    handleFormClose();
  };

  const handlePreviousMonth = async () => {
    if (!userId) return;

    let novoMes = mesSelecionado || (currentMonthIndex + 1);
    let novoAno = anoSelecionado;

    novoMes--;
    if (novoMes < 1) {
      novoMes = 12;
      novoAno--;
      if (novoAno < 2025) novoAno = 2028; // Circular entre 2025-2028
    }

    setAnoSelecionado(novoAno);
    await handleSelecionarMes(novoMes, novoAno);
    setCurrentMonthIndex(novoMes - 1);
  };

  const handleNextMonth = async () => {
    if (!userId) return;

    let novoMes = mesSelecionado || (currentMonthIndex + 1);
    let novoAno = anoSelecionado;

    novoMes++;
    if (novoMes > 12) {
      novoMes = 1;
      novoAno++;
      if (novoAno > 2028) novoAno = 2025; // Circular entre 2025-2028
    }

    setAnoSelecionado(novoAno);
    await handleSelecionarMes(novoMes, novoAno);
    setCurrentMonthIndex(novoMes - 1);
  };

  const getMonthName = (index: number) => {
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return months[index];
  };

  const getCurrentPeriodLabel = () => {
    const mes = mesSelecionado || (currentMonthIndex + 1);
    return getMonthName(mes - 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:justify-between lg:items-end">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              Fin DantasInfo
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-400 font-medium">
              Gerencie suas despesas de forma inteligente
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm p-2 rounded-xl border border-white/20 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePreviousMonth}
              className="h-10 w-10 hover:bg-primary/10 hover:text-primary transition-colors"
              title="Mês anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div className="px-6 py-2 bg-primary rounded-lg min-w-[160px] text-center shadow-sm">
              <span className="text-base font-semibold text-white">
                {getCurrentPeriodLabel()}
              </span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              className="h-10 w-10 hover:bg-primary/10 hover:text-primary transition-colors"
              title="Próximo mês"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>

            <div className="w-px h-8 bg-border mx-2" />

            <Select
              value={anoSelecionado.toString()}
              onValueChange={(value) => {
                const novoAno = parseInt(value);
                setAnoSelecionado(novoAno);
                const mes = mesSelecionado || (currentMonthIndex + 1);
                handleSelecionarMes(mes, novoAno);
              }}
            >
              <SelectTrigger className="w-[100px] h-10 bg-white/80 dark:bg-slate-800/80 border-primary/20 focus:ring-primary">
                <Calendar className="h-4 w-4 mr-2 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
                <SelectItem value="2028">2028</SelectItem>
              </SelectContent>
            </Select>

            <div className="w-px h-8 bg-border mx-2" />

            <Button
              variant="ghost"
              onClick={fetchDespesas}
              size="icon"
              className="h-10 w-10 hover:bg-primary/10 hover:text-primary transition-colors"
              title="Atualizar dados"
            >
              <RefreshCw className="h-5 w-5" />
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

        <SummaryCards
          despesas={despesasFiltradas}
          onFilterChange={handleSummaryFilterChange}
          activeFilter={activeSummaryFilter}
        />

        <CategoryCharts despesas={despesasFiltradas} />

        {userId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <BudgetVsActual
              currentMonth={mesSelecionado || (currentMonthIndex + 1)}
              currentYear={anoSelecionado}
              userId={userId}
            />
          </div>
        )}

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
      </div>
    </div>
  );
};

export default Dashboard;
