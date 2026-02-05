import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Despesa } from "@/types/despesa";
import { format } from "date-fns";

const despesaSchema = z.object({
  Responsavel: z.string().min(1, "Responsável é obrigatório"),
  Tipo: z.enum(["Crédito", "Débito", "Pix", "Dinheiro"], { required_error: "Selecione um tipo" }),
  Data: z.string().min(1, "Data é obrigatória"),
  Descrição: z.string().min(1, "Descrição é obrigatória").max(200, "Descrição muito longa"),
  Parcelas: z.string().min(1, "Parcelas é obrigatório"),
  valor: z.number().positive("Valor deve ser positivo"),
  Categoria: z.string().min(1, "Categoria é obrigatória").max(100, "Categoria muito longa"),
  created_at: z.string().optional(),
});

type DespesaFormValues = z.infer<typeof despesaSchema>;

interface DespesaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DespesaFormValues) => Promise<void>;
  despesa?: Despesa | null;
  categorias: string[];
  responsaveis: string[];
  defaultResponsavel?: string;
}

export const DespesaForm = ({ open, onOpenChange, onSubmit, despesa, categorias, responsaveis, defaultResponsavel }: DespesaFormProps) => {
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [showNewResponsavelInput, setShowNewResponsavelInput] = useState(false);
  const [newResponsavel, setNewResponsavel] = useState("");

  const form = useForm<DespesaFormValues>({
    resolver: zodResolver(despesaSchema),
    defaultValues: {
      Responsavel: defaultResponsavel || "",
      Tipo: "Crédito",
      Data: format(new Date(), "dd/MM/yyyy"),
      Descrição: "",
      Parcelas: "A vista",
      valor: 0,
      Categoria: "",
      created_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    },
  });

  useEffect(() => {
    if (despesa) {
      form.reset({
        Responsavel: despesa.Responsavel,
        Tipo: (["Crédito", "Débito", "Pix", "Dinheiro"].find(t => t.toLowerCase() === (despesa.Tipo || "").toLowerCase().trim()) || "Crédito") as "Crédito" | "Débito" | "Pix" | "Dinheiro",
        Data: despesa.Data,
        Descrição: despesa.Descrição,
        Parcelas: despesa.Parcelas,
        valor: despesa.valor,
        Categoria: despesa.Categoria,
        created_at: despesa.created_at ? format(new Date(despesa.created_at), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      });
      setShowNewCategoryInput(false);
      setNewCategory("");
      setShowNewResponsavelInput(false);
      setNewResponsavel("");
    } else {
      form.reset({
        Responsavel: defaultResponsavel || "",
        Tipo: "Crédito",
        Data: format(new Date(), "dd/MM/yyyy"),
        Descrição: "",
        Parcelas: "A vista",
        valor: 0,
        Categoria: "",
        created_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      });
      setShowNewCategoryInput(false);
      setNewCategory("");
      setShowNewResponsavelInput(false);
      setNewResponsavel("");
    }
  }, [despesa, defaultResponsavel, form]);

  const handleSubmit = async (data: DespesaFormValues) => {
    await onSubmit(data);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="form-description">
        <DialogHeader>
          <DialogTitle>{despesa ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
        </DialogHeader>
        <p id="form-description" className="sr-only">
          Formulário para {despesa ? "editar uma despesa existente" : "adicionar uma nova despesa"}
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="Responsavel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        if (value === "__novo__") {
                          setShowNewResponsavelInput(true);
                          setNewResponsavel("");
                          field.onChange("");
                        } else {
                          setShowNewResponsavelInput(false);
                          field.onChange(value);
                        }
                      }}
                      value={showNewResponsavelInput ? "__novo__" : field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um responsável" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent side="bottom">
                        {[...responsaveis].sort((a, b) => a.localeCompare(b)).map((resp) => (
                          <SelectItem key={resp} value={resp}>
                            {resp}
                          </SelectItem>
                        ))}
                        <SelectItem value="__novo__">+ Novo Responsável</SelectItem>
                      </SelectContent>
                    </Select>
                    {showNewResponsavelInput && (
                      <Input
                        placeholder="Digite o nome do novo responsável"
                        value={newResponsavel}
                        onChange={(e) => {
                          setNewResponsavel(e.target.value);
                          field.onChange(e.target.value);
                        }}
                        className="mt-2"
                      />
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="Tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent side="bottom">
                        <SelectItem value="Crédito">Crédito</SelectItem>
                        <SelectItem value="Débito">Débito</SelectItem>
                        <SelectItem value="Pix">Pix</SelectItem>
                        <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="Data"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="DD/MM/YYYY" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="created_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Criação (Ordenação)</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        value={field.value || ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          field.onChange(isNaN(value) ? 0 : value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="Categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        if (value === "__nova__") {
                          setShowNewCategoryInput(true);
                          setNewCategory("");
                          field.onChange("");
                        } else {
                          setShowNewCategoryInput(false);
                          field.onChange(value);
                        }
                      }}
                      value={showNewCategoryInput ? "__nova__" : field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent side="bottom">
                        {[...categorias].sort((a, b) => a.localeCompare(b)).map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                        <SelectItem value="__nova__">+ Nova Categoria</SelectItem>
                      </SelectContent>
                    </Select>
                    {showNewCategoryInput && (
                      <Input
                        placeholder="Digite o nome da nova categoria"
                        value={newCategory}
                        onChange={(e) => {
                          setNewCategory(e.target.value);
                          field.onChange(e.target.value);
                        }}
                        className="mt-2"
                      />
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="Parcelas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parcelas</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: A vista, 5x, 12x" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="Descrição"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Descrição da despesa" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {despesa ? "Atualizar" : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
