import { useState } from "react";
import { addDays, format } from "date-fns";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, UserPlus, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NovaContaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriada: () => void;
}

const gerarSenha = () => {
  const caracteres = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(bytes, (b) => caracteres[b % caracteres.length]).join("");
};

// Mensagem de erro que a Edge Function devolve no corpo (o supabase-js só dá "non-2xx status code")
const mensagemDoErro = async (error: any): Promise<string> => {
  try {
    const corpo = await error?.context?.json();
    if (corpo?.error) return corpo.error;
  } catch {
    // corpo não era JSON
  }
  return error?.message || "Erro ao criar conta";
};

export const NovaContaSheet = ({ open, onOpenChange, onCriada }: NovaContaSheetProps) => {
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState(gerarSenha);
  const [dias, setDias] = useState("30");
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [criada, setCriada] = useState<{ email: string; senha: string; ativoAte: string | null } | null>(null);

  const diasNumero = Number(dias);
  const diasValidos = Number.isInteger(diasNumero) && diasNumero >= 1 && diasNumero <= 3660;

  const limpar = () => {
    setNome("");
    setEmail("");
    setSenha(gerarSenha());
    setDias("30");
    setValor("");
    setCriada(null);
  };

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    const { data, error } = await supabase.functions.invoke("fin-admin-criar-conta", {
      body: { nome, email, senha, dias: diasNumero, valor: valor.trim() === "" ? null : Number(valor.replace(",", ".")) },
    });
    setSalvando(false);

    if (error) {
      toast({ title: "Não foi possível criar a conta", description: await mensagemDoErro(error), variant: "destructive" });
      return;
    }
    if (data?.aviso) toast({ title: "Atenção", description: data.aviso, variant: "destructive" });
    setCriada({ email: email.trim().toLowerCase(), senha, ativoAte: data?.ativo_ate || null });
    onCriada();
  };

  const copiarDados = async () => {
    if (!criada) return;
    const texto = [
      "Seu acesso ao Fin DantasInfo:",
      `Link: ${window.location.origin}`,
      `E-mail: ${criada.email}`,
      `Senha: ${criada.senha}`,
      criada.ativoAte ? `Acesso liberado até ${format(new Date(criada.ativoAte), "dd/MM/yyyy")}` : "",
    ].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(texto);
    toast({ title: "Dados copiados", description: "Cole no WhatsApp do cliente." });
  };

  return (
    <Sheet open={open} onOpenChange={(aberto) => { onOpenChange(aberto); if (!aberto) limpar(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Nova conta
          </SheetTitle>
          <SheetDescription>
            A conta já nasce com o e-mail confirmado e com os dias de acesso escolhidos.
          </SheetDescription>
        </SheetHeader>

        {criada ? (
          <div className="mt-6 space-y-4">
            <div className="p-4 border rounded-lg space-y-1 text-sm bg-secondary/30">
              <p><span className="text-muted-foreground">E-mail:</span> {criada.email}</p>
              <p><span className="text-muted-foreground">Senha:</span> <span className="font-mono">{criada.senha}</span></p>
              {criada.ativoAte && (
                <p><span className="text-muted-foreground">Acesso até:</span> {format(new Date(criada.ativoAte), "dd/MM/yyyy")}</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">A senha não aparece de novo depois que você fechar este painel.</p>
            <Button className="w-full" onClick={copiarDados}>
              <Copy className="h-4 w-4 mr-2" /> Copiar dados para enviar ao cliente
            </Button>
            <Button variant="outline" className="w-full" onClick={limpar}>
              Criar outra conta
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCriar} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nova-nome">Nome</Label>
              <Input id="nova-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nova-email">E-mail</Label>
              <Input id="nova-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Senha inicial</Label>
              <div className="flex gap-2">
                <Input id="nova-senha" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={6} required className="font-mono" />
                <Button type="button" variant="outline" size="icon" title="Gerar outra" onClick={() => setSenha(gerarSenha())}>
                  <Wand2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="nova-dias">Dias de acesso</Label>
                <Input id="nova-dias" type="number" min={1} max={3660} value={dias} onChange={(e) => setDias(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nova-valor">Valor pago (opcional)</Label>
                <Input id="nova-valor" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
              </div>
            </div>
            {diasValidos && (
              <p className="text-sm text-muted-foreground">
                Acesso liberado até <strong className="text-foreground">{format(addDays(new Date(), diasNumero), "dd/MM/yyyy")}</strong>.
              </p>
            )}
            <Button type="submit" className="w-full" disabled={salvando || !diasValidos}>
              {salvando ? "Criando..." : "Criar conta"}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
};
