import { createServerSupabaseClient } from '@/lib/supabase'
import { formatMoney, formatWeekRange, getWeekStartStr, getWeeksList } from '@/lib/utils'
import { addDays, subDays, format } from 'date-fns'
import PageHeader from '@/components/layout/PageHeader'
import Link from 'next/link'
import TamioWeekView from './TamioWeekView'

export default async function TamioPage({
  searchParams
}: {
  searchParams: { week?: string }
}) {
  const supabase = await createServerSupabaseClient()

  const weekStart = searchParams.week || getWeekStartStr()
  const weekEnd = format(addDays(new Date(weekStart), 6), 'yyyy-MM-dd')
  const prevWeek = format(subDays(new Date(weekStart), 7), 'yyyy-MM-dd')
  const nextWeek = format(addDays(new Date(weekStart), 7), 'yyyy-MM-dd')
  const isCurrentWeek = weekStart === getWeekStartStr()

  // Κινήσεις εβδομάδας
  const { data: entries } = await supabase
    .from('cashflow_entries')
    .select('*, client:clients(id,name,afm), partner:partners(id,name), obligation:obligations(id,name), user:user_profiles(full_name)')
    .gte('entry_date', weekStart)
    .lte('entry_date', weekEnd)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  // Σύνοψη εβδομάδας
  const { data: summary } = await supabase.rpc('get_weekly_summary', { p_week_start: weekStart })

  // Δεδομένα για νέα κίνηση (autocomplete)
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, afm, type, invoice_amount, inc_stamp, inc_vat, vat_period, fee')
    .eq('is_active', true)
    .order('name')

  const { data: obligations } = await supabase
    .from('obligations')
    .select('id, name, obligation_type, amount, employee_name')
    .eq('is_active', true)
    .order('name')

  const { data: partners } = await supabase
    .from('partners')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  // Υπόλοιπο ταμείου
  const { data: balance } = await supabase.rpc('get_cashflow_balance')

  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', (await supabase.auth.getUser()).data.user?.id || '')
    .single()

  return (
    <div>
      <PageHeader
        title="Ταμείο"
        subtitle={`Εβδομάδα ${formatWeekRange(weekStart)}`}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">{formatMoney(balance || 0)}</span>
            <span className="text-xs text-gray-400">υπόλοιπο</span>
          </div>
        }
      />
      <TamioWeekView
        weekStart={weekStart}
        prevWeek={prevWeek}
        nextWeek={nextWeek}
        isCurrentWeek={isCurrentWeek}
        entries={entries || []}
        summary={summary?.[0]}
        clients={clients || []}
        obligations={obligations || []}
        partners={partners || []}
        balance={balance || 0}
        userRole={userProfile?.role || 'viewer'}
      />
    </div>
  )
}
