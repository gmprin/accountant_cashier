import { format, startOfWeek, getWeek, getISOWeek, addDays, isWeekend, subDays } from 'date-fns'
import { el } from 'date-fns/locale'

// ============================================================
// ΜΟΡΦΟΠΟΙΗΣΗ
// ============================================================

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('el-GR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + '€'
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy')
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy HH:mm')
}

export function formatMonth(year: number, month: number): string {
  const months = [
    'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος',
    'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος',
    'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'
  ]
  return `${months[month - 1]} ${year}`
}

export function formatMonthShort(month: number): string {
  const months = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν',
    'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ']
  return months[month - 1]
}

export function periodLabel(period: string): string {
  return { monthly: 'Μηνιαία', quarterly: 'Τριμηνιαία', yearly: 'Ετήσια' }[period] || period
}

export function entryTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    receipt: 'Είσπραξη',
    expense_fixed: 'Σταθερή υποχρέωση',
    expense_periodic: 'Περιοδική υποχρέωση',
    expense_adhoc: 'Έκτακτη πληρωμή',
    salary: 'Μισθοδοσία',
    distribution: 'Διανομή συνεταίρου',
    transfer: 'Μεταφορά υπολοίπου',
  }
  return labels[type] || type
}

export function roleLabel(role: string): string {
  return { admin: 'Admin', user: 'Χρήστης', viewer: 'Θεατής' }[role] || role
}

// ============================================================
// ΕΒΔΟΜΑΔΑ
// ============================================================

export function getWeekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 }) // Δευτέρα
}

export function getWeekStartStr(date: Date = new Date()): string {
  return format(getWeekStart(date), 'yyyy-MM-dd')
}

export function getWeekNumber(date: Date = new Date()): number {
  return getISOWeek(date)
}

export function formatWeekRange(weekStart: string | Date): string {
  const start = new Date(weekStart)
  const end = addDays(start, 6)
  return `${format(start, 'dd/MM')} – ${format(end, 'dd/MM/yyyy')}`
}

// ============================================================
// ΤΕΛΕΥΤΑΙΑ ΕΡΓΑΣΙΜΗ ΜΗΝΑ
// ============================================================

export function getLastWorkingDayOfMonth(year: number, month: number): Date {
  // Τελευταία μέρα του μήνα
  let date = new Date(year, month, 0) // 0 = τελευταία μέρα προηγούμενου μήνα
  // Αν Σάββατο ή Κυριακή, πηγαίνε πίσω
  while (isWeekend(date)) {
    date = subDays(date, 1)
  }
  return date
}

// ============================================================
// ΥΠΟΛΟΓΙΣΜΟΙ ΧΡΕΩΣΕΩΝ
// ============================================================

export function calcClientAmounts(
  invoiceAmount: number,
  incStamp: boolean,
  incVat: boolean
): { base: number; stamp: number; vat: number; total: number } {
  const base = invoiceAmount
  const stamp = incStamp ? base * 0.20 : 0
  const vat = incVat ? (base + stamp) * 0.24 : 0
  return { base, stamp, vat, total: base + stamp + vat }
}

export function calcMonthlyAmount(
  invoiceAmount: number,
  incStamp: boolean,
  incVat: boolean,
  vatPeriod: string
): number {
  // Μηνιαία χρέωση = βασική αμοιβή + ΦΠΑ αν είναι μηνιαίο
  // Χαρτόσημο και ΦΠΑ ετήσιο χρεώνονται Δεκέμβριο
  const base = invoiceAmount
  const vat = incVat && vatPeriod === 'monthly' ? (base * 0.24) : 0
  return base + vat
}

// ============================================================
// ΕΒΔΟΜΑΔΙΑΙΑ ΑΝΑΛΥΣΗ - ΒΟΗΘΗΤΙΚΗ
// ============================================================

export function getWeeksList(fromDate: Date, toDate: Date): Date[] {
  const weeks: Date[] = []
  let current = getWeekStart(fromDate)
  const end = getWeekStart(toDate)
  while (current <= end) {
    weeks.push(new Date(current))
    current = addDays(current, 7)
  }
  return weeks
}

// ============================================================
// ΚΡΥΠΤΟΓΡΑΦΗΣΗ (client-side helper — η κύρια γίνεται server-side)
// ============================================================

export function maskSensitive(value: string): string {
  if (!value) return '—'
  if (value.length <= 4) return '••••'
  return value.substring(0, 2) + '•'.repeat(value.length - 4) + value.substring(value.length - 2)
}

// ============================================================
// AUTOCOMPLETE SUGGESTION SCORE
// ============================================================

export function scoreMatch(query: string, target: string): number {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (t.startsWith(q)) return 3
  if (t.includes(q)) return 2
  return 0
}

// ============================================================
// ΧΡΩΜΑΤΑ ΑΝΑΛΟΓΑ ΜΕ ΤΙΜΗ
// ============================================================

export function balanceColor(balance: number): string {
  if (balance > 0) return 'text-red-600'   // χρωστάει
  if (balance < 0) return 'text-green-600' // έχει πιστωτικό
  return 'text-gray-500'
}

export function amountColor(entryType: string): string {
  return entryType === 'receipt' ? 'text-green-600' : 'text-red-600'
}

// ============================================================
// ΤΡΕΧΩΝ ΜΗΝΑΣ / ΕΤΟΣ
// ============================================================

export function currentYear(): number { return new Date().getFullYear() }
export function currentMonth(): number { return new Date().getMonth() + 1 }

export function getYearRange(fromYear: number = 2020): number[] {
  const years: number[] = []
  for (let y = currentYear() + 1; y >= fromYear; y--) years.push(y)
  return years
}

export function getMonthOptions(): { value: number; label: string }[] {
  const months = [
    'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος',
    'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος',
    'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'
  ]
  return months.map((label, i) => ({ value: i + 1, label }))
}
