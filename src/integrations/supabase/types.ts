export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      agendamento_pessoal: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      agente_pessoal: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      configuracoes_usuario: {
        Row: {
          criado_em: string | null
          id: string
          limite_mensal: number
          nome: string
          telegram_id: string
        }
        Insert: {
          criado_em?: string | null
          id?: string
          limite_mensal?: number
          nome: string
          telegram_id: string
        }
        Update: {
          criado_em?: string | null
          id?: string
          limite_mensal?: number
          nome?: string
          telegram_id?: string
        }
        Relationships: []
      }
      "Financeiro Cartão": {
        Row: {
          Categoria: string | null
          Data: string | null
          Descrição: string | null
          id: number
          Parcelas: string | null
          Responsavel: string
          Tipo: string | null
          user_id: string | null
          valor: number | null
        }
        Insert: {
          Categoria?: string | null
          Data?: string | null
          Descrição?: string | null
          id?: number
          Parcelas?: string | null
          Responsavel: string
          Tipo?: string | null
          user_id?: string | null
          valor?: number | null
        }
        Update: {
          Categoria?: string | null
          Data?: string | null
          Descrição?: string | null
          id?: number
          Parcelas?: string | null
          Responsavel?: string
          Tipo?: string | null
          user_id?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      "Financeiro Debito": {
        Row: {
          Categoria: string | null
          Data: string | null
          Descrição: string | null
          id: number
          Parcelas: string | null
          Responsavel: string
          Tipo: string | null
          user_id: string | null
          valor: number | null
        }
        Insert: {
          Categoria?: string | null
          Data?: string | null
          Descrição?: string | null
          id?: number
          Parcelas?: string | null
          Responsavel: string
          Tipo?: string | null
          user_id?: string | null
          valor?: number | null
        }
        Update: {
          Categoria?: string | null
          Data?: string | null
          Descrição?: string | null
          id?: number
          Parcelas?: string | null
          Responsavel?: string
          Tipo?: string | null
          user_id?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      financeiro_final: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      periodos_mensais_cartao: {
        Row: {
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          dia_fim: number
          dia_inicio: number
          id: number
          mes_inicio_offset: number
          mes_referencia: number
          nome_periodo: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          dia_fim: number
          dia_inicio: number
          id?: number
          mes_inicio_offset?: number
          mes_referencia: number
          nome_periodo?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          dia_fim?: number
          dia_inicio?: number
          id?: number
          mes_inicio_offset?: number
          mes_referencia?: number
          nome_periodo?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          data_fim_cartao: string | null
          data_inicio_cartao: string | null
          dia_fim_fatura: number | null
          dia_inicio_fatura: number | null
          id: string
          nome: string | null
        }
        Insert: {
          created_at?: string | null
          data_fim_cartao?: string | null
          data_inicio_cartao?: string | null
          dia_fim_fatura?: number | null
          dia_inicio_fatura?: number | null
          id: string
          nome?: string | null
        }
        Update: {
          created_at?: string | null
          data_fim_cartao?: string | null
          data_inicio_cartao?: string | null
          dia_fim_fatura?: number | null
          dia_inicio_fatura?: number | null
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
