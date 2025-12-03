export interface Categoria {
    id: string;
    user_id: string;
    nome: string;
    cor?: string;
    icone?: string;
    created_at: string;
    updated_at: string;
}

export interface CategoriaInsert {
    user_id: string;
    nome: string;
    cor?: string;
    icone?: string;
}

export interface CategoriaUpdate {
    nome?: string;
    cor?: string;
    icone?: string;
}
