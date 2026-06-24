export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      ai_extractions: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          model: string | null
          organization_id: string
          parsed: Json | null
          raw_response: Json | null
          source_file_url: string | null
          status: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          model?: string | null
          organization_id: string
          parsed?: Json | null
          raw_response?: Json | null
          source_file_url?: string | null
          status?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          model?: string | null
          organization_id?: string
          parsed?: Json | null
          raw_response?: Json | null
          source_file_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_extractions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          organization_id: string
          role: string
          thread_id: string
          tool_calls: Json | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          organization_id: string
          role: string
          thread_id?: string
          tool_calls?: Json | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          thread_id?: string
          tool_calls?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          cost: number
          created_at: string
          feature: string
          id: string
          input_tokens: number
          model: string | null
          organization_id: string
          output_tokens: number
        }
        Insert: {
          cost?: number
          created_at?: string
          feature: string
          id?: string
          input_tokens?: number
          model?: string | null
          organization_id: string
          output_tokens?: number
        }
        Update: {
          cost?: number
          created_at?: string
          feature?: string
          id?: string
          input_tokens?: number
          model?: string | null
          organization_id?: string
          output_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          at: string
          diff: Json | null
          entity: string
          entity_id: string | null
          id: string
          organization_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          at?: string
          diff?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
          organization_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          at?: string
          diff?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          bank_name: string | null
          created_at: string
          currency: string
          iban: string
          id: string
          is_default: boolean
          organization_id: string
          swift: string | null
          updated_at: string
        }
        Insert: {
          bank_name?: string | null
          created_at?: string
          currency?: string
          iban: string
          id?: string
          is_default?: boolean
          organization_id: string
          swift?: string | null
          updated_at?: string
        }
        Update: {
          bank_name?: string | null
          created_at?: string
          currency?: string
          iban?: string
          id?: string
          is_default?: boolean
          organization_id?: string
          swift?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          account_id: string | null
          amount: number
          booked_at: string | null
          counterparty: string | null
          created_at: string
          currency: string
          id: string
          ks: string | null
          matched_status: Database["public"]["Enums"]["bank_match_status"]
          message: string | null
          organization_id: string
          raw: Json | null
          ss: string | null
          vs: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          booked_at?: string | null
          counterparty?: string | null
          created_at?: string
          currency?: string
          id?: string
          ks?: string | null
          matched_status?: Database["public"]["Enums"]["bank_match_status"]
          message?: string | null
          organization_id: string
          raw?: Json | null
          ss?: string | null
          vs?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          booked_at?: string | null
          counterparty?: string | null
          created_at?: string
          currency?: string
          id?: string
          ks?: string | null
          matched_status?: Database["public"]["Enums"]["bank_match_status"]
          message?: string | null
          organization_id?: string
          raw?: Json | null
          ss?: string | null
          vs?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          city: string | null
          country: string
          created_at: string
          default_due_days: number | null
          dic: string | null
          email: string | null
          ic_dph: string | null
          ico: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          payment_behavior_score: number | null
          peppol_id: string | null
          phone: string | null
          postal_code: string | null
          street: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string
          created_at?: string
          default_due_days?: number | null
          dic?: string | null
          email?: string | null
          ic_dph?: string | null
          ico?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          payment_behavior_score?: number | null
          peppol_id?: string | null
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string
          created_at?: string
          default_due_days?: number | null
          dic?: string | null
          email?: string | null
          ic_dph?: string | null
          ico?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          payment_behavior_score?: number | null
          peppol_id?: string | null
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_items: {
        Row: {
          created_at: string
          description: string
          discount_pct: number
          document_id: string
          id: string
          line_base: number
          line_total: number
          line_vat: number
          position: number
          product_id: string | null
          quantity: number
          unit: string
          unit_price: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description?: string
          discount_pct?: number
          document_id: string
          id?: string
          line_base?: number
          line_total?: number
          line_vat?: number
          position?: number
          product_id?: string | null
          quantity?: number
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string
          discount_pct?: number
          document_id?: string
          id?: string
          line_base?: number
          line_total?: number
          line_vat?: number
          position?: number
          product_id?: string | null
          quantity?: number
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          exchange_rate: number
          footer_notes: string | null
          id: string
          issue_date: string | null
          language: string
          legal_notes: string | null
          notes: string | null
          number: string | null
          organization_id: string
          paid_amount: number
          pdf_url: string | null
          related_document_id: string | null
          sequence_id: string | null
          source: string
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          supply_date: string | null
          total: number
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          vat_mode: Database["public"]["Enums"]["vat_mode"]
          vat_total: number
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          exchange_rate?: number
          footer_notes?: string | null
          id?: string
          issue_date?: string | null
          language?: string
          legal_notes?: string | null
          notes?: string | null
          number?: string | null
          organization_id: string
          paid_amount?: number
          pdf_url?: string | null
          related_document_id?: string | null
          sequence_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          supply_date?: string | null
          total?: number
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          vat_mode?: Database["public"]["Enums"]["vat_mode"]
          vat_total?: number
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          exchange_rate?: number
          footer_notes?: string | null
          id?: string
          issue_date?: string | null
          language?: string
          legal_notes?: string | null
          notes?: string | null
          number?: string | null
          organization_id?: string
          paid_amount?: number
          pdf_url?: string | null
          related_document_id?: string | null
          sequence_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          supply_date?: string | null
          total?: number
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          vat_mode?: Database["public"]["Enums"]["vat_mode"]
          vat_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_related_document_id_fkey"
            columns: ["related_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "number_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          attachment_url: string | null
          category: string | null
          created_at: string
          currency: string
          document_number: string | null
          due_date: string | null
          extraction_id: string | null
          id: string
          issue_date: string | null
          notes: string | null
          organization_id: string
          paid_amount: number
          source: Database["public"]["Enums"]["expense_source"]
          status: Database["public"]["Enums"]["payment_status"]
          subtotal: number
          supplier_contact_id: string | null
          supply_date: string | null
          tax_deductible: boolean
          total: number
          updated_at: string
          vat_rate_breakdown: Json
          vat_total: number
        }
        Insert: {
          attachment_url?: string | null
          category?: string | null
          created_at?: string
          currency?: string
          document_number?: string | null
          due_date?: string | null
          extraction_id?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          organization_id: string
          paid_amount?: number
          source?: Database["public"]["Enums"]["expense_source"]
          status?: Database["public"]["Enums"]["payment_status"]
          subtotal?: number
          supplier_contact_id?: string | null
          supply_date?: string | null
          tax_deductible?: boolean
          total?: number
          updated_at?: string
          vat_rate_breakdown?: Json
          vat_total?: number
        }
        Update: {
          attachment_url?: string | null
          category?: string | null
          created_at?: string
          currency?: string
          document_number?: string | null
          due_date?: string | null
          extraction_id?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          organization_id?: string
          paid_amount?: number
          source?: Database["public"]["Enums"]["expense_source"]
          status?: Database["public"]["Enums"]["payment_status"]
          subtotal?: number
          supplier_contact_id?: string | null
          supply_date?: string | null
          tax_deductible?: boolean
          total?: number
          updated_at?: string
          vat_rate_breakdown?: Json
          vat_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_contact_id_fkey"
            columns: ["supplier_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      forecasts: {
        Row: {
          data: Json | null
          generated_at: string
          horizon_days: number
          id: string
          narrative: string | null
          organization_id: string
        }
        Insert: {
          data?: Json | null
          generated_at?: string
          horizon_days?: number
          id?: string
          narrative?: string | null
          organization_id: string
        }
        Update: {
          data?: Json | null
          generated_at?: string
          horizon_days?: number
          id?: string
          narrative?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecasts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      number_sequences: {
        Row: {
          created_at: string
          doc_type: Database["public"]["Enums"]["document_type"]
          format: string
          id: string
          next_number: number
          organization_id: string
          padding: number
          prefix: string
          year: number
        }
        Insert: {
          created_at?: string
          doc_type: Database["public"]["Enums"]["document_type"]
          format?: string
          id?: string
          next_number?: number
          organization_id: string
          padding?: number
          prefix?: string
          year: number
        }
        Update: {
          created_at?: string
          doc_type?: Database["public"]["Enums"]["document_type"]
          format?: string
          id?: string
          next_number?: number
          organization_id?: string
          padding?: number
          prefix?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "number_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          invited_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_at?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          invited_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          city: string | null
          country: string
          created_at: string
          default_currency: string
          default_due_days: number
          default_language: string
          dic: string | null
          digital_postman_provider: string | null
          einvoice_enabled: boolean
          ic_dph: string | null
          ico: string | null
          id: string
          is_vat_payer: boolean
          legal_form: string | null
          logo_url: string | null
          name: string
          peppol_id: string | null
          postal_code: string | null
          signature_url: string | null
          stamp_url: string | null
          street: string | null
          updated_at: string
          vat_mode_default: Database["public"]["Enums"]["vat_mode"]
        }
        Insert: {
          city?: string | null
          country?: string
          created_at?: string
          default_currency?: string
          default_due_days?: number
          default_language?: string
          dic?: string | null
          digital_postman_provider?: string | null
          einvoice_enabled?: boolean
          ic_dph?: string | null
          ico?: string | null
          id?: string
          is_vat_payer?: boolean
          legal_form?: string | null
          logo_url?: string | null
          name: string
          peppol_id?: string | null
          postal_code?: string | null
          signature_url?: string | null
          stamp_url?: string | null
          street?: string | null
          updated_at?: string
          vat_mode_default?: Database["public"]["Enums"]["vat_mode"]
        }
        Update: {
          city?: string | null
          country?: string
          created_at?: string
          default_currency?: string
          default_due_days?: number
          default_language?: string
          dic?: string | null
          digital_postman_provider?: string | null
          einvoice_enabled?: boolean
          ic_dph?: string | null
          ico?: string | null
          id?: string
          is_vat_payer?: boolean
          legal_form?: string | null
          logo_url?: string | null
          name?: string
          peppol_id?: string | null
          postal_code?: string | null
          signature_url?: string | null
          stamp_url?: string | null
          street?: string | null
          updated_at?: string
          vat_mode_default?: Database["public"]["Enums"]["vat_mode"]
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          bank_transaction_id: string | null
          created_at: string
          document_id: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string
        }
        Insert: {
          amount: number
          bank_transaction_id?: string | null
          created_at?: string
          document_id: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
        }
        Update: {
          amount?: number
          bank_transaction_id?: string | null
          created_at?: string
          document_id?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_bank_transaction_fk"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          currency: string
          id: string
          name: string
          organization_id: string
          sku: string | null
          stock_qty: number | null
          unit: string
          unit_price: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          name: string
          organization_id: string
          sku?: string | null
          stock_qty?: number | null
          unit?: string
          unit_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          name?: string
          organization_id?: string
          sku?: string | null
          stock_qty?: number | null
          unit?: string
          unit_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_invoices: {
        Row: {
          active: boolean
          cadence: Database["public"]["Enums"]["recurring_cadence"]
          contact_id: string | null
          created_at: string
          id: string
          interval_days: number | null
          last_run_at: string | null
          name: string
          next_run_at: string
          organization_id: string
          send_method: Database["public"]["Enums"]["recurring_send_method"]
          template: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          cadence?: Database["public"]["Enums"]["recurring_cadence"]
          contact_id?: string | null
          created_at?: string
          id?: string
          interval_days?: number | null
          last_run_at?: string | null
          name?: string
          next_run_at: string
          organization_id: string
          send_method?: Database["public"]["Enums"]["recurring_send_method"]
          template: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          cadence?: Database["public"]["Enums"]["recurring_cadence"]
          contact_id?: string | null
          created_at?: string
          id?: string
          interval_days?: number | null
          last_run_at?: string | null
          name?: string
          next_run_at?: string
          organization_id?: string
          send_method?: Database["public"]["Enums"]["recurring_send_method"]
          template?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          ai_generated: boolean
          body: string | null
          channel: Database["public"]["Enums"]["reminder_channel"]
          created_at: string
          document_id: string
          id: string
          level: number
          organization_id: string
          scheduled_at: string | null
          sent_at: string | null
          tone: string | null
        }
        Insert: {
          ai_generated?: boolean
          body?: string | null
          channel?: Database["public"]["Enums"]["reminder_channel"]
          created_at?: string
          document_id: string
          id?: string
          level?: number
          organization_id: string
          scheduled_at?: string | null
          sent_at?: string | null
          tone?: string | null
        }
        Update: {
          ai_generated?: boolean
          body?: string | null
          channel?: Database["public"]["Enums"]["reminder_channel"]
          created_at?: string
          document_id?: string
          id?: string
          level?: number
          organization_id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          tone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vat_rates: {
        Row: {
          category_note: string | null
          code: string
          percent: number
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          category_note?: string | null
          code: string
          percent: number
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          category_note?: string | null
          code?: string
          percent?: number
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization_with_owner: {
        Args: {
          p_bank_name?: string
          p_city?: string
          p_country?: string
          p_default_currency?: string
          p_default_due_days?: number
          p_default_language?: string
          p_dic?: string
          p_iban?: string
          p_ic_dph?: string
          p_ico?: string
          p_is_vat_payer?: boolean
          p_legal_form?: string
          p_name: string
          p_postal_code?: string
          p_street?: string
          p_swift?: string
          p_vat_mode_default?: Database["public"]["Enums"]["vat_mode"]
        }
        Returns: {
          city: string | null
          country: string
          created_at: string
          default_currency: string
          default_due_days: number
          default_language: string
          dic: string | null
          digital_postman_provider: string | null
          einvoice_enabled: boolean
          ic_dph: string | null
          ico: string | null
          id: string
          is_vat_payer: boolean
          legal_form: string | null
          logo_url: string | null
          name: string
          peppol_id: string | null
          postal_code: string | null
          signature_url: string | null
          stamp_url: string | null
          street: string | null
          updated_at: string
          vat_mode_default: Database["public"]["Enums"]["vat_mode"]
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_org_role: {
        Args: { org: string; roles: Database["public"]["Enums"]["org_role"][] }
        Returns: boolean
      }
      is_org_member: { Args: { org: string }; Returns: boolean }
      next_document_number: {
        Args: {
          p_doc_type: Database["public"]["Enums"]["document_type"]
          p_org: string
          p_year: number
        }
        Returns: string
      }
    }
    Enums: {
      bank_match_status: "unmatched" | "matched" | "ignored"
      contact_type: "customer" | "supplier" | "both"
      document_status:
        | "draft"
        | "issued"
        | "sent"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "cancelled"
      document_type:
        | "invoice"
        | "proforma"
        | "advance"
        | "tax_doc_payment"
        | "credit_note"
        | "quote"
        | "order_issued"
        | "order_received"
        | "delivery_note"
        | "draft"
      expense_source:
        | "manual"
        | "ai_capture"
        | "peppol_inbound"
        | "invoice_by_square"
      org_role: "owner" | "admin" | "accountant" | "member"
      payment_method: "bank" | "card" | "cash" | "other"
      payment_status: "unpaid" | "partially_paid" | "paid"
      recurring_cadence: "weekly" | "monthly" | "custom"
      recurring_send_method: "email" | "peppol" | "none"
      reminder_channel: "email" | "sms"
      vat_mode:
        | "payer"
        | "non_payer"
        | "reverse_charge_domestic"
        | "intra_eu_b2b"
        | "oss"
        | "export"
        | "exempt"
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
    Enums: {
      bank_match_status: ["unmatched", "matched", "ignored"],
      contact_type: ["customer", "supplier", "both"],
      document_status: [
        "draft",
        "issued",
        "sent",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled",
      ],
      document_type: [
        "invoice",
        "proforma",
        "advance",
        "tax_doc_payment",
        "credit_note",
        "quote",
        "order_issued",
        "order_received",
        "delivery_note",
        "draft",
      ],
      expense_source: [
        "manual",
        "ai_capture",
        "peppol_inbound",
        "invoice_by_square",
      ],
      org_role: ["owner", "admin", "accountant", "member"],
      payment_method: ["bank", "card", "cash", "other"],
      payment_status: ["unpaid", "partially_paid", "paid"],
      recurring_cadence: ["weekly", "monthly", "custom"],
      recurring_send_method: ["email", "peppol", "none"],
      reminder_channel: ["email", "sms"],
      vat_mode: [
        "payer",
        "non_payer",
        "reverse_charge_domestic",
        "intra_eu_b2b",
        "oss",
        "export",
        "exempt",
      ],
    },
  },
} as const

