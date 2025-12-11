
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";
import { Receita } from "./RevenueTable";

const receitaSchema = z.object({
    Responsavel: z.string().min(1, "Responsável é obrigatório"),
    Data: z.string().min(1, "Data é obrigatória"),
    Descrição: z.string().min(1, "Descrição é obrigatória").max(200, "Descrição muito longa"),
    valor: z.number().positive("Valor deve ser positivo"),
    Categoria: z.string().min(1, "Categoria é obrigatória").max(100, "Categoria muito longa"),
    created_at: z.string().optional(),
});

type RevenueFormValues = z.infer<typeof receitaSchema>;

interface RevenueFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: RevenueFormValues) => Promise<void>;
    receita?: Receita | null;
    categorias: string[];
    responsaveis: string[];
    defaultResponsavel?: string;
}

export const RevenueForm = ({ open, onOpenChange, onSubmit, receita, categorias, responsaveis, defaultResponsavel }: RevenueFormProps) => {
    const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
    const [newCategory, setNewCategory] = useState("");
    const [showNewResponsavelInput, setShowNewResponsavelInput] = useState(false);
    const [newResponsavel, setNewResponsavel] = useState("");

    const form = useForm<RevenueFormValues>({
        resolver: zodResolver(receitaSchema),
        defaultValues: {
            Responsavel: defaultResponsavel || "",
            Data: format(new Date(), "dd/MM/yyyy"),
            Descrição: "",
            valor: 0,
            Categoria: "",
            created_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        },
    });

    useEffect(() => {
        if (receita) {
            form.reset({
                Responsavel: receita.Responsavel,
                Data: receita.Data,
                Descrição: receita.Descrição,
                valor: receita.valor,
                Categoria: receita.Categoria,
                created_at: receita.created_at ? format(new Date(receita.created_at), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
            });
            setShowNewCategoryInput(false);
            setNewCategory("");
            setShowNewResponsavelInput(false);
            setNewResponsavel("");
        } else {
            form.reset({
                Responsavel: defaultResponsavel || "",
                Data: format(new Date(), "dd/MM/yyyy"),
                Descrição: "",
                valor: 0,
                Categoria: "",
                created_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
            });
            setShowNewCategoryInput(false);
            setNewCategory("");
            setShowNewResponsavelInput(false);
            setNewResponsavel("");
        }
    }, [receita, defaultResponsavel, form]);

    const handleSubmit = async (data: RevenueFormValues) => {
        await onSubmit(data);
        form.reset();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{receita ? "Editar Receita" : "Nova Receita"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">

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
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {[...responsaveis].sort().map((resp) => (
                                                <SelectItem key={resp} value={resp}>{resp}</SelectItem>
                                            ))}
                                            <SelectItem value="__novo__">+ Novo</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {showNewResponsavelInput && (
                                        <Input
                                            placeholder="Nome do novo responsável"
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
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {[...categorias].sort().map((cat) => (
                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                            ))}
                                            <SelectItem value="__nova__">+ Nova</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {showNewCategoryInput && (
                                        <Input
                                            placeholder="Nome da nova categoria"
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
                            name="Descrição"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descrição</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="Descrição da receita" />
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
                                {receita ? "Atualizar" : "Salvar"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
