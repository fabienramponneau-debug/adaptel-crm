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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      actions: {
        Row: {
          assigne_a: string | null
          assigned_to: string | null
          commentaire: string | null
          contact_id: string | null
          created_at: string
          date: string
          deleted_at: string | null
          etablissement_id: string
          id: string
          info_libre: Json | null
          rappel_le: string | null
          resultat: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigne_a?: string | null
          assigned_to?: string | null
          commentaire?: string | null
          contact_id?: string | null
          created_at?: string
          date: string
          deleted_at?: string | null
          etablissement_id: string
          id?: string
          info_libre?: Json | null
          rappel_le?: string | null
          resultat?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigne_a?: string | null
          assigned_to?: string | null
          commentaire?: string | null
          contact_id?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          etablissement_id?: string
          id?: string
          info_libre?: Json | null
          rappel_le?: string | null
          resultat?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_assigne_a_fkey"
            columns: ["assigne_a"]
            isOneToOne: false
            referencedRelation: "utilisateurs_internes"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "actions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "utilisateurs_internes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      concurrence: {
        Row: {
          coefficient_observe: number | null
          concurrent_principal: string | null
          created_at: string
          date_debut: string | null
          date_fin: string | null
          deleted_at: string | null
          etablissement_id: string
          id: string
          postes: string[] | null
          remarques: string | null
          secteur: string | null
          sous_secteur: string | null
          statut: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coefficient_observe?: number | null
          concurrent_principal?: string | null
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          deleted_at?: string | null
          etablissement_id: string
          id?: string
          postes?: string[] | null
          remarques?: string | null
          secteur?: string | null
          sous_secteur?: string | null
          statut?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coefficient_observe?: number | null
          concurrent_principal?: string | null
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          deleted_at?: string | null
          etablissement_id?: string
          id?: string
          postes?: string[] | null
          remarques?: string | null
          secteur?: string | null
          sous_secteur?: string | null
          statut?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concurrence_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concurrence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string | null
          etablissement_id: string
          fonction: string | null
          id: string
          info_libre: Json | null
          nom: string
          notes_contact: string | null
          preference_contact: string | null
          prenom: string
          telephone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          etablissement_id: string
          fonction?: string | null
          id?: string
          info_libre?: Json | null
          nom: string
          notes_contact?: string | null
          preference_contact?: string | null
          prenom: string
          telephone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          etablissement_id?: string
          fonction?: string | null
          id?: string
          info_libre?: Json | null
          nom?: string
          notes_contact?: string | null
          preference_contact?: string | null
          prenom?: string
          telephone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      etablissements: {
        Row: {
          adresse: string | null
          code_postal: string | null
          coefficient: number | null
          concurrent_principal: string | null
          created_at: string
          deleted_at: string | null
          groupe: string | null
          id: string
          info_libre: Json | null
          nom: string
          nom_affiche: string | null
          nom_canonique: string | null
          notes: string | null
          secteur: string | null
          sous_secteur: string | null
          statut: string | null
          statut_commercial: string | null
          type: string
          updated_at: string
          user_id: string
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          code_postal?: string | null
          coefficient?: number | null
          concurrent_principal?: string | null
          created_at?: string
          deleted_at?: string | null
          groupe?: string | null
          id?: string
          info_libre?: Json | null
          nom: string
          nom_affiche?: string | null
          nom_canonique?: string | null
          notes?: string | null
          secteur?: string | null
          sous_secteur?: string | null
          statut?: string | null
          statut_commercial?: string | null
          type: string
          updated_at?: string
          user_id: string
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          code_postal?: string | null
          coefficient?: number | null
          concurrent_principal?: string | null
          created_at?: string
          deleted_at?: string | null
          groupe?: string | null
          id?: string
          info_libre?: Json | null
          nom?: string
          nom_affiche?: string | null
          nom_canonique?: string | null
          notes?: string | null
          secteur?: string | null
          sous_secteur?: string | null
          statut?: string | null
          statut_commercial?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "etablissements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      etablissements_aliases: {
        Row: {
          alias: string
          created_at: string
          etablissement_id: string
          id: string
        }
        Insert: {
          alias: string
          created_at?: string
          etablissement_id: string
          id?: string
        }
        Update: {
          alias?: string
          created_at?: string
          etablissement_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etablissements_aliases_etablissement_id_fkey"
            columns: ["etablissement_id"]
            isOneToOne: false
            referencedRelation: "etablissements"
            referencedColumns: ["id"]
          },
        ]
      }
      historique: {
        Row: {
          action: string
          created_at: string
          data: Json | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          data?: Json | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          data?: Json | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historique_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nom: string
          prenom: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nom: string
          prenom: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
          prenom?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      utilisateurs_internes: {
        Row: {
          created_at: string
          email: string
          id: string
          nom: string
          prenom: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nom: string
          prenom: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nom?: string
          prenom?: string
          role?: string | null
          updated_at?: string
          user_id?: string
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
