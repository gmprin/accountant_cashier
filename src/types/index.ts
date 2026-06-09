// ============================================================
// TYPES
// ============================================================

export type UserRole = 'admin' | 'user' | 'viewer'

export interface UserProfile {
  id: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ClientType = 'hond' | 'lian'
export type PeriodType = 'monthly' | 'quarterly' | 'yearly'
export type VatPeriod = 'monthly' | 'yearly'

export interface Client {
  id: number
  type: ClientType
  name: string
  afm: string | null
  period: PeriodType | null
  invoice_amount: number
  inc_stamp: boolean
  inc_vat: boolean
  vat_period: VatPeriod
  extra_fee: number
  reason: string | null
  reason_label: string | null
  fee: number
  opening_balance: number
  is_active: boolean
  created_at: string
  updated_at: string
  // Computed
  current_balance?: number
}

export interface SensitiveData {
  phone?: string
  email?: string
  taxisnet_user?: string
  taxisnet_pass?: string
  notes?: string
}

export type ChargeType = 'monthly' | 'quarterly' | 'yearly' | 'stamp' | 'vat_yearly' | 'extra' | 'manual'

export interface ClientCharge {
  id: number
  client_id: number
  year: number
  month: number
  charge_type: ChargeType
  amount: number
  description: string | null
  is_auto: boolean
  created_at: string
  created_by: string | null
}

export interface ClientReceipt {
  id: number
  client_id: number
  amount: number
  receipt_date: string
  year: number
  month: number
  description: string | null
  matched_charges: number[]
  created_at: string
  created_by: string | null
}

export type EntryType =
  | 'receipt'
  | 'expense_fixed'
  | 'expense_periodic'
  | 'expense_adhoc'
  | 'salary'
  | 'distribution'
  | 'transfer'

export interface CashflowEntry {
  id: number
  entry_date: string
  week_start: string
  year: number
  month: number
  week_number: number
  entry_type: EntryType
  amount: number
  description: string | null
  client_id: number | null
  client_receipt_id: number | null
  obligation_id: number | null
  partner_id: number | null
  created_at: string
  created_by: string | null
  // Joins
  client?: Pick<Client, 'id' | 'name' | 'afm'>
  partner?: Pick<Partner, 'id' | 'name'>
  obligation?: Pick<Obligation, 'id' | 'name'>
  user?: Pick<UserProfile, 'full_name'>
}

export type ObligationType = 'fixed' | 'periodic' | 'employee'
export type Recurrence = 'monthly' | 'quarterly' | 'yearly' | 'once'

export interface Obligation {
  id: number
  name: string
  obligation_type: ObligationType
  amount: number
  employee_name: string | null
  due_day: number | null
  due_month: number | null
  recurrence: Recurrence
  next_due_date: string | null
  is_active: boolean
  created_at: string
  // Computed
  total_paid?: number
  balance?: number
}

export interface ObligationPayment {
  id: number
  obligation_id: number
  amount: number
  payment_date: string
  description: string | null
  cashflow_entry_id: number | null
  created_at: string
  created_by: string | null
}

export interface Partner {
  id: number
  name: string
  percentage: number
  is_active: boolean
  created_at: string
}

export interface PartnerDistribution {
  id: number
  partner_id: number
  amount: number
  distribution_date: string
  week_start: string
  year: number
  month: number
  description: string | null
  cashflow_entry_id: number | null
  created_at: string
  created_by: string | null
  partner?: Pick<Partner, 'id' | 'name'>
}

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT'

export interface AuditLog {
  id: number
  user_id: string | null
  user_name: string | null
  action: AuditAction
  table_name: string | null
  record_id: string | null
  details: string | null
  ip_address: string | null
  created_at: string
}

export interface WeeklySummary {
  total_receipts: number
  total_expenses: number
  total_salaries: number
  total_distributions: number
  net_result: number
  opening_balance: number
  closing_balance: number
}

export interface PeriodSummary {
  total_receipts: number
  total_expenses_fixed: number
  total_expenses_periodic: number
  total_expenses_adhoc: number
  total_salaries: number
  total_distributions: number
  net_result: number
}

// Autocomplete suggestion
export interface AutocompleteSuggestion {
  id: number
  label: string
  sublabel?: string
  type: 'client' | 'obligation' | 'partner'
  data: Client | Obligation | Partner
}
