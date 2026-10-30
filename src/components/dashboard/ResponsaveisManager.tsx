import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertCircle, Check, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useResponsaveis } from "@/hooks/use-responsaveis";
import { Responsavel } from "@/utils/responsaveis";

interface ResponsaveisManagerProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TABELAS_LANCAMENTOS = ["Financeiro Cartão", "Financeiro Debito", "Financeiro Receita"] as const;

export const ResponsaveisManager = ({ userId, open, onOpenChange }: ResponsaveisManagerProps) => {
  const { toast } = useToast();
  const { responsaveis, legado, carregado, recarregar } = useResponsaveis(userId);
  const [salvando, setSalvando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoNoDashboard, setNovoNoDashboard] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [paraExcluir, setParaExcluir] = useState<Responsavel | null>(null);

  const nomeEmUso = (nome: string, ignorarId?: string) =>
    responsaveis.some((r) => r.id !== ignorarId && r.nome.toLowerCase() === nome.trim().toLowerCase());

  const executar = async (acao: () => Promise<void>, sucesso?: { title: string; description?: string }) => {
    setSalvando(true);
    try {
      await acao();
      if (sucesso) toast(sucesso);
    } catch (error: any) {
      toast({ title: "Erro ao salvar responsável", description: error.message, variant: "destructive" });
    } finally {
      await recarregar();
      setSalvando(false);
    }
  };

  const handleAdicionar = () => {
    const nome = novoNome.trim();
    if (!nome) return;
    if (nomeEmUso(nome)) {
      toast({ title: "Já existe um responsável com esse nome", variant: "destructive" });
      return;
    }
    executar(async () => {
      const { error } = await supabase.from("responsaveis" as any).insert({
        user_id: userId,
        nome,
        mostrar_no_dashboard: novoNoDashboard,
        ordem: responsaveis.length ? Math.max(...responsaveis.map((r) => r.ordem)) + 1 : 0,
      });
      if (error) throw error;
      setNovoNome("");
      setNovoNoDashboard(true);
    }, { title: `${nome} adicionado!` });
  };

  const handleSalvarEdicao = (responsavel: Responsavel) => {
    const nome = nomeEdicao.trim();
    if (!nome) return;
    if (nomeEmUso(nome, responsavel.id)) {
      toast({ title: "Já existe um responsável com esse nome", variant: "destructive" });
      return;
    }
    if (nome === responsavel.nome) {
      setEditandoId(null);
      return;
    }
    executar(async () => {
      // Renomear propaga o nome novo pros lançamentos via trigger no banco
      const { error } = await supabase.from("responsaveis" as any).update({ nome }).eq("id", responsavel.id);
      if (error) throw error;
      setEditandoId(null);
    }, { title: "Responsável renomeado!", description: `Os lançamentos de ${responsavel.nome} agora aparecem como ${nome}. Se você lança pelo Telegram, use o nome novo.` });
  };

  const handleAlternar = (responsavel: Responsavel, campo: "mostrar_no_dashboard" | "ativo", valor: boolean) => {
    const mensagens = campo === "mostrar_no_dashboard"
      ? { title: valor ? `${responsavel.nome} voltou para o dashboard` : `${responsavel.nome} não aparece mais no dashboard`, description: valor ? undefined : "Os lançamentos continuam entrando nos totais gerais." }
      : { title: valor ? `${responsavel.nome} reativado` : `${responsavel.nome} desativado`, description: valor ? undefined : "Some da lista ao lançar; o histórico continua salvo." };
    executar(async () => {
      const { error } = await supabase.from("responsaveis" as any).update({ [campo]: valor }).eq("id", responsavel.id);
      if (error) throw error;
    }, mensagens);
  };

  const handlePedirExclusao = async (responsavel: Responsavel) => {
    const contagens = await Promise.all(
      TABELAS_LANCAMENTOS.map((tabela) =>
        supabase.from(tabela as any).select("id", { count: "exact", head: true }).eq("user_id", userId).eq("Responsavel", responsavel.nome)
      )
    );
    const falha = contagens.find((c) => c.error);
    if (falha?.error) {
      toast({ title: "Erro ao verificar lançamentos", description: falha.error.message, variant: "destructive" });
      return;
    }
    const total = contagens.reduce((soma, c) => soma + (c.count || 0), 0);
    if (total > 0) {
      toast({
        title: "Esse responsável tem lançamentos",
        description: `${responsavel.nome} tem ${total} lançamento(s) e não pode ser excluído. Desative-o ou tire do dashboard para escondê-lo sem perder o histórico.`,
        variant: "destructive",
      });
      return;
    }
    setParaExcluir(responsavel);
  };

  const handleExcluir = () => {
    const responsavel = paraExcluir;
    setParaExcluir(null);
    if (!responsavel) return;
    executar(async () => {
      const { error } = await supabase.from("responsaveis" as any).delete().eq("id", responsavel.id);
      if (error) throw error;
    }, { title: `${responsavel.nome} excluído` });
  };

  const bloqueado = legado || salvando;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Responsáveis
            </SheetTitle>
            <SheetDescription>
              Cadastre quem faz os lançamentos e escolha quem ganha card próprio no dashboard.
            </SheetDescription>
          </SheetHeader>

          {legado && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                O cadastro de responsáveis ainda não foi ativado no banco de dados. Por enquanto o app continua usando os nomes dos lançamentos.
              </AlertDescription>
            </Alert>
          )}

          <div className="mt-6 space-y-2">
            {carregado && !legado && responsaveis.length === 0 && (
              <p className="text-sm text-muted-foreground p-4 border rounded-lg text-center">
                Nenhum responsável cadastrado ainda. Adicione o primeiro abaixo.
              </p>
            )}

            {responsaveis.map((responsavel) => (
              <div key={responsavel.id} className={`p-3 border rounded-lg space-y-3 ${responsavel.ativo ? "" : "opacity-60"}`}>
                {editandoId === responsavel.id ? (
                  <div className="space-y-3">
                    <Input
                      value={nomeEdicao}
                      onChange={(e) => setNomeEdicao(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSalvarEdicao(responsavel); }}
                      maxLength={40}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)} disabled={salvando}>
                        <X className="h-4 w-4 mr-1" /> Cancelar
                      </Button>
                      <Button size="sm" onClick={() => handleSalvarEdicao(responsavel)} disabled={salvando || !nomeEdicao.trim()}>
                        <Check className="h-4 w-4 mr-1" /> Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{responsavel.nome}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {!responsavel.mostrar_no_dashboard && <Badge variant="outline" className="text-[10px]">Fora do dashboard</Badge>}
                        {!responsavel.ativo && <Badge variant="outline" className="text-[10px]">Desativado</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Editar"
                        onClick={() => { setEditandoId(responsavel.id); setNomeEdicao(responsavel.nome); }}
                        disabled={bloqueado}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-destructive" title="Excluir" onClick={() => handlePedirExclusao(responsavel)} disabled={bloqueado}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {editandoId !== responsavel.id && (
                  <div className="space-y-2 text-sm text-muted-foreground border-t pt-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`dashboard-${responsavel.id}`} className="font-normal cursor-pointer">Mostrar no dashboard</Label>
                      <Switch
                        id={`dashboard-${responsavel.id}`}
                        checked={responsavel.mostrar_no_dashboard}
                        onCheckedChange={(checked) => handleAlternar(responsavel, "mostrar_no_dashboard", checked)}
                        disabled={bloqueado}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`ativo-${responsavel.id}`} className="font-normal cursor-pointer">Ativo</Label>
                      <Switch
                        id={`ativo-${responsavel.id}`}
                        checked={responsavel.ativo}
                        onCheckedChange={(checked) => handleAlternar(responsavel, "ativo", checked)}
                        disabled={bloqueado}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 border rounded-lg space-y-3 bg-secondary/30">
            <Label htmlFor="novo-responsavel" className="font-medium">Adicionar responsável</Label>
            <Input
              id="novo-responsavel"
              placeholder="Ex: Maria, Empresa, Casa"
              value={novoNome}
              maxLength={40}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdicionar(); }}
              disabled={bloqueado}
            />
            <div className="flex items-center justify-between text-sm">
              <Label htmlFor="novo-no-dashboard" className="font-normal cursor-pointer">Mostrar no dashboard</Label>
              <Switch id="novo-no-dashboard" checked={novoNoDashboard} onCheckedChange={setNovoNoDashboard} disabled={bloqueado} />
            </div>
            <Button className="w-full" onClick={handleAdicionar} disabled={bloqueado || !novoNome.trim()}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            <strong>Mostrar no dashboard</strong> controla só os cards por responsável: quem está fora continua somando nos totais gerais, nos filtros e nos relatórios.
            <strong> Desativado</strong> some da lista ao lançar uma despesa ou receita. Responsável com lançamentos não pode ser excluído.
            Nome novo lançado pelo Telegram entra aqui sozinho, fora do dashboard.
          </p>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!paraExcluir} onOpenChange={(aberto) => { if (!aberto) setParaExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {paraExcluir?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esse responsável não tem lançamentos e será removido do cadastro.
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
