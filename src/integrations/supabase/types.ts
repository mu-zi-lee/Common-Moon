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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      contacts: {
        Row: {
          created_at: string
          handle: string
          id: string
          platform: string
          record_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          handle: string
          id?: string
          platform: string
          record_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          handle?: string
          id?: string
          platform?: string
          record_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          ai_summary: Json | null
          ai_summary_at: string | null
          city: string | null
          created_at: string
          halls: string[]
          id: string
          map_extra_urls: string[]
          map_image_url: string | null
          name: string
          user_id: string
          venue: string | null
          year: number | null
        }
        Insert: {
          ai_summary?: Json | null
          ai_summary_at?: string | null
          city?: string | null
          created_at?: string
          halls?: string[]
          id?: string
          map_extra_urls?: string[]
          map_image_url?: string | null
          name: string
          user_id: string
          venue?: string | null
          year?: number | null
        }
        Update: {
          ai_summary?: Json | null
          ai_summary_at?: string | null
          city?: string | null
          created_at?: string
          halls?: string[]
          id?: string
          map_extra_urls?: string[]
          map_image_url?: string | null
          name?: string
          user_id?: string
          venue?: string | null
          year?: number | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          currency: string
          event_id: string | null
          id: string
          note: string | null
          occurred_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          currency?: string
          event_id?: string | null
          id?: string
          note?: string | null
          occurred_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          event_id?: string | null
          id?: string
          note?: string | null
          occurred_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          id: string
          target_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      guide_items: {
        Row: {
          created_at: string
          done: boolean
          guide_id: string
          id: string
          kind: string
          payload: Json
          pinned: boolean
          planned_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          guide_id: string
          id?: string
          kind: string
          payload?: Json
          pinned?: boolean
          planned_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          guide_id?: string
          id?: string
          kind?: string
          payload?: Json
          pinned?: boolean
          planned_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_items_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guides: {
        Row: {
          created_at: string
          error: string | null
          event_id: string | null
          id: string
          parsed: Json | null
          personalized: Json | null
          source_files: Json
          source_kind: string
          source_text: string | null
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id?: string | null
          id?: string
          parsed?: Json | null
          personalized?: Json | null
          source_files?: Json
          source_kind?: string
          source_text?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string | null
          id?: string
          parsed?: Json | null
          personalized?: Json | null
          source_files?: Json
          source_kind?: string
          source_text?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      merch: {
        Row: {
          acquired_at: string
          created_at: string
          currency: string
          event_id: string | null
          favorite: boolean
          id: string
          kind: string
          name: string
          note: string | null
          photo_urls: string[]
          price: number | null
          rating: number
          record_id: string | null
          source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          created_at?: string
          currency?: string
          event_id?: string | null
          favorite?: boolean
          id?: string
          kind?: string
          name: string
          note?: string | null
          photo_urls?: string[]
          price?: number | null
          rating?: number
          record_id?: string | null
          source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          created_at?: string
          currency?: string
          event_id?: string | null
          favorite?: boolean
          id?: string
          kind?: string
          name?: string
          note?: string | null
          photo_urls?: string[]
          price?: number | null
          rating?: number
          record_id?: string | null
          source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merch_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merch_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          nickname: string | null
          theme: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          nickname?: string | null
          theme?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nickname?: string | null
          theme?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      record_tags: {
        Row: {
          record_id: string
          tag_id: string
          user_id: string
        }
        Insert: {
          record_id: string
          tag_id: string
          user_id: string
        }
        Update: {
          record_id?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_tags_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      records: {
        Row: {
          anime_name: string | null
          booth: string | null
          character_name: string | null
          created_at: string
          event_id: string | null
          favorite: boolean
          hall: string | null
          id: string
          interactions: string[]
          marker_x: number | null
          marker_y: number | null
          note: string | null
          occurred_at: string
          photo_url: string | null
          photo_urls: string[]
          rating: number
          teacher_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          anime_name?: string | null
          booth?: string | null
          character_name?: string | null
          created_at?: string
          event_id?: string | null
          favorite?: boolean
          hall?: string | null
          id?: string
          interactions?: string[]
          marker_x?: number | null
          marker_y?: number | null
          note?: string | null
          occurred_at?: string
          photo_url?: string | null
          photo_urls?: string[]
          rating?: number
          teacher_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          anime_name?: string | null
          booth?: string | null
          character_name?: string | null
          created_at?: string
          event_id?: string | null
          favorite?: boolean
          hall?: string | null
          id?: string
          interactions?: string[]
          marker_x?: number | null
          marker_y?: number | null
          note?: string | null
          occurred_at?: string
          photo_url?: string | null
          photo_urls?: string[]
          rating?: number
          teacher_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "records_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      share_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          record_id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          record_id: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          record_id?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_tokens_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          kind: string
          teacher_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          kind?: string
          teacher_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          kind?: string
          teacher_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      teacher_share_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          teacher_name: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          teacher_name: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          teacher_name?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_valid_share_token: { Args: { _record_id: string }; Returns: boolean }
      has_valid_teacher_share: {
        Args: { _teacher_name: string; _user_id: string }
        Returns: boolean
      }
      home_stats: { Args: never; Returns: Json }
      resolve_share_token: {
        Args: { _token: string }
        Returns: {
          expires_at: string
          record_id: string
        }[]
      }
      resolve_teacher_share_token: {
        Args: { _token: string }
        Returns: {
          expires_at: string
          teacher_name: string
          user_id: string
        }[]
      }
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
    Enums: {},
  },
} as const
