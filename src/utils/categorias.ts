// Helper function to fetch categorias from Supabase
export const fetchCategoriasFromSupabase = async (supabase: any, userId: string): Promise<string[]> => {
    try {
        const { data, error } = await (supabase
            .from("categorias" as any)
            .select("nome")
            .eq("user_id", userId)
            .order("nome")) as any;

        if (error) {
            console.error("Erro ao carregar categorias:", error);
            return [];
        }

        return data?.map((c: any) => c.nome) || [];
    } catch (error) {
        console.error("Erro ao carregar categorias:", error);
        return [];
    }
};
