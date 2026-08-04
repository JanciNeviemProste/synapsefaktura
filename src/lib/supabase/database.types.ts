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
      cash_register_items: {
        Row: {
          amount: number
          cash_register_id: string
          contact_id: string | null
          created_at: string
          description: string | null
          direction: Database["public"]["Enums"]["cash_flow_direction"]
          document_id: string | null
          expense_id: string | null
          id: string
          issued_on: string
          number: string | null
          organization_id: string
          vat_amount: number
        }
        Insert: {
          amount: number
          cash_register_id: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          direction: Database["public"]["Enums"]["cash_flow_direction"]
          document_id?: string | null
          expense_id?: string | null
          id?: string
          issued_on?: string
          number?: string | null
          organization_id: string
          vat_amount?: number
        }
        Update: {
          amount?: number
          cash_register_id?: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          direction?: Database["public"]["Enums"]["cash_flow_direction"]
          document_id?: string | null
          expense_id?: string | null
          id?: string
          issued_on?: string
          number?: string | null
          organization_id?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_items_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_items_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_items_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          description: string | null
          id: string
          name: string
          organization_id: string
          sequence_in_id: string | null
          sequence_out_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          sequence_in_id?: string | null
          sequence_out_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          sequence_in_id?: string | null
          sequence_out_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_sequence_in_id_fkey"
            columns: ["sequence_in_id"]
            isOneToOne: false
            referencedRelation: "number_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_sequence_out_id_fkey"
            columns: ["sequence_out_id"]
            isOneToOne: false
            referencedRelation: "number_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_persons: {
        Row: {
          contact_id: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          note: string | null
          organization_id: string
          phone: string | null
          position: string | null
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          note?: string | null
          organization_id: string
          phone?: string | null
          position?: string | null
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          note?: string | null
          organization_id?: string
          phone?: string | null
          position?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_persons_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_persons_organization_id_fkey"
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
          account_code: string | null
          activity_code: string | null
          cost_center: string | null
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
          project_code: string | null
          quantity: number
          unit: string
          unit_price: number
          vat_rate: number
        }
        Insert: {
          account_code?: string | null
          activity_code?: string | null
          cost_center?: string | null
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
          project_code?: string | null
          quantity?: number
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          account_code?: string | null
          activity_code?: string | null
          cost_center?: string | null
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
          project_code?: string | null
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
          accounting_date: string | null
          already_paid: number
          bank_account_id: string | null
          client_snapshot: Json | null
          constant_symbol: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          delivery_city: string | null
          delivery_country: string | null
          delivery_method: Database["public"]["Enums"]["delivery_method"] | null
          delivery_name: string | null
          delivery_phone: string | null
          delivery_postal_code: string | null
          delivery_street: string | null
          deposit: number
          discount_pct: number
          due_date: string | null
          exchange_rate: number
          footer_notes: string | null
          header_notes: string | null
          id: string
          internal_notes: string | null
          issue_date: string | null
          issued_by_email: string | null
          issued_by_name: string | null
          issued_by_phone: string | null
          language: string
          legal_notes: string | null
          notes: string | null
          number: string | null
          order_number: string | null
          organization_id: string
          oss: boolean
          paid_amount: number
          parcel_count: number | null
          pdf_url: string | null
          pickup_point_id: string | null
          related_document_id: string | null
          rounding: Database["public"]["Enums"]["rounding_mode"]
          sequence_id: string | null
          show_prices: boolean
          show_qr_payment: boolean
          show_signature: boolean
          source: string
          specific_symbol: string | null
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          supply_date: string | null
          tax_date: string | null
          tax_document: boolean
          total: number
          tracking_number: string | null
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          variable_symbol: string | null
          vat_mode: Database["public"]["Enums"]["vat_mode"]
          vat_total: number
          vat_transfer: boolean
          weight_kg: number | null
        }
        Insert: {
          accounting_date?: string | null
          already_paid?: number
          bank_account_id?: string | null
          client_snapshot?: Json | null
          constant_symbol?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_method?: Database["public"]["Enums"]["delivery_method"] | null
          delivery_name?: string | null
          delivery_phone?: string | null
          delivery_postal_code?: string | null
          delivery_street?: string | null
          deposit?: number
          discount_pct?: number
          due_date?: string | null
          exchange_rate?: number
          footer_notes?: string | null
          header_notes?: string | null
          id?: string
          internal_notes?: string | null
          issue_date?: string | null
          issued_by_email?: string | null
          issued_by_name?: string | null
          issued_by_phone?: string | null
          language?: string
          legal_notes?: string | null
          notes?: string | null
          number?: string | null
          order_number?: string | null
          organization_id: string
          oss?: boolean
          paid_amount?: number
          parcel_count?: number | null
          pdf_url?: string | null
          pickup_point_id?: string | null
          related_document_id?: string | null
          rounding?: Database["public"]["Enums"]["rounding_mode"]
          sequence_id?: string | null
          show_prices?: boolean
          show_qr_payment?: boolean
          show_signature?: boolean
          source?: string
          specific_symbol?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          supply_date?: string | null
          tax_date?: string | null
          tax_document?: boolean
          total?: number
          tracking_number?: string | null
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          variable_symbol?: string | null
          vat_mode?: Database["public"]["Enums"]["vat_mode"]
          vat_total?: number
          vat_transfer?: boolean
          weight_kg?: number | null
        }
        Update: {
          accounting_date?: string | null
          already_paid?: number
          bank_account_id?: string | null
          client_snapshot?: Json | null
          constant_symbol?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_method?: Database["public"]["Enums"]["delivery_method"] | null
          delivery_name?: string | null
          delivery_phone?: string | null
          delivery_postal_code?: string | null
          delivery_street?: string | null
          deposit?: number
          discount_pct?: number
          due_date?: string | null
          exchange_rate?: number
          footer_notes?: string | null
          header_notes?: string | null
          id?: string
          internal_notes?: string | null
          issue_date?: string | null
          issued_by_email?: string | null
          issued_by_name?: string | null
          issued_by_phone?: string | null
          language?: string
          legal_notes?: string | null
          notes?: string | null
          number?: string | null
          order_number?: string | null
          organization_id?: string
          oss?: boolean
          paid_amount?: number
          parcel_count?: number | null
          pdf_url?: string | null
          pickup_point_id?: string | null
          related_document_id?: string | null
          rounding?: Database["public"]["Enums"]["rounding_mode"]
          sequence_id?: string | null
          show_prices?: boolean
          show_qr_payment?: boolean
          show_signature?: boolean
          source?: string
          specific_symbol?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          supply_date?: string | null
          tax_date?: string | null
          tax_document?: boolean
          total?: number
          tracking_number?: string | null
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          variable_symbol?: string | null
          vat_mode?: Database["public"]["Enums"]["vat_mode"]
          vat_total?: number
          vat_transfer?: boolean
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
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
      einvoices: {
        Row: {
          created_at: string
          direction: Database["public"]["Enums"]["einvoice_direction"]
          document_id: string | null
          error: string | null
          expense_id: string | null
          id: string
          organization_id: string
          peppol_message_id: string | null
          provider: string | null
          receiver_peppol_id: string | null
          sender_peppol_id: string | null
          transport_status: Database["public"]["Enums"]["einvoice_transport_status"]
          ubl_xml: string | null
          updated_at: string
          validation_errors: Json | null
          validation_status: Database["public"]["Enums"]["einvoice_validation_status"]
        }
        Insert: {
          created_at?: string
          direction: Database["public"]["Enums"]["einvoice_direction"]
          document_id?: string | null
          error?: string | null
          expense_id?: string | null
          id?: string
          organization_id: string
          peppol_message_id?: string | null
          provider?: string | null
          receiver_peppol_id?: string | null
          sender_peppol_id?: string | null
          transport_status?: Database["public"]["Enums"]["einvoice_transport_status"]
          ubl_xml?: string | null
          updated_at?: string
          validation_errors?: Json | null
          validation_status?: Database["public"]["Enums"]["einvoice_validation_status"]
        }
        Update: {
          created_at?: string
          direction?: Database["public"]["Enums"]["einvoice_direction"]
          document_id?: string | null
          error?: string | null
          expense_id?: string | null
          id?: string
          organization_id?: string
          peppol_message_id?: string | null
          provider?: string | null
          receiver_peppol_id?: string | null
          sender_peppol_id?: string | null
          transport_status?: Database["public"]["Enums"]["einvoice_transport_status"]
          ubl_xml?: string | null
          updated_at?: string
          validation_errors?: Json | null
          validation_status?: Database["public"]["Enums"]["einvoice_validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "einvoices_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einvoices_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einvoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_items: {
        Row: {
          account_code: string | null
          activity_code: string | null
          cost_center: string | null
          created_at: string
          description: string
          expense_id: string
          id: string
          line_base: number
          line_total: number
          line_vat: number
          position: number
          project_code: string | null
          quantity: number
          unit: string
          unit_price: number
          vat_rate: number
        }
        Insert: {
          account_code?: string | null
          activity_code?: string | null
          cost_center?: string | null
          created_at?: string
          description?: string
          expense_id: string
          id?: string
          line_base?: number
          line_total?: number
          line_vat?: number
          position?: number
          project_code?: string | null
          quantity?: number
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          account_code?: string | null
          activity_code?: string | null
          cost_center?: string | null
          created_at?: string
          description?: string
          expense_id?: string
          id?: string
          line_base?: number
          line_total?: number
          line_vat?: number
          position?: number
          project_code?: string | null
          quantity?: number
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_items_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_payments: {
        Row: {
          amount: number
          bank_transaction_id: string | null
          created_at: string
          expense_id: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_at: string
        }
        Insert: {
          amount: number
          bank_transaction_id?: string | null
          created_at?: string
          expense_id: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
        }
        Update: {
          amount?: number
          bank_transaction_id?: string | null
          created_at?: string
          expense_id?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_payments_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
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
      org_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_organization_id_fkey"
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
          current_period_end: string | null
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
          plan: Database["public"]["Enums"]["plan_tier"]
          postal_code: string | null
          signature_url: string | null
          stamp_url: string | null
          street: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string
          vat_mode_default: Database["public"]["Enums"]["vat_mode"]
        }
        Insert: {
          city?: string | null
          country?: string
          created_at?: string
          current_period_end?: string | null
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
          plan?: Database["public"]["Enums"]["plan_tier"]
          postal_code?: string | null
          signature_url?: string | null
          stamp_url?: string | null
          street?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          vat_mode_default?: Database["public"]["Enums"]["vat_mode"]
        }
        Update: {
          city?: string | null
          country?: string
          created_at?: string
          current_period_end?: string | null
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
          plan?: Database["public"]["Enums"]["plan_tier"]
          postal_code?: string | null
          signature_url?: string | null
          stamp_url?: string | null
          street?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          vat_mode_default?: Database["public"]["Enums"]["vat_mode"]
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          amount_home: number | null
          bank_transaction_id: string | null
          created_at: string
          currency: string
          document_id: string
          exchange_diff: number | null
          exchange_rate: number
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_at: string
          variable_symbol: string | null
        }
        Insert: {
          amount: number
          amount_home?: number | null
          bank_transaction_id?: string | null
          created_at?: string
          currency?: string
          document_id: string
          exchange_diff?: number | null
          exchange_rate?: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          variable_symbol?: string | null
        }
        Update: {
          amount?: number
          amount_home?: number | null
          bank_transaction_id?: string | null
          created_at?: string
          currency?: string
          document_id?: string
          exchange_diff?: number | null
          exchange_rate?: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          variable_symbol?: string | null
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
      recurring_trips: {
        Row: {
          active: boolean
          cadence: Database["public"]["Enums"]["recurring_cadence"]
          contact_id: string | null
          created_at: string
          destination: string | null
          distance_km: number
          id: string
          next_run_on: string | null
          organization_id: string
          origin: string | null
          purpose: Database["public"]["Enums"]["trip_purpose"]
          purpose_note: string | null
          round_trip: boolean
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          active?: boolean
          cadence?: Database["public"]["Enums"]["recurring_cadence"]
          contact_id?: string | null
          created_at?: string
          destination?: string | null
          distance_km?: number
          id?: string
          next_run_on?: string | null
          organization_id: string
          origin?: string | null
          purpose?: Database["public"]["Enums"]["trip_purpose"]
          purpose_note?: string | null
          round_trip?: boolean
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          active?: boolean
          cadence?: Database["public"]["Enums"]["recurring_cadence"]
          contact_id?: string | null
          created_at?: string
          destination?: string | null
          distance_km?: number
          id?: string
          next_run_on?: string | null
          organization_id?: string
          origin?: string | null
          purpose?: Database["public"]["Enums"]["trip_purpose"]
          purpose_note?: string | null
          round_trip?: boolean
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_trips_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_trips_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      refuelings: {
        Row: {
          created_at: string
          expense_id: string | null
          id: string
          litres: number
          odometer_km: number | null
          organization_id: string
          price_per_litre: number
          refueled_at: string
          total_price: number
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          expense_id?: string | null
          id?: string
          litres: number
          odometer_km?: number | null
          organization_id: string
          price_per_litre: number
          refueled_at: string
          total_price: number
          vehicle_id: string
        }
        Update: {
          created_at?: string
          expense_id?: string | null
          id?: string
          litres?: number
          odometer_km?: number | null
          organization_id?: string
          price_per_litre?: number
          refueled_at?: string
          total_price?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refuelings_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refuelings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refuelings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
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
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          document_id: string | null
          expense_id: string | null
          id: string
          moved_at: string
          note: string | null
          organization_id: string
          product_id: string
          quantity: number
          type: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          expense_id?: string | null
          id?: string
          moved_at?: string
          note?: string | null
          organization_id: string
          product_id: string
          quantity: number
          type: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          expense_id?: string | null
          id?: string
          moved_at?: string
          note?: string | null
          organization_id?: string
          product_id?: string
          quantity?: number
          type?: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      taggings: {
        Row: {
          created_at: string
          id: string
          tag_id: string
          taggable_id: string
          taggable_type: Database["public"]["Enums"]["taggable_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          tag_id: string
          taggable_id: string
          taggable_type: Database["public"]["Enums"]["taggable_type"]
        }
        Update: {
          created_at?: string
          id?: string
          tag_id?: string
          taggable_id?: string
          taggable_type?: Database["public"]["Enums"]["taggable_type"]
        }
        Relationships: [
          {
            foreignKeyName: "taggings_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_rates: {
        Row: {
          created_at: string
          currency: string
          fuel_rate_per_km: number | null
          id: string
          note: string | null
          organization_id: string | null
          rate_per_km: number
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          fuel_rate_per_km?: number | null
          id?: string
          note?: string | null
          organization_id?: string | null
          rate_per_km: number
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          fuel_rate_per_km?: number | null
          id?: string
          note?: string | null
          organization_id?: string | null
          rate_per_km?: number
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travel_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          contact_id: string | null
          created_at: string
          destination: string | null
          distance_km: number
          driver_name: string | null
          id: string
          odometer_end_km: number | null
          odometer_start_km: number | null
          organization_id: string
          origin: string | null
          purpose: Database["public"]["Enums"]["trip_purpose"]
          purpose_note: string | null
          round_trip: boolean
          trip_date: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          destination?: string | null
          distance_km?: number
          driver_name?: string | null
          id?: string
          odometer_end_km?: number | null
          odometer_start_km?: number | null
          organization_id: string
          origin?: string | null
          purpose?: Database["public"]["Enums"]["trip_purpose"]
          purpose_note?: string | null
          round_trip?: boolean
          trip_date: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          destination?: string | null
          distance_km?: number
          driver_name?: string | null
          id?: string
          odometer_end_km?: number | null
          odometer_start_km?: number | null
          organization_id?: string
          origin?: string | null
          purpose?: Database["public"]["Enums"]["trip_purpose"]
          purpose_note?: string | null
          round_trip?: boolean
          trip_date?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
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
      vehicle_events: {
        Row: {
          cost: number | null
          created_at: string
          description: string | null
          event_date: string
          expense_id: string | null
          id: string
          next_due_on: string | null
          odometer_km: number | null
          organization_id: string
          type: Database["public"]["Enums"]["vehicle_event_type"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description?: string | null
          event_date?: string
          expense_id?: string | null
          id?: string
          next_due_on?: string | null
          odometer_km?: number | null
          organization_id: string
          type?: Database["public"]["Enums"]["vehicle_event_type"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string | null
          event_date?: string
          expense_id?: string | null
          id?: string
          next_due_on?: string | null
          odometer_km?: number | null
          organization_id?: string
          type?: Database["public"]["Enums"]["vehicle_event_type"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_events_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          consumption_l_100km: number | null
          created_at: string
          driver_name: string | null
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          id: string
          license_plate: string
          name: string
          note: string | null
          odometer_km: number
          organization_id: string
          ownership: Database["public"]["Enums"]["vehicle_ownership"]
          updated_at: string
          vin: string | null
        }
        Insert: {
          active?: boolean
          consumption_l_100km?: number | null
          created_at?: string
          driver_name?: string | null
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          id?: string
          license_plate: string
          name: string
          note?: string | null
          odometer_km?: number
          organization_id: string
          ownership?: Database["public"]["Enums"]["vehicle_ownership"]
          updated_at?: string
          vin?: string | null
        }
        Update: {
          active?: boolean
          consumption_l_100km?: number | null
          created_at?: string
          driver_name?: string | null
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          id?: string
          license_plate?: string
          name?: string
          note?: string | null
          odometer_km?: number
          organization_id?: string
          ownership?: Database["public"]["Enums"]["vehicle_ownership"]
          updated_at?: string
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          current_period_end: string | null
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
          plan: Database["public"]["Enums"]["plan_tier"]
          postal_code: string | null
          signature_url: string | null
          stamp_url: string | null
          street: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
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
      save_document_with_items: {
        Args: { p_document: Json; p_id?: string; p_items: Json }
        Returns: string
      }
    }
    Enums: {
      bank_match_status: "unmatched" | "matched" | "ignored"
      cash_flow_direction: "in" | "out"
      contact_type: "customer" | "supplier" | "both"
      delivery_method:
        | "courier"
        | "mail"
        | "personal"
        | "pickup_point"
        | "haulage"
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
      einvoice_direction: "outbound" | "inbound"
      einvoice_transport_status:
        | "queued"
        | "sent"
        | "delivered"
        | "failed"
        | "received"
      einvoice_validation_status: "pending" | "valid" | "invalid"
      expense_source:
        | "manual"
        | "ai_capture"
        | "peppol_inbound"
        | "invoice_by_square"
      fuel_type: "petrol" | "diesel" | "lpg" | "cng" | "electric" | "hybrid"
      org_role: "owner" | "admin" | "accountant" | "member"
      payment_method: "bank" | "card" | "cash" | "other"
      payment_status: "unpaid" | "partially_paid" | "paid"
      plan_tier: "free" | "pro" | "business"
      recurring_cadence: "weekly" | "monthly" | "custom"
      recurring_send_method: "email" | "peppol" | "none"
      reminder_channel: "email" | "sms"
      rounding_mode: "document" | "item" | "item_ext"
      stock_movement_type: "in" | "out" | "adjustment" | "return"
      taggable_type: "document" | "expense" | "contact"
      trip_purpose: "business" | "private"
      vat_mode:
        | "payer"
        | "non_payer"
        | "reverse_charge_domestic"
        | "intra_eu_b2b"
        | "oss"
        | "export"
        | "exempt"
      vehicle_event_type:
        | "service"
        | "inspection"
        | "insurance"
        | "repair"
        | "tyres"
        | "fine"
        | "other"
      vehicle_ownership: "company" | "private" | "leased"
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
      cash_flow_direction: ["in", "out"],
      contact_type: ["customer", "supplier", "both"],
      delivery_method: [
        "courier",
        "mail",
        "personal",
        "pickup_point",
        "haulage",
      ],
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
      einvoice_direction: ["outbound", "inbound"],
      einvoice_transport_status: [
        "queued",
        "sent",
        "delivered",
        "failed",
        "received",
      ],
      einvoice_validation_status: ["pending", "valid", "invalid"],
      expense_source: [
        "manual",
        "ai_capture",
        "peppol_inbound",
        "invoice_by_square",
      ],
      fuel_type: ["petrol", "diesel", "lpg", "cng", "electric", "hybrid"],
      org_role: ["owner", "admin", "accountant", "member"],
      payment_method: ["bank", "card", "cash", "other"],
      payment_status: ["unpaid", "partially_paid", "paid"],
      plan_tier: ["free", "pro", "business"],
      recurring_cadence: ["weekly", "monthly", "custom"],
      recurring_send_method: ["email", "peppol", "none"],
      reminder_channel: ["email", "sms"],
      rounding_mode: ["document", "item", "item_ext"],
      stock_movement_type: ["in", "out", "adjustment", "return"],
      taggable_type: ["document", "expense", "contact"],
      trip_purpose: ["business", "private"],
      vat_mode: [
        "payer",
        "non_payer",
        "reverse_charge_domestic",
        "intra_eu_b2b",
        "oss",
        "export",
        "exempt",
      ],
      vehicle_event_type: [
        "service",
        "inspection",
        "insurance",
        "repair",
        "tyres",
        "fine",
        "other",
      ],
      vehicle_ownership: ["company", "private", "leased"],
    },
  },
} as const

