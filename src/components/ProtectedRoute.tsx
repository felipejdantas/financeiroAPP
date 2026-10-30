import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Situação do acesso pago (fin_meu_acesso, migration 20261030210000_assinaturas_contas.sql).
// O bloqueio de verdade é no banco (RLS); aqui é só pra mostrar a tela certa.
interface MeuAcesso {
  ativo: boolean;
  master: boolean;
  ativo_ate: string | null;
  bloqueado: boolean;
}

const DIAS_AVISO = 5;

const AcessoBloqueado = ({ acesso }: { acesso: MeuAcesso }) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <div className="mx-auto p-3 bg-destructive/10 rounded-full w-fit">
          <Lock className="h-6 w-6 text-destructive" />
        </div>
        <CardTitle className="text-xl">
          {acesso.bloqueado ? "Acesso suspenso" : "Seu acesso venceu"}
        </CardTitle>
        <CardDescription>
          {acesso.bloqueado
            ? "Sua conta está suspensa no momento."
            : acesso.ativo_ate
              ? `O período pago terminou em ${format(new Date(acesso.ativo_ate), "dd/MM/yyyy")}.`
              : "Sua conta ainda não foi liberada."}
          {" "}Seus dados continuam guardados e voltam assim que o pagamento for registrado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Fale com a Dantas Info para renovar.</p>
        <Button variant="outline" className="w-full" onClick={() => supabase.auth.signOut()}>
          Sair
        </Button>
      </CardContent>
    </Card>
  </div>
);

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [acesso, setAcesso] = useState<MeuAcesso | null>(null);
  const [acessoCarregado, setAcessoCarregado] = useState(false);
  const avisou = useRef(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    setAcessoCarregado(false);
    supabase.rpc("fin_meu_acesso" as any).then(({ data, error }) => {
      if (!vivo) return;
      // Função ainda não criada no banco: segue sem controle de acesso (comportamento antigo)
      setAcesso(error ? null : (data as unknown as MeuAcesso));
      setAcessoCarregado(true);
    });
    return () => { vivo = false; };
  }, [userId]);

  useEffect(() => {
    if (!acesso?.ativo || acesso.master || !acesso.ativo_ate || avisou.current) return;
    const dias = Math.ceil((new Date(acesso.ativo_ate).getTime() - Date.now()) / 86400000);
    if (dias <= DIAS_AVISO) {
      avisou.current = true;
      toast({
        title: dias <= 1 ? "Seu acesso vence hoje" : `Seu acesso vence em ${dias} dias`,
        description: `Vencimento: ${format(new Date(acesso.ativo_ate), "dd/MM/yyyy")}. Fale com a Dantas Info para renovar.`,
      });
    }
  }, [acesso, toast]);

  if (loading || (session && !acessoCarregado)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (acesso && !acesso.ativo) {
    return <AcessoBloqueado acesso={acesso} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
