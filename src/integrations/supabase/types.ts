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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      assessment_answers: {
        Row: {
          answers_json: Json
          assessment_id: string
          created_at: string
          user_id: string
          version: number
        }
        Insert: {
          answers_json: Json
          assessment_id?: string
          created_at?: string
          user_id: string
          version?: number
        }
        Update: {
          answers_json?: Json
          assessment_id?: string
          created_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      behavior_profile: {
        Row: {
          eating_pattern: Database["public"]["Enums"]["eating_pattern"] | null
          id: string
          interoception_level:
            | Database["public"]["Enums"]["interoception_level"]
            | null
          primary_trigger: Database["public"]["Enums"]["trigger_type"] | null
          recommended_coaching_style:
            | Database["public"]["Enums"]["coaching_style"]
            | null
          updated_at: string
          user_id: string
          vulnerable_time: Database["public"]["Enums"]["vulnerable_time"] | null
        }
        Insert: {
          eating_pattern?: Database["public"]["Enums"]["eating_pattern"] | null
          id?: string
          interoception_level?:
            | Database["public"]["Enums"]["interoception_level"]
            | null
          primary_trigger?: Database["public"]["Enums"]["trigger_type"] | null
          recommended_coaching_style?:
            | Database["public"]["Enums"]["coaching_style"]
            | null
          updated_at?: string
          user_id: string
          vulnerable_time?:
            | Database["public"]["Enums"]["vulnerable_time"]
            | null
        }
        Update: {
          eating_pattern?: Database["public"]["Enums"]["eating_pattern"] | null
          id?: string
          interoception_level?:
            | Database["public"]["Enums"]["interoception_level"]
            | null
          primary_trigger?: Database["public"]["Enums"]["trigger_type"] | null
          recommended_coaching_style?:
            | Database["public"]["Enums"]["coaching_style"]
            | null
          updated_at?: string
          user_id?: string
          vulnerable_time?:
            | Database["public"]["Enums"]["vulnerable_time"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "behavior_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      consultations: {
        Row: {
          consultation_id: string
          created_at: string
          notes_internal: string | null
          payment_id: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["consultation_status"]
          user_id: string
        }
        Insert: {
          consultation_id?: string
          created_at?: string
          notes_internal?: string | null
          payment_id?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["consultation_status"]
          user_id: string
        }
        Update: {
          consultation_id?: string
          created_at?: string
          notes_internal?: string | null
          payment_id?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["consultation_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      content_library: {
        Row: {
          body_text: string | null
          content_id: string
          created_at: string
          media_url: string | null
          nutrition_json: Json | null
          tags_json: Json | null
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at: string
        }
        Insert: {
          body_text?: string | null
          content_id?: string
          created_at?: string
          media_url?: string | null
          nutrition_json?: Json | null
          tags_json?: Json | null
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at?: string
        }
        Update: {
          body_text?: string | null
          content_id?: string
          created_at?: string
          media_url?: string | null
          nutrition_json?: Json | null
          tags_json?: Json | null
          title?: string
          type?: Database["public"]["Enums"]["content_type"]
          updated_at?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          checkin_id: string
          created_at: string
          date: string
          notes: string | null
          sleep_hours: number | null
          steps_yesterday: number | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          checkin_id?: string
          created_at?: string
          date: string
          notes?: string | null
          sleep_hours?: number | null
          steps_yesterday?: number | null
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          checkin_id?: string
          created_at?: string
          date?: string
          notes?: string | null
          sleep_hours?: number | null
          steps_yesterday?: number | null
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      evening_reflections: {
        Row: {
          created_at: string
          date: string
          emotion: string | null
          hardest_part: string | null
          hunger_level: number | null
          reflection_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          emotion?: string | null
          hardest_part?: string | null
          hunger_level?: number | null
          reflection_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          emotion?: string | null
          hardest_part?: string | null
          hunger_level?: number | null
          reflection_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evening_reflections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      food_analysis: {
        Row: {
          analysis_id: string
          calories_estimated: number | null
          created_at: string
          fat_status: Database["public"]["Enums"]["nutrient_status"] | null
          fiber_status: Database["public"]["Enums"]["nutrient_status"] | null
          log_id: string
          protein_status: Database["public"]["Enums"]["nutrient_status"] | null
          recommendation_text: string | null
          risk_flags_json: Json | null
        }
        Insert: {
          analysis_id?: string
          calories_estimated?: number | null
          created_at?: string
          fat_status?: Database["public"]["Enums"]["nutrient_status"] | null
          fiber_status?: Database["public"]["Enums"]["nutrient_status"] | null
          log_id: string
          protein_status?: Database["public"]["Enums"]["nutrient_status"] | null
          recommendation_text?: string | null
          risk_flags_json?: Json | null
        }
        Update: {
          analysis_id?: string
          calories_estimated?: number | null
          created_at?: string
          fat_status?: Database["public"]["Enums"]["nutrient_status"] | null
          fiber_status?: Database["public"]["Enums"]["nutrient_status"] | null
          log_id?: string
          protein_status?: Database["public"]["Enums"]["nutrient_status"] | null
          recommendation_text?: string | null
          risk_flags_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "food_analysis_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "food_logs"
            referencedColumns: ["log_id"]
          },
        ]
      }
      food_logs: {
        Row: {
          created_at: string
          datetime: string
          input_type: Database["public"]["Enums"]["input_type"]
          log_id: string
          meal_tag: Database["public"]["Enums"]["meal_tag"]
          photo_url: string | null
          raw_text: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          datetime?: string
          input_type?: Database["public"]["Enums"]["input_type"]
          log_id?: string
          meal_tag?: Database["public"]["Enums"]["meal_tag"]
          photo_url?: string | null
          raw_text?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          datetime?: string
          input_type?: Database["public"]["Enums"]["input_type"]
          log_id?: string
          meal_tag?: Database["public"]["Enums"]["meal_tag"]
          photo_url?: string | null
          raw_text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          paid_until: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          trial_started_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          paid_until?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          trial_started_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          paid_until?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          trial_started_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_events: {
        Row: {
          created_at: string
          event_id: string
          payload_json: Json | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id?: string
          payload_json?: Json | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          payload_json?: Json | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_plan: {
        Row: {
          calorie_corridor_high: number | null
          calorie_corridor_low: number | null
          calorie_target: number | null
          created_at: string
          id: string
          pace: Database["public"]["Enums"]["pace_type"] | null
          reminders_level: string | null
          tracking_method:
            | Database["public"]["Enums"]["tracking_method_type"]
            | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calorie_corridor_high?: number | null
          calorie_corridor_low?: number | null
          calorie_target?: number | null
          created_at?: string
          id?: string
          pace?: Database["public"]["Enums"]["pace_type"] | null
          reminders_level?: string | null
          tracking_method?:
            | Database["public"]["Enums"]["tracking_method_type"]
            | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calorie_corridor_high?: number | null
          calorie_corridor_low?: number | null
          calorie_target?: number | null
          created_at?: string
          id?: string
          pace?: Database["public"]["Enums"]["pace_type"] | null
          reminders_level?: string | null
          tracking_method?:
            | Database["public"]["Enums"]["tracking_method_type"]
            | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_plan_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_profile: {
        Row: {
          age: number | null
          birth_year: number | null
          created_at: string
          current_weight_kg: number | null
          emotional_trigger: string | null
          goal_weight_kg: number | null
          height_cm: number | null
          hips_cm: number | null
          id: string
          sex: string | null
          start_weight_kg: number | null
          steps_baseline: number | null
          updated_at: string
          user_id: string
          waist_cm: number | null
          weight_gain_reasons: string[] | null
        }
        Insert: {
          age?: number | null
          birth_year?: number | null
          created_at?: string
          current_weight_kg?: number | null
          emotional_trigger?: string | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          hips_cm?: number | null
          id?: string
          sex?: string | null
          start_weight_kg?: number | null
          steps_baseline?: number | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          weight_gain_reasons?: string[] | null
        }
        Update: {
          age?: number | null
          birth_year?: number | null
          created_at?: string
          current_weight_kg?: number | null
          emotional_trigger?: string | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          hips_cm?: number | null
          id?: string
          sex?: string | null
          start_weight_kg?: number | null
          steps_baseline?: number | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          weight_gain_reasons?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          created_at: string
          language: string | null
          name: string | null
          status: Database["public"]["Enums"]["user_status"]
          timezone: string | null
          user_id: string
        }
        Insert: {
          auth_id?: string | null
          created_at?: string
          language?: string | null
          name?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          timezone?: string | null
          user_id?: string
        }
        Update: {
          auth_id?: string | null
          created_at?: string
          language?: string | null
          name?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          timezone?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      consultations_user_view: {
        Row: {
          consultation_id: string | null
          created_at: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["consultation_status"] | null
          user_id: string | null
        }
        Insert: {
          consultation_id?: string | null
          created_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["consultation_status"] | null
          user_id?: string | null
        }
        Update: {
          consultation_id?: string | null
          created_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["consultation_status"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      coaching_style: "supportive" | "structured" | "mixed"
      consultation_status:
        | "requested"
        | "paid"
        | "scheduled"
        | "done"
        | "canceled"
      content_type: "recipe" | "sos" | "lesson" | "audio"
      eating_pattern: "emotional" | "restorative" | "chaotic" | "intuitive"
      input_type: "text" | "photo" | "voice"
      interoception_level: "high" | "medium" | "low"
      meal_tag: "breakfast" | "lunch" | "dinner" | "snack" | "unknown"
      nutrient_status: "low" | "ok" | "high" | "unknown"
      pace_type: "fast" | "slow"
      subscription_status: "active" | "expired"
      tracking_method_type: "calories" | "palm" | "plate"
      trigger_type: "fatigue" | "stress" | "hunger" | "no_plan" | "social"
      user_status: "trial" | "active" | "expired"
      vulnerable_time: "morning" | "day" | "evening" | "night"
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
    Enums: {
      coaching_style: ["supportive", "structured", "mixed"],
      consultation_status: [
        "requested",
        "paid",
        "scheduled",
        "done",
        "canceled",
      ],
      content_type: ["recipe", "sos", "lesson", "audio"],
      eating_pattern: ["emotional", "restorative", "chaotic", "intuitive"],
      input_type: ["text", "photo", "voice"],
      interoception_level: ["high", "medium", "low"],
      meal_tag: ["breakfast", "lunch", "dinner", "snack", "unknown"],
      nutrient_status: ["low", "ok", "high", "unknown"],
      pace_type: ["fast", "slow"],
      subscription_status: ["active", "expired"],
      tracking_method_type: ["calories", "palm", "plate"],
      trigger_type: ["fatigue", "stress", "hunger", "no_plan", "social"],
      user_status: ["trial", "active", "expired"],
      vulnerable_time: ["morning", "day", "evening", "night"],
    },
  },
} as const
