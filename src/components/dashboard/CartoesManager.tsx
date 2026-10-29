import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowDown, ArrowUp, Check, CreditCard, Pencil, Plus, Star, Trash2, X, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCartoes } from "@/hooks/use-cartoes";
import { Cartao, CORES_CARTAO } from "@/utils/cartoes";

interface CartoesManagerProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SeletorCor = ({ valor, onChange }: { valor: string; onChange: (cor: string) => void }) => (
  <div className="flex flex-wrap gap-2">
    {CORES_CARTAO.map((cor) => (
      <button
        key={cor.valor}
        type="button"
        title={cor.nome}
        onClick={() => onChange(cor.valor)}
        className={`h-7 w-7 rounded-full border-2 transition-transform ${valor === cor.valor ? "border-foreground scale-110" : "border-transparent"}`}
        style={{ backgroundColor: cor.valor }}
      />
    ))}
  </div>
);

export const CartoesManager = ({ userId, open, onOpenChange }: CartoesManagerProps) => {
  const { toast } = useToast();
  const { cartoes, legado, carregado, recarregar } = useCartoes(userId);
  const [salvando, setSalvando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState(CORES_CARTAO[4].valor);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [corEdicao, setCorEdicao] = useState("");
  const [cartaoParaExcluir, setCartaoParaExcluir] = useState<Cartao | null>(null);

  const nomeEmUso = (nome: string, ignorarId?: string) =>
    cartoes.some((c) => c.id !== ignorarId && c.nome.toLowerCase() === nome.trim().toLowerCase());

  const executar = async (acao: () => Promise<void>, sucesso?: { title: string; description?: string }) => {
    setSalvando(true);
    try {
      await acao();
      if (sucesso) toast(sucesso);
    } catch (error: any) {
      toast({ title: "Erro ao salvar cartão", description: error.message, variant: "destructive" });
    } finally {
      await recarregar();
      setSalvando(false);
    }
  };

  const handleAdicionar = () => {
    const nome = novoNome.trim();
    if (!nome) return;
    if (nomeEmUso(nome)) {
      toast({ title: "Já existe um cartão com esse nome", variant: "destructive" });
      return;
    }
    executar(async () => {
      const { error } = await supabase.from("cartoes" as any).insert({
        user_id: userId,
        nome,
        cor: novaCor,
        ordem: cartoes.length ? Math.max(...cartoes.map((c) => c.ordem)) + 1 : 0,
        // O primeiro cartão cadastrado já vira o principal
        principal: !cartoes.some((c) => c.principal),
      });
      if (error) throw error;
      setNovoNome("");
    }, { title: `Cartão ${nome} adicionado!` });
  };

  const iniciarEdicao = (cartao: Cartao) => {
    setEditandoId(cartao.id);
    setNomeEdicao(cartao.nome);
    setCorEdicao(cartao.cor);
  };

  const handleSalvarEdicao = (cartao: Cartao) => {
    const nome = nomeEdicao.trim();
    if (!nome) return;
    if (nomeEmUso(nome, cartao.id)) {
      toast({ title: "Já existe um cartão com esse nome", variant: "destructive" });
      return;
    }
    const renomeou = nome !== cartao.nome;
    executar(async () => {
      // Renomear propaga o nome novo pros lançamentos e períodos via trigger no banco
      const { error } = await supabase.from("cartoes" as any).update({ nome, cor: corEdicao }).eq("id", cartao.id);
      if (error) throw error;
      setEditandoId(null);
    }, renomeou
      ? { title: "Cartão renomeado!", description: `Os lançamentos de ${cartao.nome} agora aparecem como ${nome}. Se você lança pelo Telegram, use o nome novo.` }
      : { title: "Cartão atualizado!" });
  };

  const handleMover = (indice: number, direcao: -1 | 1) => {
    const atual = cartoes[indice];
    const vizinho = cartoes[indice + direcao];
    if (!atual || !vizinho) return;
    executar(async () => {
      // Renumera tudo pela posição nova, pra não depender de valores de ordem repetidos
      const nova = [...cartoes];
      nova[indice] = vizinho;
      nova[indice + direcao] = atual;
      const resultados = await Promise.all(
        nova.map((c, i) => supabase.from("cartoes" as any).update({ ordem: i }).eq("id", c.id))
      );
      const falha = resultados.find((r) => r.error);
      if (falha?.error) throw falha.error;
    });
  };

  const tornarPrincipal = async (cartao: Cartao) => {
    // Desmarca o atual antes (índice único: só um principal por usuário)
    const { error: erroDesmarcar } = await supabase.from("cartoes" as any).update({ principal: false }).eq("user_id", userId).eq("principal", true);
    if (erroDesmarcar) throw erroDesmarcar;
    const { error } = await supabase.from("cartoes" as any).update({ principal: true, ativo: true }).eq("id", cartao.id);
    if (error) throw error;
  };

  const handleTornarPrincipal = (cartao: Cartao) => {
    executar(() => tornarPrincipal(cartao), { title: `${cartao.nome} agora é o cartão principal` });
  };

  const handleAlternarAtivo = (cartao: Cartao, ativo: boolean) => {
    executar(async () => {
      if (!ativo && cartao.principal) {
        // Desativar o principal passa o posto pro próximo cartão ativo
        const proximo = cartoes.find((c) => c.id !== cartao.id && c.ativo);
        if (proximo) await tornarPrincipal(proximo);
      }
      const { error } = await supabase.from("cartoes" as any).update({ ativo }).eq("id", cartao.id);
      if (error) throw error;
    }, { title: ativo ? `${cartao.nome} reativado` : `${cartao.nome} desativado`, description: ativo ? undefined : "Os lançamentos antigos continuam salvos." });
  };

  const handlePedirExclusao = async (cartao: Cartao) => {
    const { count, error } = await supabase
      .from("Financeiro Cartão")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("banco_cartao", cartao.nome);
    if (error) {
      toast({ title: "Erro ao verificar lançamentos", description: error.message, variant: "destructive" });
      return;
    }
    if ((count || 0) > 0) {
      toast({
        title: "Esse cartão tem lançamentos",
        description: `${cartao.nome} tem ${count} lançamento(s) e não pode ser excluído. Desative-o para escondê-lo sem perder o histórico.`,
        variant: "destructive",
      });
      return;
    }
    setCartaoParaExcluir(cartao);
  };

  const handleExcluir = () => {
    const cartao = cartaoParaExcluir;
    setCartaoParaExcluir(null);
    if (!cartao) return;
    executar(async () => {
      if (cartao.principal) {
        const proximo = cartoes.find((c) => c.id !== cartao.id && c.ativo);
        if (proximo) await tornarPrincipal(proximo);
      }
      const { error } = await supabase.from("cartoes" as any).delete().eq("id", cartao.id);
      if (error) throw error;
    }, { title: `Cartão ${cartao.nome} excluído` });
  };

  const bloqueado = legado || salvando;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Meus Cartões
            </SheetTitle>
            <SheetDescription>
              Cadastre os cartões de crédito que você usa. Cada um ganha seu card no dashboard e seu próprio período de fatura.
            </SheetDescription>
          </SheetHeader>

          {legado && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                O cadastro de cartões ainda não foi ativado no banco de dados. Por enquanto o app continua com Santander e Inter.
              </AlertDescription>
            </Alert>
          )}

          <div className="mt-6 space-y-2">
            {carregado && cartoes.length === 0 && (
              <p className="text-sm text-muted-foreground p-4 border rounded-lg text-center">
                Nenhum cartão cadastrado ainda. Adicione o primeiro abaixo.
              </p>
            )}

            {cartoes.map((cartao, indice) => (
              <div key={cartao.id} className={`p-3 border rounded-lg space-y-3 ${cartao.ativo ? "" : "opacity-60"}`}>
                {editandoId === cartao.id ? (
                  <div className="space-y-3">
                    <Input value={nomeEdicao} onChange={(e) => setNomeEdicao(e.target.value)} maxLength={40} autoFocus />
                    <SeletorCor valor={corEdicao} onChange={setCorEdicao} />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)} disabled={salvando}>
                        <X className="h-4 w-4 mr-1" /> Cancelar
                      </Button>
                      <Button size="sm" onClick={() => handleSalvarEdicao(cartao)} disabled={salvando || !nomeEdicao.trim()}>
                        <Check className="h-4 w-4 mr-1" /> Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: cartao.cor }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{cartao.nome}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {cartao.principal && <Badge variant="secondary" className="text-[10px]">Principal</Badge>}
                        {indice === cartoes.findIndex((c) => c.ativo) && cartao.ativo && (
                          <Badge variant="outline" className="text-[10px]">Referência do mês</Badge>
                        )}
                        {!cartao.ativo && <Badge variant="outline" className="text-[10px]">Desativado</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Subir" onClick={() => handleMover(indice, -1)} disabled={bloqueado || indice === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Descer" onClick={() => handleMover(indice, 1)} disabled={bloqueado || indice === cartoes.length - 1}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Tornar principal" onClick={() => handleTornarPrincipal(cartao)} disabled={bloqueado || cartao.principal}>
                        <Star className={`h-4 w-4 ${cartao.principal ? "fill-yellow-400 text-yellow-500" : ""}`} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar" onClick={() => iniciarEdicao(cartao)} disabled={bloqueado}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-destructive" title="Excluir" onClick={() => handlePedirExclusao(cartao)} disabled={bloqueado}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {editandoId !== cartao.id && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-2">
                    <Label htmlFor={`ativo-${cartao.id}`} className="font-normal cursor-pointer">Ativo</Label>
                    <Switch
                      id={`ativo-${cartao.id}`}
                      checked={cartao.ativo}
                      onCheckedChange={(checked) => handleAlternarAtivo(cartao, checked)}
                      disabled={bloqueado}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 border rounded-lg space-y-3 bg-secondary/30">
            <Label htmlFor="novo-cartao" className="font-medium">Adicionar cartão</Label>
            <Input
              id="novo-cartao"
              placeholder="Ex: Nubank, Itaú, Cartão da empresa"
              value={novoNome}
              maxLength={40}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdicionar(); }}
              disabled={bloqueado}
            />
            <SeletorCor valor={novaCor} onChange={setNovaCor} />
            <Button className="w-full" onClick={handleAdicionar} disabled={bloqueado || !novoNome.trim()}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            <Star className="inline h-3 w-3 mb-0.5" /> O cartão <strong>principal</strong> vem selecionado ao lançar uma despesa.
            O primeiro cartão ativo da lista é a <strong>referência do mês</strong>: o período de fatura dele define qual mês o dashboard mostra.
            Cartão com lançamentos não pode ser excluído, só desativado.
          </p>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!cartaoParaExcluir} onOpenChange={(aberto) => { if (!aberto) setCartaoParaExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cartão {cartaoParaExcluir?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              O cartão não tem lançamentos. Os períodos de fatura configurados para ele também serão apagados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
