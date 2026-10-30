import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Search, Send, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSouAdmin } from "@/hooks/use-sou-admin";

// Painel do usuário master: todas as contas do app e se estão usando o assistente do Telegram.
// Os dados vêm de fin_admin_contas (migration 20261030150000_admin_contas.sql), que só responde
// pra quem está em app_admins.

interface TelegramConta {
  nome: string | null;
  conectado_em: string;
  ultima_mensagem_em: string | null;
  total_mensagens: number;
  dono: boolean;
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

const relativo = (data: string | null) =>
  data ? formatDistanceToNow(new Date(data), { addSuffix: true, locale: ptBR }) : "nunca";

export default function Admin() {
  const { souAdmin, carregado } = useSouAdmin();
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<SituacaoTelegram | "todas">("todas");

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

  const visiveis = contas.filter((conta) => {
    if (filtro !== "todas" && situacaoTelegram(conta) !== filtro) return false;
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
        <Button variant="outline" onClick={carregar} disabled={carregando}>
          <RefreshCw className={`h-4 w-4 mr-2 ${carregando ? "animate-spin" : ""}`} /> Atualizar
        </Button>
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
    </div>
  );
}
