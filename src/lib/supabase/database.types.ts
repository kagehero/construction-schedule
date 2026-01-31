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
      user_profiles: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'viewer'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'admin' | 'viewer'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'viewer'
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          title: string
          customer_name: string
          site_name: string
          contract_type: '請負' | '常用' | '追加工事'
          contract_amount: number | null
          site_address: string
          start_date: string
          end_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          customer_name: string
          site_name: string
          contract_type: '請負' | '常用' | '追加工事'
          contract_amount?: number | null
          site_address: string
          start_date: string
          end_date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          customer_name?: string
          site_name?: string
          contract_type?: '請負' | '常用' | '追加工事'
          contract_amount?: number | null
          site_address?: string
          start_date?: string
          end_date?: string
          created_at?: string
          updated_at?: string
        }
      }
      members: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      work_lines: {
        Row: {
          id: string
          project_id: string | null
          name: string
          color: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          name: string
          color?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          name?: string
          color?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      assignments: {
        Row: {
          id: string
          work_line_id: string
          date: string
          member_id: string
          is_holiday: boolean
          is_confirmed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_line_id: string
          date: string
          member_id: string
          is_holiday?: boolean
          is_confirmed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_line_id?: string
          date?: string
          member_id?: string
          is_holiday?: boolean
          is_confirmed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      day_site_status: {
        Row: {
          id: string
          work_line_id: string
          date: string
          is_locked: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_line_id: string
          date: string
          is_locked?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_line_id?: string
          date?: string
          is_locked?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
