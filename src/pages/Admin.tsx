import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertCircle, Ban, CalendarClock, LockOpen, RefreshCw, Search, Send, ShieldCheck, UserPlus, Users, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSouAdmin } from "@/hooks/use-sou-admin";
import { useToast } from "@/hooks/use-toast";
import { NovaContaSheet } from "@/components/admin/NovaContaSheet";
import { RegistrarPagamentoSheet } from "@/components/admin/RegistrarPagamentoSheet";

// Painel do usuário master: todas as contas do app e se estão usando o assistente do Telegram.
// Os dados vêm de fin_admin_contas (migration 20261030150000_admin_contas.sql), que só responde
// pra quem está em app_admins. Acesso pago por período (criar conta, registrar pagamento, bloquear):
// migration 20261030210000_assinaturas_contas.sql + Edge Function fin-admin-criar-conta.

interface TelegramConta {
  nome: string | null;
  conectado_em: string;
  ultima_mensagem_em: string | null;
  total_mensagens: number;
  dono: boolean;
}

interface PagamentoConta {
  pago_em: string;
  dias: number;
  valor: number | null;
  observacao: string | null;
  ativo_ate_novo: string;
}

interface AcessoConta {
  ativo: boolean;
  ativo_ate: string | null;
  bloqueado: boolean;
  total_pago: number | null;
  pagamentos: PagamentoConta[];
}

interface Conta {
  user_id: string;
  email: string;
  nome: string | null;
  criado_em: string;
  ultimo_login: string | null;
  email_confirmado: boolean;
  master: boolean;
  lancamentos: number;
  lancamentos_30d: number;
  ultimo_lancamento: string | null;
  cartoes_ativos: number;
  telegram: TelegramConta[];
  // Ausente enquanto a migration de assinaturas não for aplicada
  acesso?: AcessoConta;
}

type SituacaoTelegram = "ativo" | "parado" | "sem_uso" | "desconectado";

const DIAS_ATIVO = 7;

const situacaoTelegram = (conta: Conta): SituacaoTelegram => {
  if (conta.telegram.length === 0) return "desconectado";
  const ultima = Math.max(...conta.telegram.map((t) => (t.ultima_mensagem_em ? new Date(t.ultima_mensagem_em).getTime() : 0)));
  if (ultima === 0) return "sem_uso";
  return Date.now() - ultima <= DIAS_ATIVO * 24 * 60 * 60 * 1000 ? "ativo" : "parado";
};

const SITUACAO = {
  ativo: { texto: "Usando o Telegram", classe: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  parado: { texto: `Sem mensagens há +${DIAS_ATIVO} dias`, classe: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  sem_uso: { texto: "Conectado, nunca usou", classe: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  desconectado: { texto: "Telegram não conectado", classe: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
} as const;

type SituacaoAcesso = "master" | "em_dia" | "vencendo" | "vencido" | "bloqueado";

const DIAS_VENCENDO = 5;

const diasRestantes = (data: string) => Math.ceil((new Date(data).getTime() - Date.now()) / 86400000);

const situacaoAcesso = (conta: Conta): SituacaoAcesso | null => {
  if (conta.master) return "master";
  if (!conta.acesso) return null;
  if (conta.acesso.bloqueado) return "bloqueado";
  if (!conta.acesso.ativo || !conta.acesso.ativo_ate) return "vencido";
  return diasRestantes(conta.acesso.ativo_ate) <= DIAS_VENCENDO ? "vencendo" : "em_dia";
};

const ACESSO = {
  master: { texto: "Master, sem vencimento", classe: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  em_dia: { texto: "Em dia", classe: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  vencendo: { texto: "Vence logo", classe: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  vencido: { texto: "Vencido", classe: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  bloqueado: { texto: "Bloqueado", classe: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
} as const;

const moeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const relativo = (data: string | null) =>
  data ? formatDistanceToNow(new Date(data), { addSuffix: true, locale: ptBR }) : "nunca";

export default function Admin() {
  const { souAdmin, carregado } = useSouAdmin();
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<SituacaoTelegram | "todas">("todas");
  const [filtroAcesso, setFiltroAcesso] = useState<"todas" | "vencendo" | "vencido">("todas");
  const [novaContaOpen, setNovaContaOpen] = useState(false);
  const [contaPagamento, setContaPagamento] = useState<Conta | null>(null);
  const [contaBloqueio, setContaBloqueio] = useState<Conta | null>(null);
  const { toast } = useToast();

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    const { data, error } = await supabase.rpc("fin_admin_contas" as any);
    if (error) setErro(error.message);
    else setContas((data || []) as unknown as Conta[]);
    setCarregando(false);
  };

  useEffect(() => {
    if (souAdmin) carregar();
  }, [souAdmin]);

  const contagem = useMemo(() => {
    const c = { todas: contas.length, ativo: 0, parado: 0, sem_uso: 0, desconectado: 0 };
    for (const conta of contas) c[situacaoTelegram(conta)]++;
    return c;
  }, [contas]);

  const temControleAcesso = contas.some((c) => c.acesso);
  const contagemAcesso = useMemo(() => {
    const c = { vencendo: 0, vencido: 0 };
    for (const conta of contas) {
      const situacao = situacaoAcesso(conta);
      if (situacao === "vencendo") c.vencendo++;
      if (situacao === "vencido" || situacao === "bloqueado") c.vencido++;
    }
    return c;
  }, [contas]);

  const handleBloqueio = async () => {
    const conta = contaBloqueio;
    setContaBloqueio(null);
    if (!conta?.acesso) return;
    const bloquear = !conta.acesso.bloqueado;
    const { error } = await supabase.rpc("fin_admin_bloquear_conta" as any, { p_user_id: conta.user_id, p_bloqueado: bloquear });
    if (error) {
      toast({ title: "Erro ao alterar acesso", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: bloquear ? `${conta.nome || conta.email} bloqueado` : `${conta.nome || conta.email} desbloqueado` });
    carregar();
  };

  const visiveis = contas.filter((conta) => {
    if (filtro !== "todas" && situacaoTelegram(conta) !== filtro) return false;
    const situacao = situacaoAcesso(conta);
    if (filtroAcesso === "vencendo" && situacao !== "vencendo") return false;
    if (filtroAcesso === "vencido" && situacao !== "vencido" && situacao !== "bloqueado") return false;
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return [conta.email, conta.nome, ...conta.telegram.map((t) => t.nome)].some((v) => (v || "").toLowerCase().includes(termo));
  });

  if (carregado && !souAdmin) return <Navigate to="/dashboard" replace />;

  const resumo: { chave: SituacaoTelegram | "todas"; titulo: string; cor: string }[] = [
    { chave: "todas", titulo: "Contas", cor: "text-foreground" },
    { chave: "ativo", titulo: "Usando o Telegram", cor: "text-emerald-600" },
    { chave: "sem_uso", titulo: "Conectado, nunca usou", cor: "text-amber-600" },
    { chave: "parado", titulo: `Parado há +${DIAS_ATIVO} dias`, cor: "text-amber-600" },
    { chave: "desconectado", titulo: "Sem Telegram", cor: "text-slate-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-card-foreground flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" /> Contas
          </h1>
          <p className="text-muted-foreground mt-2">Todas as contas do app e o uso do assistente no Telegram</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={carregar} disabled={carregando}>
            <RefreshCw className={`h-4 w-4 mr-2 ${carregando ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button onClick={() => setNovaContaOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Nova conta
          </Button>
        </div>
      </div>

      {erro && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {resumo.map((r) => (
          <Card
            key={r.chave}
            className={`cursor-pointer transition-all hover:shadow-md ${filtro === r.chave ? "border-primary ring-2 ring-primary/20" : ""}`}
            onClick={() => setFiltro(r.chave)}
          >
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{r.titulo}</p>
              <p className={`text-2xl font-bold ${r.cor}`}>{contagem[r.chave]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {temControleAcesso && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground flex items-center gap-1"><CalendarClock className="h-4 w-4" /> Acesso:</span>
          {([
            { chave: "todas", texto: "Todas" },
            { chave: "vencendo", texto: `Vence em até ${DIAS_VENCENDO} dias (${contagemAcesso.vencendo})` },
            { chave: "vencido", texto: `Vencidas ou bloqueadas (${contagemAcesso.vencido})` },
          ] as const).map((f) => (
            <Button key={f.chave} size="sm" variant={filtroAcesso === f.chave ? "default" : "outline"} onClick={() => setFiltroAcesso(f.chave)}>
              {f.texto}
            </Button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por e-mail, nome ou nome no Telegram" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {!carregando && visiveis.length === 0 && !erro && (
        <p className="text-center text-muted-foreground py-8">Nenhuma conta encontrada.</p>
      )}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {visiveis.map((conta) => {
          const situacao = situacaoTelegram(conta);
          const acesso = situacaoAcesso(conta);
          const ativoAte = conta.acesso?.ativo_ate ? new Date(conta.acesso.ativo_ate) : null;
          return (
            <Card key={conta.user_id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      {conta.nome || conta.email}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground truncate">{conta.email}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {conta.master && <Badge>Master</Badge>}
                    {!conta.email_confirmado && <Badge variant="outline">E-mail não confirmado</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">Cadastro</span>
                  <span>{format(new Date(conta.criado_em), "dd/MM/yyyy")}</span>
                  <span className="text-muted-foreground">Último login</span>
                  <span>{relativo(conta.ultimo_login)}</span>
                  <span className="text-muted-foreground">Lançamentos</span>
                  <span>{conta.lancamentos} <span className="text-muted-foreground">({conta.lancamentos_30d} nos últimos 30 dias)</span></span>
                  <span className="text-muted-foreground">Último lançamento</span>
                  <span>{relativo(conta.ultimo_lancamento)}</span>
                  <span className="text-muted-foreground">Cartões ativos</span>
                  <span>{conta.cartoes_ativos}</span>
                </div>

                {acesso && (
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${ACESSO[acesso].classe}`}>
                          <CalendarClock className="h-3 w-3" /> {ACESSO[acesso].texto}
                        </span>
                        {acesso !== "master" && ativoAte && (
                          <span className="text-muted-foreground">
                            {ativoAte > new Date() ? "até" : "venceu em"}{" "}
                            <span className="text-foreground">{format(ativoAte, "dd/MM/yyyy")}</span>
                            {ativoAte > new Date() && ` (faltam ${diasRestantes(conta.acesso!.ativo_ate!)} dias)`}
                          </span>
                        )}
                      </div>
                      {acesso !== "master" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => setContaPagamento(conta)}>
                            <Wallet className="h-4 w-4 mr-1" /> Registrar pagamento
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title={conta.acesso?.bloqueado ? "Desbloquear" : "Bloquear agora"}
                            onClick={() => setContaBloqueio(conta)}
                          >
                            {conta.acesso?.bloqueado ? <LockOpen className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                          </Button>
                        </div>
                      )}
                    </div>
                    {conta.acesso && conta.acesso.pagamentos.length > 0 && (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {conta.acesso.pagamentos.slice(0, 3).map((pg, i) => (
                          <p key={i}>
                            {format(new Date(pg.pago_em), "dd/MM/yyyy")} · +{pg.dias} dias
                            {pg.valor !== null && ` · ${moeda(Number(pg.valor))}`}
                            {pg.observacao && ` · ${pg.observacao}`}
                          </p>
                        ))}
                        {conta.acesso.total_pago !== null && (
                          <p>Total pago: <span className="text-foreground">{moeda(Number(conta.acesso.total_pago))}</span></p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t pt-3 space-y-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${SITUACAO[situacao].classe}`}>
                    <Send className="h-3 w-3" /> {SITUACAO[situacao].texto}
                  </span>
                  {conta.telegram.map((t, i) => (
                    <p key={i} className="text-muted-foreground">
                      <span className="text-foreground">{t.nome || "Telegram"}</span>
                      {t.dono && " (dono do bot)"} · conectado em {format(new Date(t.conectado_em), "dd/MM/yyyy")} ·{" "}
                      {t.total_mensagens} mensage{t.total_mensagens === 1 ? "m" : "ns"} · última {relativo(t.ultima_mensagem_em)}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <NovaContaSheet open={novaContaOpen} onOpenChange={setNovaContaOpen} onCriada={carregar} />

      <RegistrarPagamentoSheet
        conta={contaPagamento ? { user_id: contaPagamento.user_id, email: contaPagamento.email, nome: contaPagamento.nome, ativo_ate: contaPagamento.acesso?.ativo_ate || null } : null}
        onOpenChange={(aberto) => { if (!aberto) setContaPagamento(null); }}
        onRegistrado={carregar}
      />

      <AlertDialog open={!!contaBloqueio} onOpenChange={(aberto) => { if (!aberto) setContaBloqueio(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {contaBloqueio?.acesso?.bloqueado ? "Desbloquear" : "Bloquear"} {contaBloqueio?.nome || contaBloqueio?.email}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {contaBloqueio?.acesso?.bloqueado
                ? "A conta volta a ter acesso até o vencimento atual (se ainda não tiver vencido)."
                : "A conta perde o acesso agora, no app e no Telegram, sem mexer no vencimento. Os dados continuam guardados."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBloqueio}>
              {contaBloqueio?.acesso?.bloqueado ? "Desbloquear" : "Bloquear"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
