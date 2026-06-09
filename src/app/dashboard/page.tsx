import { createServerSupabaseClient } from '@/lib/supabase'
import { formatMoney, formatWeekRange, getWeekStartStr, currentYear, currentMonth } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const weekStart = getWeekStartStr()

  // Εβδομαδιαία σύνοψη
  const { data: weekly } = await supabase.rpc('get_weekly_summary', { p_week_start: weekStart })

  // Μηνιαία σύνοψη
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const { data: monthly } = await supabase.rpc('get_period_summary', { p_from: monthStart, p_to: monthEnd })

  // Τελευταίες κινήσεις
  const { data: recentEntries } = await supabase
    .from('cashflow_entries')
    .select('*, client:clients(name), partner:partners(name), user:user_profiles(full_name)')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(8)

  // Υπόλοιπο ταμείου
  const { data: balance } = await supabase.rpc('get_cashflow_balance')

  // Πελάτες με ανοιχτό υπόλοιπο
  const { data: topDebtors } = await supabase
    .from('clients')
    .select('id, name, type, opening_balance')
    .eq('is_active', true)
    .limit(5)

  const ws = weekly?.[0]
  const ms = monthly?.[0]

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Εβδομάδα ${formatWeekRange(weekStart)}`}
        actions={
          <Link href="/dashboard/tamio/new" className="btn-primary btn-sm">
            + Νέα κίνηση
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {/* Υπόλοιπο ταμείου */}
        <div className="card bg-gray-900 text-white">
          <p className="text-sm text-gray-400 mb-1">Τρέχον υπόλοιπο ταμείου</p>
          <p className={`text-3xl font-semibold ${(balance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatMoney(balance || 0)}
          </p>
        </div>

        {/* Εβδομαδιαία metrics */}
        <div>
          <p className="section-title">Τρέχουσα εβδομάδα</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="metric-card">
              <p className="text-xs text-gray-500 mb-1">Εισπράξεις</p>
              <p className="text-lg font-semibold text-green-600">{formatMoney(ws?.total_receipts || 0)}</p>
            </div>
            <div className="metric-card">
              <p className="text-xs text-gray-500 mb-1">Πληρωμές</p>
              <p className="text-lg font-semibold text-red-600">{formatMoney((ws?.total_expenses || 0) + (ws?.total_salaries || 0))}</p>
            </div>
            <div className="metric-card">
              <p className="text-xs text-gray-500 mb-1">Διανομές</p>
              <p className="text-lg font-semibold text-amber-600">{formatMoney(ws?.total_distributions || 0)}</p>
            </div>
            <div className="metric-card">
              <p className="text-xs text-gray-500 mb-1">Αποτέλεσμα εβδομάδας</p>
              <p className={`text-lg font-semibold ${(ws?.net_result || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(ws?.net_result || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Μηνιαία metrics */}
        <div>
          <p className="section-title">Τρέχων μήνας</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="metric-card">
              <p className="text-xs text-gray-500 mb-1">Εισπράξεις</p>
              <p className="text-base font-semibold text-green-600">{formatMoney(ms?.total_receipts || 0)}</p>
            </div>
            <div className="metric-card">
              <p className="text-xs text-gray-500 mb-1">Πληρωμές</p>
              <p className="text-base font-semibold text-red-600">{formatMoney((ms?.total_expenses_fixed || 0) + (ms?.total_expenses_periodic || 0) + (ms?.total_expenses_adhoc || 0) + (ms?.total_salaries || 0))}</p>
            </div>
            <div className="metric-card">
              <p className="text-xs text-gray-500 mb-1">Διανομές</p>
              <p className="text-base font-semibold text-amber-600">{formatMoney(ms?.total_distributions || 0)}</p>
            </div>
            <div className="metric-card">
              <p className="text-xs text-gray-500 mb-1">Αποτέλεσμα μήνα</p>
              <p className={`text-base font-semibold ${(ms?.net_result || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(ms?.net_result || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Τελευταίες κινήσεις */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title mb-0">Τελευταίες κινήσεις</p>
            <Link href="/dashboard/tamio" className="text-xs text-blue-600 hover:underline">Όλες →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header w-24">Ημ/νία</th>
                  <th className="table-header">Περιγραφή</th>
                  <th className="table-header w-28 text-right">Ποσό</th>
                  <th className="table-header w-24">Χρήστης</th>
                </tr>
              </thead>
              <tbody>
                {recentEntries?.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="table-cell text-gray-500 text-xs">{new Date(entry.entry_date).toLocaleDateString('el-GR')}</td>
                    <td className="table-cell">
                      <div className="font-medium">{entry.description || '—'}</div>
                      {entry.client && <div className="text-xs text-gray-400">{entry.client.name}</div>}
                    </td>
                    <td className={`table-cell text-right font-semibold ${entry.entry_type === 'receipt' ? 'text-green-600' : 'text-red-600'}`}>
                      {entry.entry_type === 'receipt' ? '+' : '−'}{formatMoney(entry.amount)}
                    </td>
                    <td className="table-cell text-xs text-gray-400">{entry.user?.full_name || '—'}</td>
                  </tr>
                ))}
                {(!recentEntries || recentEntries.length === 0) && (
                  <tr><td colSpan={4} className="table-cell text-center text-gray-400 py-8">Δεν υπάρχουν κινήσεις ακόμα</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
