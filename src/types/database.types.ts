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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      addon_groups: {
        Row: {
          created_at: string
          id: string
          max_selections: number | null
          min_selections: number
          name: string
          petpooja_id: string | null
          restaurant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_selections?: number | null
          min_selections?: number
          name: string
          petpooja_id?: string | null
          restaurant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_selections?: number | null
          min_selections?: number
          name?: string
          petpooja_id?: string | null
          restaurant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addon_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      addon_items: {
        Row: {
          addon_group_id: string | null
          created_at: string
          id: string
          is_available: boolean
          name: string
          petpooja_id: string | null
          price: number
          updated_at: string
        }
        Insert: {
          addon_group_id?: string | null
          created_at?: string
          id?: string
          is_available?: boolean
          name: string
          petpooja_id?: string | null
          price?: number
          updated_at?: string
        }
        Update: {
          addon_group_id?: string | null
          created_at?: string
          id?: string
          is_available?: boolean
          name?: string
          petpooja_id?: string | null
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addon_items_addon_group_id_fkey"
            columns: ["addon_group_id"]
            isOneToOne: false
            referencedRelation: "addon_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          delivery_enabled: boolean | null
          id: string
          max_delivery_radius: number | null
          updated_at: string | null
        }
        Insert: {
          delivery_enabled?: boolean | null
          id?: string
          max_delivery_radius?: number | null
          updated_at?: string | null
        }
        Update: {
          delivery_enabled?: boolean | null
          id?: string
          max_delivery_radius?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      attributes: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      batches: {
        Row: {
          created_at: string
          id: string
          rider_phone: string | null
          status: string | null
          tracking_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          rider_phone?: string | null
          status?: string | null
          tracking_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          rider_phone?: string | null
          status?: string | null
          tracking_url?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          name: string | null
          phone: string
          total_orders: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          phone: string
          total_orders?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          phone?: string
          total_orders?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      delivery_assignments: {
        Row: {
          assigned_at: string
          delivered_at: string | null
          id: string
          order_id: string | null
          picked_at: string | null
          rider_id: string | null
          status: string
        }
        Insert: {
          assigned_at?: string
          delivered_at?: string | null
          id?: string
          order_id?: string | null
          picked_at?: string | null
          rider_id?: string | null
          status?: string
        }
        Update: {
          assigned_at?: string
          delivered_at?: string | null
          id?: string
          order_id?: string | null
          picked_at?: string | null
          rider_id?: string | null
          status?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          petpooja_id: string | null
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          petpooja_id?: string | null
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          petpooja_id?: string | null
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          category: string
          category_id: string | null
          created_at: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          name: string
          price: number
          tags: Json | null
          updated_at: string | null
        }
        Insert: {
          category: string
          category_id?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name: string
          price: number
          tags?: Json | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          category_id?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name?: string
          price?: number
          tags?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          menu_item_id: string | null
          order_id: string | null
          price_at_order: number
          quantity: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          menu_item_id?: string | null
          order_id?: string | null
          price_at_order: number
          quantity: number
        }
        Update: {
          created_at?: string | null
          id?: string
          menu_item_id?: string | null
          order_id?: string | null
          price_at_order?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          batch_id: string | null
          created_at: string | null
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_address: string
          delivery_coordinates: Json | null
          distance_km: number | null
          duration_seconds: number | null
          eta_last_updated: string | null
          eta_minutes: number | null
          food_ready_at: string | null
          friendly_id: string | null
          id: string
          items: Json
          last_location_timestamp: string | null
          lat: number | null
          latest_lat: number | null
          latest_lng: number | null
          lng: number | null
          manual_dispatch: boolean | null
          manual_dispatch_note: string | null
          order_status: string | null
          payment_method: string
          payment_status: string | null
          prep_deadline: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          rider_accepted_at: string | null
          rider_earning: number | null
          rider_id: string | null
          rider_phone: string | null
          rider_started_at: string | null
          total_amount: number
          tracking_url: string | null
          updated_at: string | null
          cancelled_by: string | null
          cancel_reason: string | null
          customer_help_message: string | null
          refund_status: string | null
          deleted_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          batch_id?: string | null
          created_at?: string | null
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          delivery_address: string
          delivery_coordinates?: Json | null
          distance_km?: number | null
          duration_seconds?: number | null
          eta_last_updated?: string | null
          eta_minutes?: number | null
          food_ready_at?: string | null
          friendly_id?: string | null
          id?: string
          items: Json
          last_location_timestamp?: string | null
          lat?: number | null
          latest_lat?: number | null
          latest_lng?: number | null
          lng?: number | null
          manual_dispatch?: boolean | null
          manual_dispatch_note?: string | null
          order_status?: string | null
          payment_method: string
          payment_status?: string | null
          prep_deadline?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          rider_accepted_at?: string | null
          rider_earning?: number | null
          rider_id?: string | null
          rider_phone?: string | null
          rider_started_at?: string | null
          total_amount: number
          tracking_url?: string | null
          updated_at?: string | null
          cancelled_by?: string | null
          cancel_reason?: string | null
          customer_help_message?: string | null
          refund_status?: string | null
          deleted_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          batch_id?: string | null
          created_at?: string | null
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_address?: string
          delivery_coordinates?: Json | null
          distance_km?: number | null
          duration_seconds?: number | null
          eta_last_updated?: string | null
          eta_minutes?: number | null
          food_ready_at?: string | null
          friendly_id?: string | null
          id?: string
          items?: Json
          last_location_timestamp?: string | null
          lat?: number | null
          latest_lat?: number | null
          latest_lng?: number | null
          lng?: number | null
          manual_dispatch?: boolean | null
          manual_dispatch_note?: string | null
          order_status?: string | null
          payment_method?: string
          payment_status?: string | null
          prep_deadline?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          rider_accepted_at?: string | null
          rider_earning?: number | null
          rider_id?: string | null
          rider_phone?: string | null
          rider_started_at?: string | null
          total_amount?: number
          tracking_url?: string | null
          updated_at?: string | null
          cancelled_by?: string | null
          cancel_reason?: string | null
          customer_help_message?: string | null
          refund_status?: string | null
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          order_id: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: string
          order_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          order_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_settings: {
        Row: {
          auto_reject_minutes: number | null
          id: number
          online_status: boolean | null
          prep_time_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          auto_reject_minutes?: number | null
          id?: number
          online_status?: boolean | null
          prep_time_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_reject_minutes?: number | null
          id?: number
          online_status?: boolean | null
          prep_time_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_open: boolean
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_open?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_open?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rider_locations: {
        Row: {
          created_at: string
          id: number
          lat: number
          lng: number
          location: Json
          rider_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          lat: number
          lng: number
          location: Json
          rider_id: string
        }
        Update: {
          created_at?: string
          id?: number
          lat?: number
          lng?: number
          location?: Json
          rider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_locations_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      riders: {
        Row: {
          created_at: string
          current_location: Json | null
          id: string
          is_active: boolean | null
          is_online: boolean | null
          name: string
          password_hash: string
          phone: string
          status: string | null
          total_deliveries: number | null
          total_earnings: number | null
          username: string
        }
        Insert: {
          created_at?: string
          current_location?: Json | null
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          name: string
          password_hash: string
          phone: string
          status?: string | null
          total_deliveries?: number | null
          total_earnings?: number | null
          username: string
        }
        Update: {
          created_at?: string
          current_location?: Json | null
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          name?: string
          password_hash?: string
          phone?: string
          status?: string | null
          total_deliveries?: number | null
          total_earnings?: number | null
          username?: string
        }
        Relationships: []
      }
      taxes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          percentage: number
          restaurant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          percentage: number
          restaurant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          percentage?: number
          restaurant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      variations: {
        Row: {
          created_at: string
          id: string
          is_available: boolean
          item_id: string | null
          name: string
          petpooja_id: string | null
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_available?: boolean
          item_id?: string | null
          name: string
          petpooja_id?: string | null
          price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_available?: boolean
          item_id?: string | null
          name?: string
          petpooja_id?: string | null
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "variations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_reject_expired_orders: { Args: never; Returns: undefined }
      deliver_order: {
        Args: {
          p_order_id: string
          p_rider_earning: number
          p_rider_id: string
        }
        Returns: undefined
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
