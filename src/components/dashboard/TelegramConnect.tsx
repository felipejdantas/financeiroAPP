import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Unlink, CheckCircle2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Liga a conta do Telegram do usuário ao agente financeiro (n8n): o app gera um código de uso único
// e o bot o recebe via /start. Ver migration 20261030120000_telegram_vinculos.sql.
const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "dantasinfo_bot";

interface Vinculo {
  telegram_id: number;
  nome_telegram: string | null;
  created_at: string;
}

interface TelegramConnectProps {
  userId: string;
}

export const TelegramConnect = ({ userId }: TelegramConnectProps) => {
  const { toast } = useToast();
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [disponivel, setDisponivel] = useState(true);
  const [codigo, setCodigo] = useState<{ codigo: string; expiraEm: Date } | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [gerando, setGerando] = useState(false);
  const [paraDesconectar, setParaDesconectar] = useState<Vinculo | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("telegram_vinculos" as any)
      .select("telegram_id, nome_telegram, created_at")
      .eq("user_id", userId)
      .order("created_at");
    if (error) {
      // Tabela ainda não criada no banco (migration pendente)
      setDisponivel(false);
      return [];
    }
    const lista = (data || []) as unknown as Vinculo[];
    setDisponivel(true);
    setVinculos(lista);
    return lista;
  }, [userId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Enquanto o código está valendo: contagem regressiva + confere a cada 3s se o bot já conectou
  useEffect(() => {
    if (!codigo) return;
    // Vínculo criado (ou reconectado — o banco renova created_at) depois que o código foi gerado
    const geradoEm = Date.now() - 15_000; // folga pra diferença de relógio com o servidor
    const tick = setInterval(() => {
      setSegundosRestantes(Math.max(0, Math.round((codigo.expiraEm.getTime() - Date.now()) / 1000)));
    }, 1000);
    const checagem = setInterval(async () => {
      const lista = await carregar();
      if (lista.some((v) => new Date(v.created_at).getTime() >= geradoEm)) {
        setCodigo(null);
        toast({ title: "Telegram conectado!", description: "Já pode mandar suas despesas para o bot." });
      }
    }, 3000);
    return () => {
      clearInterval(tick);
      clearInterval(checagem);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);

  useEffect(() => {
    if (codigo && segundosRestantes === 0 && codigo.expiraEm.getTime() <= Date.now()) setCodigo(null);
  }, [segundosRestantes, codigo]);

  const handleGerarCodigo = async () => {
    setGerando(true);
    const { data, error } = await supabase.rpc("fin_gerar_codigo_telegram" as any);
    setGerando(false);
    if (error || !data) {
      toast({ title: "Erro ao gerar código", description: error?.message, variant: "destructive" });
      return;
    }
    const resultado = data as unknown as { codigo: string; expira_em: string };
    const expiraEm = new Date(resultado.expira_em);
    setCodigo({ codigo: resultado.codigo, expiraEm });
    setSegundosRestantes(Math.round((expiraEm.getTime() - Date.now()) / 1000));
  };

  const handleDesconectar = async () => {
    const vinculo = paraDesconectar;
    setParaDesconectar(null);
    if (!vinculo) return;
    const { error } = await supabase.from("telegram_vinculos" as any).delete().eq("telegram_id", vinculo.telegram_id);
    if (error) {
      toast({ title: "Erro ao desconectar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Telegram desconectado", description: "Esse Telegram não consegue mais lançar na sua conta." });
    carregar();
  };

  const link = codigo ? `https://t.me/${BOT_USERNAME}?start=${codigo.codigo}` : "";
  const minutos = Math.floor(segundosRestantes / 60);
  const segundos = String(segundosRestantes % 60).padStart(2, "0");

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-primary/10 rounded-full">
            <Send className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Assistente no Telegram</h3>
            <p className="text-sm text-muted-foreground">
              {disponivel
                ? "Lance despesas por mensagem ou áudio no @" + BOT_USERNAME
                : "Ainda não ativado no banco de dados"}
            </p>
          </div>
        </div>
        {disponivel && !codigo && (
          <Button variant="outline" onClick={handleGerarCodigo} disabled={gerando}>
            {vinculos.length > 0 ? "Conectar outro" : "Conectar"}
          </Button>
        )}
      </div>

      {codigo && (
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3 text-sm">
          <p>
            1. Toque no botão abaixo para abrir o bot no Telegram.<br />
            2. Toque em <strong>Iniciar</strong> (ou envie a mensagem que já vem pronta).
          </p>
          <Button asChild className="w-full">
            <a href={link} target="_blank" rel="noopener noreferrer">
              <Send className="h-4 w-4 mr-2" /> Abrir @{BOT_USERNAME}
            </a>
          </Button>
          <div className="flex items-center justify-between gap-2 text-muted-foreground">
            <span>
              Ou envie para o bot: <code className="font-mono text-foreground">/start {codigo.codigo}</code>
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              title="Copiar"
              onClick={() => navigator.clipboard?.writeText(`/start ${codigo.codigo}`)}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Código válido por {minutos}:{segundos} · aguardando conexão…</span>
            <Button size="sm" variant="ghost" onClick={() => setCodigo(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      {vinculos.length > 0 && (
        <div className="space-y-2">
          {vinculos.map((v) => (
            <div key={v.telegram_id} className="flex items-center justify-between text-sm border-t pt-2">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {v.nome_telegram || "Telegram"} · conectado em {new Date(v.created_at).toLocaleDateString("pt-BR")}
              </span>
              <Button size="sm" variant="ghost" className="hover:text-destructive" onClick={() => setParaDesconectar(v)}>
                <Unlink className="h-4 w-4 mr-1" /> Desconectar
              </Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!paraDesconectar} onOpenChange={(aberto) => { if (!aberto) setParaDesconectar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar o Telegram?</AlertDialogTitle>
            <AlertDialogDescription>
              O bot deixa de responder para {paraDesconectar?.nome_telegram || "esse Telegram"}. Seus lançamentos continuam salvos, e dá para conectar de novo quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDesconectar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
