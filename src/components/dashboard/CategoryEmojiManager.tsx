import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Smile, Trash2 } from "lucide-react";

interface CategoryEmojiManagerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
    categorias: string[];
    onUpdate: () => void;
}

interface CategoryEmoji {
    id: number;
    categoria: string;
    emoji: string;
}

// Lista de emojis comuns para seleção rápida
const COMMON_EMOJIS = [
    "🏠", "🚗", "🍔", "🛒", "💡", "📱", "👕", "🏥", "✈️", "🎓",
    "🎮", "🎬", "📚", "💰", "💳", "🎁", "🔧", "🏋️", "🐕", "🌳",
    "☕", "🍕", "🚌", "⛽", "💊", "🎵", "🖥️", "🏦", "🍷", "🎨"
];

export function CategoryEmojiManager({ open, onOpenChange, userId, categorias, onUpdate }: CategoryEmojiManagerProps) {
    const [categoryEmojis, setCategoryEmojis] = useState<CategoryEmoji[]>([]);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedEmoji, setSelectedEmoji] = useState("");
    const [customEmoji, setCustomEmoji] = useState("");
    const { toast } = useToast();

    useEffect(() => {
        if (open && userId) {
            loadCategoryEmojis();
        }
    }, [open, userId]);

    const loadCategoryEmojis = async () => {
        try {
            const { data, error } = await (supabase as any)
                .from("categoria_emojis")
                .select("*")
                .eq("user_id", userId);

            if (error) throw error;
            setCategoryEmojis(data || []);
        } catch (error: any) {
            console.error("Erro ao carregar emojis:", error);
            toast({
                title: "Erro ao carregar emojis",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleSave = async () => {
        if (!selectedCategory) {
            toast({
                title: "Selecione uma categoria",
                variant: "destructive",
            });
            return;
        }

        const emojiToSave = customEmoji || selectedEmoji;
        if (!emojiToSave) {
            toast({
                title: "Selecione ou digite um emoji",
                variant: "destructive",
            });
            return;
        }

        try {
            const existing = categoryEmojis.find(ce => ce.categoria === selectedCategory);

            if (existing) {
                // Update
                const { error } = await (supabase as any)
                    .from("categoria_emojis")
                    .update({ emoji: emojiToSave, updated_at: new Date().toISOString() })
                    .eq("id", existing.id);

                if (error) throw error;
            } else {
                // Insert
                const { error } = await (supabase as any)
                    .from("categoria_emojis")
                    .insert([{
                        user_id: userId,
                        categoria: selectedCategory,
                        emoji: emojiToSave,
                    }]);

                if (error) throw error;
            }

            toast({
                title: "Emoji salvo com sucesso!",
            });

            setSelectedCategory("");
            setSelectedEmoji("");
            setCustomEmoji("");
            loadCategoryEmojis();
            onUpdate();
        } catch (error: any) {
            console.error("Erro ao salvar emoji:", error);
            toast({
                title: "Erro ao salvar emoji",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleDelete = async (id: number) => {
        try {
            const { error } = await (supabase as any)
                .from("categoria_emojis")
                .delete()
                .eq("id", id);

            if (error) throw error;

            toast({
                title: "Emoji removido com sucesso!",
            });

            loadCategoryEmojis();
            onUpdate();
        } catch (error: any) {
            console.error("Erro ao remover emoji:", error);
            toast({
                title: "Erro ao remover emoji",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Gerenciar Emojis das Categorias</DialogTitle>
                    <DialogDescription>
                        Adicione emojis personalizados para suas categorias de despesas
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Form para adicionar/editar */}
                    <div className="space-y-4 border rounded-lg p-4">
                        <div>
                            <Label htmlFor="categoria">Categoria</Label>
                            <select
                                id="categoria"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full mt-1 p-2 border rounded-md bg-background"
                            >
                                <option value="">Selecione uma categoria</option>
                                {categorias.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <Label>Selecione um Emoji</Label>
                            <div className="grid grid-cols-10 gap-2 mt-2">
                                {COMMON_EMOJIS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => {
                                            setSelectedEmoji(emoji);
                                            setCustomEmoji("");
                                        }}
                                        className={`text-2xl p-2 rounded hover:bg-accent transition-colors ${selectedEmoji === emoji ? "bg-accent ring-2 ring-primary" : ""
                                            }`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="customEmoji">Ou digite um emoji personalizado</Label>
                            <Input
                                id="customEmoji"
                                value={customEmoji}
                                onChange={(e) => {
                                    setCustomEmoji(e.target.value);
                                    setSelectedEmoji("");
                                }}
                                placeholder="Digite um emoji..."
                                className="text-2xl text-center"
                                maxLength={2}
                            />
                        </div>

                        <Button onClick={handleSave} className="w-full">
                            <Smile className="mr-2 h-4 w-4" />
                            Salvar Emoji
                        </Button>
                    </div>

                    {/* Lista de emojis configurados */}
                    <div>
                        <h3 className="font-semibold mb-3">Emojis Configurados</h3>
                        {categoryEmojis.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                Nenhum emoji configurado ainda
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {categoryEmojis.map((ce) => (
                                    <div
                                        key={ce.id}
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{ce.emoji}</span>
                                            <span className="font-medium">{ce.categoria}</span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(ce.id)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
