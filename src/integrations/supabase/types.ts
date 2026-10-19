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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      brands: {
        Row: {
          active: boolean
          category: string
          created_at: string
          hue: number
          id: string
          name: string
          slug: string
          sort_order: number
          tagline: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          hue?: number
          id?: string
          name: string
          slug: string
          sort_order?: number
          tagline?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          hue?: number
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          tagline?: string
        }
        Relationships: []
      }
      denominations: {
        Row: {
          active: boolean
          amount: number
          brand_id: string
          id: string
        }
        Insert: {
          active?: boolean
          amount: number
          brand_id: string
          id?: string
        }
        Update: {
          active?: boolean
          amount?: number
          brand_id?: string
          id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          comments: string | null
          created_at: string
          id: string
          rating: number
          user_id: string | null
        }
        Insert: {
          comments?: string | null
          created_at?: string
          id?: string
          rating: number
          user_id?: string | null
        }
        Update: {
          comments?: string | null
          created_at?: string
          id?: string
          rating?: number
          user_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      gift_card_inventory: {
        Row: {
          brand: string
          code_ciphertext: string
          code_hash: string
          created_at: string
          denomination: number
          id: string
          is_test: boolean
          order_id: string | null
          reserved_by: string | null
          reserved_until: string | null
          sold_at: string | null
          source: string | null
          status: Database["public"]["Enums"]["inventory_status"]
        }
        Insert: {
          brand: string
          code_ciphertext: string
          code_hash: string
          created_at?: string
          denomination: number
          id?: string
          is_test?: boolean
          order_id?: string | null
          reserved_by?: string | null
          reserved_until?: string | null
          sold_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
        }
        Update: {
          brand?: string
          code_ciphertext?: string
          code_hash?: string
          created_at?: string
          denomination?: number
          id?: string
          is_test?: boolean
          order_id?: string | null
          reserved_by?: string | null
          reserved_until?: string | null
          sold_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
        }
        Relationships: []
      }
      orders: {
        Row: {
          admin_note: string | null
          amount: number
          brand: string
          created_at: string
          id: string
          inventory_id: string | null
          order_number: string
          paid_at: string | null
          provider: string
          provider_order_id: string | null
          provider_payment_id: string | null
          status: string
          test_mode: boolean
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          brand: string
          created_at?: string
          id?: string
          inventory_id?: string | null
          order_number?: string
          paid_at?: string | null
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status?: string
          test_mode?: boolean
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          brand?: string
          created_at?: string
          id?: string
          inventory_id?: string | null
          order_number?: string
          paid_at?: string | null
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status?: string
          test_mode?: boolean
          user_id?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tributes: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          order_number: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: string
          order_number: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          order_number?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      finalize_paid_order: {
        Args: { p_order_id: string; p_provider_payment_id: string }
        Returns: undefined
      }
      reserve_inventory: {
        Args: { p_brand: string; p_denom: number; p_minutes?: number; p_test: boolean; p_user: string }
        Returns: string
      }
      stock_summary: {
        Args: never
        Returns: {
          available: number
          brand: string
          denomination: number
          is_test: boolean
          reserved: number
          sold: number
        }[]
      }
      admin_fulfill_order: { Args: { p_order_id: string }; Returns: undefined }
      admin_orders: {
        Args: { p_limit?: number }
        Returns: {
          admin_note: string | null
          amount: number
          brand: string
          created_at: string
          email: string | null
          id: string
          order_number: string
          paid_at: string | null
          provider_order_id: string | null
          provider_payment_id: string | null
          status: string
          test_mode: boolean
        }[]
      }
      grant_admin: { Args: { p_email: string }; Returns: undefined }
      revoke_admin: { Args: { p_email: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      inventory_status: "available" | "reserved" | "sold"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      inventory_status: ["available", "reserved", "sold"],
    },
  },
} as const
