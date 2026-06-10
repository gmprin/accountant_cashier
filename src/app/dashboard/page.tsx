'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { formatMoney, formatWeekRange, getWeekStartStr } from '@/lib/utils'
import Link from 'next/link'

export default function DashboardPage() {
  const supabase = createClient()
  const [weekly, setWeekly] = useState<any>(null)
  const [monthly, setMonthly] = useState<any>(null)
  const [balance, setBalance] = useState(0)
  const [recentEntries, setRecentEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const weekStart = getWeekStartStr()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
    const monthEnd = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().split('T')[0]

    const [{ data: w }, { data: m }, { data: b }, { data: e }] = await Promise.all([
      supabase.rpc('get_weekly_summary', { p_week_start: weekStart }),
      supabase.rpc('get_period_summary', { p_from: monthStart, p_to: monthEnd }),
      supabase.rpc('get_cashflow_balance'),
      supabase.from('cashflow_entries')
        .select('*, client:clients(name), partner:partners(name), user:user_profiles(full_name)')
        .order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(8),
    ])
    setWeekly(w?.[0]); setMonthly(m?.[0]); setBalance(b||0); setRecentEntries(e||[])
    setLoading(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">{formatWeekRange(weekStart)}</p>
        </div>
        <Link href="/dashboard/tamio" className="btn-primary btn-sm">+ Νέα κίνηση</Link>
      </div>

      <div className="p-6 space-y-6">
        <div className="card bg-gray-900 text-white">
          <p className="text-sm text-gray-400 mb-1">Τρέχον υπόλοιπο ταμείου</p>
          <p className={`text-3xl font-semibold ${balance>=0?'text-green-400':'text-red-400'}`}>{formatMoney(balance)}</p>
        </div>

        <div>
          <p className="section-title">Τρέχουσα εβδομάδα</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Εισπράξεις</p><p className="text-lg font-semibold text-green-600">{formatMoney(weekly?.total_receipts||0)}</p></div>
            <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Πληρωμές</p><p className="text-lg font-semibold text-red-600">{formatMoney((weekly?.total_expenses||0)+(weekly?.total_salaries||0))}</p></div>
            <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Διανομές</p><p className="text-lg font-semibold text-amber-600">{formatMoney(weekly?.total_distributions||0)}</p></div>
            <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Αποτέλεσμα εβδομάδας</p><p className={`text-lg font-semibold ${(weekly?.net_result||0)>=0?'text-green-600':'text-red-600'}`}>{formatMoney(weekly?.net_result||0)}</p></div>
          </div>
        </div>

        <div>
          <p className="section-title">Τρέχων μήνας</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Εισπράξεις</p><p className="text-base font-semibold text-green-600">{formatMoney(monthly?.total_receipts||0)}</p></div>
            <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Πληρωμές</p><p className="text-base font-semibold text-red-600">{formatMoney((monthly?.total_expenses_fixed||0)+(monthly?.total_expenses_periodic||0)+(monthly?.total_expenses_adhoc||0)+(monthly?.total_salaries||0))}</p></div>
            <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Διανομές</p><p className="text-base font-semibold text-amber-600">{formatMoney(monthly?.total_distributions||0)}</p></div>
            <div className="metric-card"><p className="text-xs text-gray-500 mb-1">Αποτέλεσμα μήνα</p><p className={`text-base font-semibold ${(monthly?.net_result||0)>=0?'text-green-600':'text-red-600'}`}>{formatMoney(monthly?.net_result||0)}</p></div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title mb-0">Τελευταίες κινήσεις</p>
            <Link href="/dashboard/tamio" className="text-xs text-blue-600 hover:underline">Όλες →</Link>
          </div>
          {loading ? <p className="text-center text-gray-400 py-4 text-sm">Φόρτωση...</p> : (
            <table className="w-full">
              <thead><tr>
                <th className="table-header w-24">Ημ/νία</th>
                <th className="table-header">Περιγραφή</th>
                <th className="table-header w-28 text-right">Ποσό</th>
                <th className="table-header w-24">Χρήστης</th>
              </tr></thead>
              <tbody>
                {recentEntries.map(e=>(
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="table-cell text-gray-500 text-xs">{new Date(e.entry_date).toLocaleDateString('el-GR')}</td>
                    <td className="table-cell"><div className="font-medium">{e.description||'—'}</div>{e.client&&<div className="text-xs text-gray-400">{e.client.name}</div>}</td>
                    <td className={`table-cell text-right font-semibold ${e.entry_type==='receipt'?'text-green-600':'text-red-600'}`}>{e.entry_type==='receipt'?'+':'−'}{formatMoney(e.amount)}</td>
                    <td className="table-cell text-xs text-gray-400">{e.user?.full_name||'—'}</td>
                  </tr>
                ))}
                {recentEntries.length===0&&<tr><td colSpan={4} className="table-cell text-center text-gray-400 py-8">Δεν υπάρχουν κινήσεις ακόμα</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
