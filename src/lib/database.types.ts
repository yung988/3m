export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      invoices: {
        Row: {
          id: string
          owner_id: string
          invoice_number: string
          issue_date: string
          due_date: string
          project_title: string
          project_subtitle: string
          customer_name: string
          customer_address: string
          customer_company_id: string
          customer_tax_id: string
          status: "draft" | "issued" | "paid" | "overdue" | "cancelled"
          paid_at: string | null
          total_amount: number
          currency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          invoice_number: string
          issue_date: string
          due_date: string
          project_title?: string
          project_subtitle?: string
          customer_name?: string
          customer_address?: string
          customer_company_id?: string
          customer_tax_id?: string
          status?: "draft" | "issued" | "paid" | "overdue" | "cancelled"
          paid_at?: string | null
          total_amount?: number
          currency?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          invoice_number?: string
          issue_date?: string
          due_date?: string
          project_title?: string
          project_subtitle?: string
          customer_name?: string
          customer_address?: string
          customer_company_id?: string
          customer_tax_id?: string
          status?: "draft" | "issued" | "paid" | "overdue" | "cancelled"
          paid_at?: string | null
          total_amount?: number
          currency?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          id: string
          invoice_id: string
          owner_id: string
          description: string
          quantity: number
          unit_price: number
          unit_label: string
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          owner_id: string
          description: string
          quantity?: number
          unit_price?: number
          unit_label?: string
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          owner_id?: string
          description?: string
          quantity?: number
          unit_price?: number
          unit_label?: string
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          id: string
          owner_id: string
          invoice_id: string | null
          source: string
          source_transaction_id: string | null
          account_iban: string | null
          counterparty_account: string | null
          counterparty_name: string | null
          booked_at: string
          amount: number
          currency: string
          variable_symbol: string | null
          message: string | null
          raw_data: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          invoice_id?: string | null
          source?: string
          source_transaction_id?: string | null
          account_iban?: string | null
          counterparty_account?: string | null
          counterparty_name?: string | null
          booked_at: string
          amount: number
          currency?: string
          variable_symbol?: string | null
          message?: string | null
          raw_data?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          invoice_id?: string | null
          source?: string
          source_transaction_id?: string | null
          account_iban?: string | null
          counterparty_account?: string | null
          counterparty_name?: string | null
          booked_at?: string
          amount?: number
          currency?: string
          variable_symbol?: string | null
          message?: string | null
          raw_data?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
