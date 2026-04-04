export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
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
      menu_items: {
        Row: {
          category: string
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
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name?: string
          price?: number
          tags?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string
          id: string
          items: Json
          payment_method: string
          payment_status: string | null
          order_status: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          total_amount: number
        }
        Insert: {
          created_at?: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string
          id?: string
          items: Json
          payment_method: string
          payment_status?: string | null
          order_status?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          total_amount: number
        }
        Update: {
          created_at?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_address?: string
          id?: string
          items?: Json
          payment_method?: string
          payment_status?: string | null
          order_status?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          total_amount?: number
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
